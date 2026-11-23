/* ===== 시드니 공동 일정·방문 체크·경비: Firebase Firestore ===== */
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Expense } from "./components/ExpenseTracker";
import type { MapLocation } from "./components/MapPicker";

/* ===== 기존 앱 데이터 형태와 동일하게 유지 ===== */
export type SharedStop = {
  id: string;
  time: string;
  name: string;
  detail: string;
  category: "food" | "cafe" | "travel" | "store" | "spot" | "stay";
  mapUrl?: string;
  mapLocation?: MapLocation;
};

export type SharedDay = {
  day: number;
  weekday: string;
  title: string;
  subtitle: string;
  stops: SharedStop[];
};

export type SharedData = {
  days: SharedDay[];
  visited: string[];
  expenses: Expense[];
  initialized: boolean;
};

type CollectionName = "days" | "visited" | "expenses";
const tripCollection = (name: CollectionName) =>
  collection(db, "trips", "sydney2026", name);
const tripDoc = (name: CollectionName, id: string) =>
  doc(db, "trips", "sydney2026", name, id);

/* ===== Firestore는 undefined를 허용하지 않으므로 직렬화해서 정리 ===== */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/* ===== 세 컬렉션을 실시간 감시하고 모두 도착한 뒤 화면 반영 ===== */
export function watchSharedTrip(
  onData: (data: SharedData) => void,
  onError: (error: Error) => void,
): () => void {
  let active = true;
  const seen = { days: false, visited: false, expenses: false };
  const state: SharedData = {
    days: [],
    visited: [],
    expenses: [],
    initialized: false,
  };
  let dayDataConfirmedByServer = false;

  function publish() {
    if (!active || !seen.days || !seen.visited || !seen.expenses) return;

    // ===== 오프라인 캐시가 비었다고 초기화 화면을 잘못 열지 않음 =====
    if (!state.initialized && !dayDataConfirmedByServer) return;
    onData({
      days: state.days.map((day) => ({ ...day, stops: [...day.stops] })),
      visited: [...state.visited],
      expenses: [...state.expenses],
      initialized: state.initialized,
    });
  }

  const stopDays = onSnapshot(
    tripCollection("days"),
    (snapshot) => {
      const actualDays = snapshot.docs.filter(
        (entry) => entry.id !== "__setup" && typeof entry.data().day === "number",
      );
      state.days = actualDays
        .map((entry) => entry.data() as SharedDay)
        .sort((a, b) => a.day - b.day);
      state.initialized =
        snapshot.docs.some((entry) => entry.id === "__setup") ||
        actualDays.length > 0;
      dayDataConfirmedByServer = !snapshot.metadata.fromCache;
      seen.days = true;
      publish();
    },
    onError,
  );

  const stopVisited = onSnapshot(
    tripCollection("visited"),
    (snapshot) => {
      state.visited = snapshot.docs
        .filter((entry) => entry.data().checked === true)
        .map((entry) => entry.id);
      seen.visited = true;
      publish();
    },
    onError,
  );

  const stopExpenses = onSnapshot(
    tripCollection("expenses"),
    (snapshot) => {
      state.expenses = snapshot.docs
        .map((entry) => entry.data() as Expense)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      seen.expenses = true;
      publish();
    },
    onError,
  );

  return () => {
    active = false;
    stopDays();
    stopVisited();
    stopExpenses();
  };
}

/* ===== 최초 한 번만 이 기기의 기록을 공동 DB로 이전 ===== */
export async function initializeTripOnce(data: {
  days: SharedDay[];
  visited: string[];
  expenses: Expense[];
}): Promise<boolean> {
  const writes = 1 + data.days.length + data.visited.length + data.expenses.length;
  if (writes > 400) {
    throw new Error("최초 이전할 기록이 너무 많아. 기록을 나눠 이전해야 해.");
  }

  const marker = tripDoc("days", "__setup");
  const result = await runTransaction(db, async (transaction) => {
    const markerSnapshot = await transaction.get(marker);
    if (markerSnapshot.exists()) return false;

    // ===== 수동으로 저장한 기존 15일 문서가 있으면 덮어쓰지 않음 =====
    const existingFirstDay = await transaction.get(tripDoc("days", "15"));
    if (existingFirstDay.exists()) {
      throw new Error("이미 Firestore에 일정이 있어. 기존 기록을 먼저 확인해 줘.");
    }

    transaction.set(marker, { initializedAt: new Date().toISOString() });
    for (const day of data.days) {
      transaction.set(tripDoc("days", String(day.day)), clean(day));
    }
    for (const stopId of [...new Set(data.visited)]) {
      transaction.set(tripDoc("visited", stopId), { checked: true });
    }
    for (const expense of data.expenses) {
      transaction.set(tripDoc("expenses", expense.id), clean(expense));
    }
    return true;
  });
  return result;
}

/* ===== 같은 날짜 동시 수정은 트랜잭션으로 충돌 방지 ===== */
export async function saveSharedStop(
  dayNumber: number,
  stop: SharedStop,
  editingId: string | null,
): Promise<void> {
  const reference = tripDoc("days", String(dayNumber));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("해당 날짜의 공동 일정이 없어.");
    const day = snapshot.data() as SharedDay;
    const updatedStops = editingId
      ? day.stops.map((entry) => (entry.id === editingId ? clean(stop) : entry))
      : [...day.stops, clean(stop)];
    transaction.update(reference, { stops: updatedStops });
  });
}

export async function removeSharedStop(dayNumber: number, stopId: string): Promise<void> {
  const reference = tripDoc("days", String(dayNumber));
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) throw new Error("해당 날짜의 공동 일정이 없어.");
    const day = snapshot.data() as SharedDay;
    transaction.update(reference, {
      stops: day.stops.filter((entry) => entry.id !== stopId),
    });
    transaction.delete(tripDoc("visited", stopId));
  });
}

/* ===== 일정의 방문 상태는 각 장소별 독립 문서로 저장 ===== */
export async function toggleSharedVisit(stopId: string): Promise<void> {
  const reference = tripDoc("visited", stopId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) transaction.delete(reference);
    else transaction.set(reference, { checked: true });
  });
}

/* ===== 지출은 개별 문서로 관리해 다른 지출과 충돌하지 않음 ===== */
export async function addSharedExpense(expense: Expense): Promise<void> {
  await setDoc(tripDoc("expenses", expense.id), clean(expense));
}
export async function editSharedExpense(expense: Expense): Promise<void> {
  await updateDoc(tripDoc("expenses", expense.id), clean(expense));
}
export async function removeSharedExpense(id: string): Promise<void> {
  await deleteDoc(tripDoc("expenses", id));
}
