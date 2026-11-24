// ===== 스와이프 시작 위치 저장을 위해 useRef 추가 =====
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  Plus,
  X,
  Check,
  Trash2,
  // ===== 지출 수정 버튼 아이콘 =====
Pencil,
  Coffee,
  UtensilsCrossed,
  ShoppingBag,
  Train,
  BedDouble,
  Receipt,
} from "lucide-react";

// ===== 경비를 관리할 세 사람 =====
export const PEOPLE = ["정세은", "김서영", "최서은"] as const;

export type PersonName = (typeof PEOPLE)[number];

// ===== 지출 분류 =====
export type ExpenseCategory =
  | "cafe"
  | "food"
  | "shopping"
  | "transit"
  | "stay"
  | "other";

// ===== 공동 분배 또는 개인 부담 =====
export type ExpenseMode = "split" | "personal";
export type ExpenseCurrency = "AUD" | "KRW";
export type SettlementChoice = "unreviewed" | "pending" | "partial" | "complete";


// ===== 실제 저장되는 지출 데이터 =====
export type Expense = {
  id: string;
  title: string;
  // ===== AUD는 센트, KRW는 원. 기존 통화 미지정 기록은 AUD =====
  amountCents: number;
  currency?: ExpenseCurrency;
  paymentDate?: string; // 실제 결제 날짜 YYYY-MM-DD (여행 전 예약비도 가능)
  settlementReviewed?: boolean; // 기존 기록은 미확인으로 유지
  settlementPaid?: Partial<Record<PersonName, number>>; // 부담자가 결제자에게 이미 송금한 금액(최소 화폐 단위)
  payer: PersonName;
  participants: PersonName[];
  category: ExpenseCategory;
  mode: ExpenseMode;
  createdAt: string;
  stopId?: string | null; // ===== 연결된 일정 ID (선택사항) =====
};

// ===== 경비 화면 컴포넌트에 전달할 값 =====

type PickerDay = {
  day: number;
  weekday: string;
  title: string;
  stops: { id: string; time: string; name: string; detail: string }[];
};

// ===== 부모 App.tsx에서 전달받는 경비 기능 =====
type ExpenseTrackerProps = {
  expenses: Expense[];
  itineraryDays: PickerDay[];
  initialStopId?: string | null;
  onInitialStopConsumed?: () => void;

  // ===== 신규 등록 =====
  onAddExpense: (expense: Expense) => void;

  // ===== 기존 기록 수정 =====
  onUpdateExpense: (expense: Expense) => void;

  // ===== 기록 삭제 =====
  onDeleteExpense: (id: string) => void;
};


// ===== 카테고리 표시 이름 =====
const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  cafe: "카페",
  food: "식사",
  shopping: "쇼핑",
  transit: "교통",
  stay: "숙소",
  other: "기타",
};

// ===== AUD 금액 표시 =====
function formatAud(cents: number) {
  const value = (cents / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `A$ ${value}`;
}

// ===== AUD를 KRW 참고 금액으로 변환 =====
function formatKrw(cents: number, rate: number | null) {
  if (rate === null) return null;

  const won = Math.round((cents / 100) * rate);

  return `₩${won.toLocaleString("ko-KR")}`;
}

// ===== 입력한 AUD를 정수 센트로 변환 =====
function parseAmountCents(value: string): number | null {
  const input = value.trim();

  // ===== 소수점 둘째 자리까지만 허용 =====
  if (!/^\d+(\.\d{1,2})?$/.test(input)) {
    return null;
  }

  const [dollars, decimal = ""] = input.split(".");

  const cents = Number(dollars) * 100 + Number(decimal.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) || cents <= 0) {
    return null;
  }

  return cents;
}

// ===== 원화와 호주달러는 각각의 최소 화폐 단위로 보관 =====
function expenseCurrency(expense: Expense): ExpenseCurrency {
  return expense.currency === "KRW" ? "KRW" : "AUD";
}

function formatMoney(amountMinor: number, currency: ExpenseCurrency): string {
  return currency === "KRW"
    ? `₩${amountMinor.toLocaleString("ko-KR")}`
    : formatAud(amountMinor);
}

function parseMoneyMinor(value: string, currency: ExpenseCurrency): number | null {
  if (currency === "KRW") {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const won = Number(trimmed);
    return Number.isSafeInteger(won) && won > 0 ? won : null;
  }
  return parseAmountCents(value);
}

function inputMoneyValue(amountMinor: number, currency: ExpenseCurrency): string {
  return currency === "KRW" ? String(amountMinor) : (amountMinor / 100).toFixed(2);
}

function emptyPeople(): Record<PersonName, number> {
  return { 정세은: 0, 김서영: 0, 최서은: 0 };
}

function getExpenseShares(expense: Expense): Record<PersonName, number> {
  return allocateShares(expense.amountCents, expense.mode === "personal"
    ? expense.participants.slice(0, 1)
    : expense.participants);
}

function getSettlementChoice(expense: Expense): SettlementChoice | "personal" {
  if (expense.mode === "personal" && expense.participants[0] === expense.payer) {
    return "personal";
  }
  if (expense.settlementReviewed !== true) return "unreviewed";
  const shares = getExpenseShares(expense);
  const debtors = PEOPLE.filter(person => person !== expense.payer && shares[person] > 0);
  if (debtors.length === 0) return "complete";
  const paid = debtors.reduce((sum, person) => sum + Math.min(shares[person], Math.max(0, expense.settlementPaid?.[person] ?? 0)), 0);
  const due = debtors.reduce((sum, person) => sum + shares[person], 0);
  return paid >= due ? "complete" : paid > 0 ? "partial" : "pending";
}

function settlementLabel(choice: ReturnType<typeof getSettlementChoice>): string {
  switch (choice) {
    case "complete": return "정산 완료";
    case "partial": return "부분 정산";
    case "pending": return "정산 필요";
    case "personal": return "개인 지출";
    default: return "정산 확인 필요";
  }
}

function localToday(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

// ===== N빵 금액을 센트 단위로 정확하게 배분 =====
function allocateShares(
  amountCents: number,
  participants: readonly PersonName[],
): Record<PersonName, number> {
  const shares: Record<PersonName, number> = {
    정세은: 0,
    김서영: 0,
    최서은: 0,
  };

  // ===== 중복 참여자는 제외하고 고정된 순서 사용 =====
  const people = PEOPLE.filter((person) => participants.includes(person));

  if (people.length === 0) return shares;

  // ===== 균등 금액과 나머지 센트 계산 =====
  const base = Math.floor(amountCents / people.length);
  const remainder = amountCents % people.length;

  people.forEach((person, index) => {
    // ===== 남는 1센트씩 앞 순서부터 배정 =====
    shares[person] = base + (index < remainder ? 1 : 0);
  });

  return shares;
}

// ===== 날짜가 포함된 환율 응답 =====
type FxRate = {
  rate: number;
  date: string;
};

// ===== 공동 경비 메인 화면 =====

// ===== 공동 경비 메인 화면 =====
export default function ExpenseTracker({
  expenses,
  itineraryDays,
  initialStopId,
  onInitialStopConsumed,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}: ExpenseTrackerProps) {

  // ===== 지출 입력창 =====
  const [showModal, setShowModal] = useState(false);
  const [linkedStopId, setLinkedStopId] = useState<string | null>(null);
  const [showStopPicker, setShowStopPicker] = useState(false);
  const [pickerDay, setPickerDay] = useState(16);
  const linkedStop = itineraryDays.flatMap((d) => d.stops.map((s) => ({...s, day:d.day})))
    .find((s) => s.id === linkedStopId);
  // ===== 최종 정산 상세창 열림 / 닫힘 =====
const [showSettlement, setShowSettlement] = useState(false);

// ===== 선택한 사람의 지출 상세 화면 =====
const [selectedPerson, setSelectedPerson] =
  useState<PersonName | null>(null);

// ===== 현재 수정 중인 지출 =====
const [editingExpense, setEditingExpense] =
  useState<Expense | null>(null);

// ===== 현재 수정·삭제 버튼이 열린 지출 =====
const [openSwipeId, setOpenSwipeId] =
  useState<string | null>(null);

// ===== 스와이프 시작 위치 =====
const expenseSwipeStart = useRef<{
  x: number;
  y: number;
} | null>(null);

  // ===== 입력 필드 =====
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");

  const [payer, setPayer] = useState<PersonName>("정세은");

  const [mode, setMode] = useState<ExpenseMode>("split");

  // ===== N빵 기본값: 세 사람 전원 =====
  const [participants, setParticipants] = useState<PersonName[]>([...PEOPLE]);

  // ===== 개인 부담일 때 비용 주인 =====
  const [personalOwner, setPersonalOwner] = useState<PersonName>("정세은");

  const [formError, setFormError] = useState("");
  const [currency, setCurrency] = useState<ExpenseCurrency>("AUD");
  const [paymentDate, setPaymentDate] = useState(localToday);
  const [settlementChoice, setSettlementChoice] = useState<SettlementChoice>("pending");
  const [settlementInputs, setSettlementInputs] = useState<Partial<Record<PersonName, string>>>({});
  const [expenseFilter, setExpenseFilter] = useState<"all" | "unsettled" | "complete" | "unreviewed">("all");

  // ===== AUD → KRW 환율 =====
  const [fx, setFx] = useState<FxRate | null>(null);
  const [fxStatus, setFxStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  // ===== 일정 카드의 '경비 추가'에서 진입하면 연결된 지출 창 자동 열기 =====
  useEffect(() => {
    if (!initialStopId) return;
    resetForm();
    setLinkedStopId(initialStopId);
    setEditingExpense(null);
    setShowStopPicker(false);
    setShowModal(true);
    onInitialStopConsumed?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStopId]);

  // ===== 최신 발표 기준환율 불러오기 =====
  useEffect(() => {
    const controller = new AbortController();

    async function loadExchangeRate() {
      try {
        const response = await fetch(
          "https://api.frankfurter.dev/v2/rate/AUD/KRW",
          { signal: controller.signal },
        );

        if (!response.ok) {
          throw new Error("환율 조회 실패");
        }

        const data = (await response.json()) as {
          rate?: number;
          date?: string;
        };

        if (
          typeof data.rate !== "number" ||
          !Number.isFinite(data.rate) ||
          data.rate <= 0 ||
          typeof data.date !== "string"
        ) {
          throw new Error("환율 데이터 형식 오류");
        }

        if (!controller.signal.aborted) {
          setFx({
            rate: data.rate,
            date: data.date,
          });
          setFxStatus("ready");
        }
      } catch {
        if (!controller.signal.aborted) {
          setFx(null);
          setFxStatus("error");
        }
      }
    }

    loadExchangeRate();

    return () => controller.abort();
  }, []);

  // ===== 통화별 합계 / 결제액 / 부담액 / 이미 송금한 금액 반영 =====
  // 정산 확인을 하지 않은 과거 기록은 전체 지출에는 포함하되 송금 추천에서 제외한다.
  const moneySummary = useMemo(() => {
    const totals = { AUD: 0, KRW: 0 };
    const paid = { AUD: emptyPeople(), KRW: emptyPeople() };
    const owed = { AUD: emptyPeople(), KRW: emptyPeople() };
    const balances = { AUD: emptyPeople(), KRW: emptyPeople() };
    let unreviewedCount = 0;

    for (const expense of expenses) {
      const unit = expenseCurrency(expense);
      const shares = getExpenseShares(expense);
      totals[unit] += expense.amountCents;
      paid[unit][expense.payer] += expense.amountCents;
      PEOPLE.forEach(person => { owed[unit][person] += shares[person]; });
      // 기존 저장 기록의 정산 여부는 추측하지 않는다.
      if (expense.settlementReviewed !== true) {
        if (getSettlementChoice(expense) !== "personal") unreviewedCount++;
        continue;
      }
      balances[unit][expense.payer] += expense.amountCents;
      PEOPLE.forEach(person => { balances[unit][person] -= shares[person]; });
      // 이미 돈을 보낸 기록은 채무/채권 양쪽에서 정확히 차감한다.
      PEOPLE.forEach(person => {
        if (person === expense.payer || shares[person] === 0) return;
        const reported = expense.settlementPaid?.[person] ?? 0;
        const transferred = Number.isSafeInteger(reported) ? Math.min(shares[person], Math.max(0, reported)) : 0;
        balances[unit][person] += transferred;
        balances[unit][expense.payer] -= transferred;
      });
    }
    return { totals, paid, owed, balances, unreviewedCount };
  }, [expenses]);


  // ===== 전체 지출: AUD와 KRW를 환율로 환산해 합산 =====
  // AUD는 센트, KRW는 원 단위로 저장되어 있음.

  const totalCombinedKrw =
    fx && fx.rate > 0
      ? moneySummary.totals.KRW +
        Math.round((moneySummary.totals.AUD / 100) * fx.rate)
      : null;

  // ===== 합산한 원화 총액을 AUD로 환산 =====
  const totalCombinedAudCents =
    totalCombinedKrw !== null && fx
      ? Math.round((totalCombinedKrw / fx.rate) * 100)
      : null;



  type SettlementTransfer = {
    from: PersonName;
    to: PersonName;
    amountMinor: number;
    currency: ExpenseCurrency;
  };

  // ===== AUD / KRW 독립적으로 채권·채무 상계 (환율 합산 금지) =====
  const settlements = useMemo<SettlementTransfer[]>(() => {
    const result: SettlementTransfer[] = [];
    for (const unit of ["AUD", "KRW"] as const) {
      const balances = PEOPLE.map(person => ({ person, amount: moneySummary.balances[unit][person] }));
      const creditors = balances.filter(p => p.amount > 0).sort((a,b) => b.amount-a.amount).map(p=>({...p}));
      const debtors = balances.filter(p => p.amount < 0).map(p=>({person:p.person, amount:-p.amount})).sort((a,b) => b.amount-a.amount);
      let i=0, j=0;
      while (i<debtors.length && j<creditors.length) {
        const amount = Math.min(debtors[i].amount, creditors[j].amount);
        if (amount > 0) result.push({from:debtors[i].person, to:creditors[j].person, amountMinor:amount, currency:unit});
        debtors[i].amount -= amount;
        creditors[j].amount -= amount;
        if (debtors[i].amount === 0) i++;
        if (creditors[j].amount === 0) j++;
      }
    }
    return result;
  }, [moneySummary]);

  const visibleExpenses = useMemo(() => expenses.filter(expense => {
    const status = getSettlementChoice(expense);
    if (expenseFilter === "all") return true;
    if (expenseFilter === "unsettled") return status === "pending" || status === "partial";
    if (expenseFilter === "complete") return status === "complete" || status === "personal";
    return status === "unreviewed";
  }), [expenses, expenseFilter]);

  // ===== 입력 중인 금액 및 분배 미리보기 =====
  const previewCents = parseMoneyMinor(amount, currency) ?? 0;

  const selectedPeople =
    mode === "personal"
      ? [personalOwner]
      : PEOPLE.filter((person) => participants.includes(person));

  const previewShares = allocateShares(previewCents, selectedPeople);

  // ===== 입력창 초기화 =====
  function resetForm() {
    setTitle("");
    setAmount("");
    setCategory("other");
    setPayer("정세은");
    setMode("split");
    setParticipants([...PEOPLE]);
    setPersonalOwner("정세은");
    setFormError("");
    setCurrency("AUD");
    setPaymentDate(localToday());
    setSettlementChoice("pending");
    setSettlementInputs({});
    setLinkedStopId(null);
    setShowStopPicker(false);
  }

  // ===== 새 지출 입력 시작 =====
  
// ===== 새 지출 입력창 열기 =====
function openAddModal() {
  resetForm();
  setEditingExpense(null);
  setOpenSwipeId(null);
  setShowModal(true);
}

// ===== 기존 지출 수정창 열기 =====
function openEditModal(expense: Expense) {
  // ===== 수정할 기록 보관 =====
  setEditingExpense(expense);
  setLinkedStopId(expense.stopId ?? null);

  // ===== 기존 입력값 모두 복원 =====
  setTitle(expense.title);
  const unit = expenseCurrency(expense);
  setCurrency(unit);
  setAmount(inputMoneyValue(expense.amountCents, unit));
  setPaymentDate(expense.paymentDate ?? "");
  const status = getSettlementChoice(expense);
  setSettlementChoice(status === "personal" ? "complete" : status);
  setSettlementInputs(Object.fromEntries(PEOPLE.map(person => [
    person, inputMoneyValue(expense.settlementPaid?.[person] ?? 0, unit)
  ])) as Partial<Record<PersonName, string>>);
  setCategory(expense.category);
  setPayer(expense.payer);
  setMode(expense.mode);
  setParticipants([...expense.participants]);

  // ===== 개인 지출이면 부담자 불러오기 =====
  setPersonalOwner(
    expense.mode === "personal"
      ? expense.participants[0] ?? expense.payer
      : expense.payer
  );

  // ===== 오류와 스와이프 초기화 =====
  setFormError("");
  setOpenSwipeId(null);
  setShowModal(true);
}


  // ===== N빵 참여자 선택 / 해제 =====
  function toggleParticipant(person: PersonName) {
    setParticipants((previous) =>
      previous.includes(person)
        ? previous.filter((name) => name !== person)
        : [...previous, person],
    );
  }

  // ===== 지출 저장 =====
  
// ===== 새 지출 등록 또는 기존 지출 수정 저장 =====
function handleSubmit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setFormError("");

  // ===== 각 통화의 최소 화폐 단위로 변환 (AUD 센트 / KRW 원) =====
  const cents = parseMoneyMinor(amount, currency);

  if (!title.trim()) {
    setFormError("사용 내역을 입력해 줘.");
    return;
  }

  if (cents === null) {
    setFormError(currency === "KRW" ? "원화는 정수 금액으로 입력해 줘." : "호주달러는 소수점 둘째 자리까지 입력해 줘.");
    return;
  }

  // ===== 선택된 비용 부담자 계산 =====
  const finalParticipants: PersonName[] =
    mode === "personal"
      ? [personalOwner]
      : PEOPLE.filter((person) =>
          participants.includes(person)
        );

  // ===== 공동 비용은 최소 두 명이 참여 =====
  if (
    mode === "split" &&
    finalParticipants.length < 2
  ) {
    setFormError("N빵은 최소 2명을 선택해야 해.");
    return;
  }

  // ===== 이미 완료된 송금과 아직 남은 송금을 구분 =====
  const shares = allocateShares(cents, finalParticipants);
  const settlementPaid: Partial<Record<PersonName, number>> = {};
  if (settlementChoice === "complete") {
    PEOPLE.forEach(person => {
      if (person !== payer && shares[person] > 0) settlementPaid[person] = shares[person];
    });
  } else if (settlementChoice === "partial") {
    for (const person of PEOPLE) {
      if (person === payer || shares[person] === 0) continue;
      const raw = (settlementInputs[person] ?? "").trim();
      // 부분 정산: 각 사람이 실제 송금한 금액만 입력
      const value = raw === "" || raw === "0" || raw === "0.00" ? 0 : parseMoneyMinor(raw, currency);
      if (value === null || value > shares[person]) {
        setFormError(`${person} 송금액이 잘못됐어. 해당 인원의 부담액 이내로 입력해 줘.`);
        return;
      }
      if (value > 0) settlementPaid[person] = value;
    }
  }

  // ===== 새 등록과 수정에서 공통으로 사용할 데이터 =====
  const values = {
    currency,
    paymentDate: paymentDate || undefined,
    settlementReviewed: settlementChoice !== "unreviewed",
    settlementPaid,
    title: title.trim(),
    amountCents: cents,
    category,
    payer,
    mode,
    participants: finalParticipants,
    stopId: linkedStopId,
  };

  if (editingExpense) {
    // ===== 수정: 기존 ID와 등록일 유지 =====
    onUpdateExpense({
      ...editingExpense,
      ...values,
    });
  } else {
    // ===== 신규 등록: 새 ID와 등록일 생성 =====
    onAddExpense({
      id: crypto.randomUUID(),
      ...values,
      createdAt: new Date().toISOString(),
    });
  }

  // ===== 저장 완료 후 입력창 닫기 =====
  resetForm();
  setEditingExpense(null);
  setOpenSwipeId(null);
  setShowModal(false);
}

  // ===== 지출 삭제 =====
  function handleDelete(expense: Expense) {
    if (window.confirm(`"${expense.title}" 지출을 삭제할까요?`)) {
      onDeleteExpense(expense.id);
    }
  }

  return (
    <div className="exp-page">
      {/* ===== 상단 제목과 오른쪽 환율 표시 ===== */}
      <div className="page-intro exp-intro">
        <h1>
          경비<span className="period">.</span>
        </h1>

        <p>
          {fxStatus === "loading"
            ? "AUD 환율 조회 중..."
            : fxStatus === "error" || !fx
              ? "환율을 불러오지 못했어"
              : `1 AUD ≈ ₩${fx.rate.toLocaleString("ko-KR", {
                  maximumFractionDigits: 2,
                })} · ${fx.date} 기준`}
        </p>
      </div>

      
      {/* ===== 전체 여행 지출: 통합 합계 + 통화별 내역 ===== */}
      <section className="exp-total">

        <span>전체 여행 지출</span>

        {/* ===== 메인: 전체 금액을 AUD로 환산 ===== */}
        <strong>
          {totalCombinedAudCents !== null
            ? formatAud(totalCombinedAudCents)
            : fxStatus === "error"
              ? "환율 조회 실패"
              : "환율 계산 중..."}
        </strong>

        {/* ===== 작은 글씨: 전체 금액을 KRW로 환산 ===== */}
        <strong className="exp-total-krw">
          {totalCombinedKrw !== null
            ? `약 ${formatMoney(totalCombinedKrw, "KRW")}`
            : "원화 합계 계산 대기"}
        </strong>

        {/* ===== 실제로 결제한 통화별 금액 ===== */}
        <small className="exp-total-breakdown">
          <span>
            AUD 지출 · {formatAud(moneySummary.totals.AUD)}
          </span>

          <span>
            KRW 지출 · {formatMoney(
              moneySummary.totals.KRW,
              "KRW"
            )}
          </span>
        </small>

      </section>

      {/* ===== 개인별 소비 총액 카드 ===== */}
      <section className="exp-section">
        <div className="exp-people-grid">
          {PEOPLE.map((person) => {
            // ===== 본인이 부담할 AUD / KRW 원금액 =====
            const owedAud = moneySummary.owed.AUD[person];
            const owedKrw = moneySummary.owed.KRW[person];

            // ===== 환율을 이용한 통합 소비 총액 =====
            const totalAud = fx
              ? Math.round(owedAud + (owedKrw / fx.rate) * 100)
              : null;

            const totalKrw = fx
              ? Math.round(owedKrw + (owedAud / 100) * fx.rate)
              : null;

            return (
              <button
                type="button"
                key={person}
                className="exp-person-card exp-person-card-button"
                onClick={() => setSelectedPerson(person)}
                aria-label={`${person} 지출 상세 보기`}
              >
                <span className="exp-person-name">
                  {person}
                </span>

                {/* ===== AUD로 환산한 전체 소비 ===== */}
                <strong>
                  {totalAud !== null
                    ? formatAud(totalAud)
                    : "합산 대기"}
                </strong>

                {/* ===== 아래 작게 원화 환산 총액 ===== */}
                <small className="exp-won">
                  {totalKrw !== null
                    ? `약 ${formatMoney(totalKrw, "KRW")}`
                    : `${formatAud(owedAud)} + ${formatMoney(owedKrw, "KRW")}`}
                </small>

                <span className="exp-person-card-hint">
                  내역 보기 ›
                </span>
              </button>
            );
          })}
        </div>
 

{/* ===== 개인별 카드 아래의 작은 정산 버튼 ===== */}
<div className="exp-settlement-link-line">
  <button
    type="button"
    className="exp-settlement-link"
    onClick={() => setShowSettlement(true)}
  >
    정산하기
    <span aria-hidden="true">→</span>
  </button>
</div>


      </section>

{/* ===== 세 사람의 최종 송금 정산 ===== */}

{/* ===== 개인별 소비 상세 화면 ===== */}
{selectedPerson && (() => {
  // ===== 각 지출에서 선택한 사람이 부담하는 금액 =====
  const rows = expenses.map((expense) => ({
    expense,
    currency: expenseCurrency(expense),
    share: getExpenseShares(expense)[selectedPerson],
  }));

  // ===== 공동 비용 / 개인 소비 분리 =====
  const groups = [
    {
      key: "split",
      title: "N빵 소비",
      description: "N빵 비용 중 내가 부담하는 금액",
      items: rows.filter(
        (row) =>
          row.expense.mode === "split" &&
          row.share > 0
      ),
    },
    {
      key: "personal",
      title: "개인 소비",
      description: "나혼자 소비한 것들",
      items: rows.filter(
        (row) =>
          row.expense.mode === "personal" &&
          row.share > 0
      ),
    },
  ] as const;

  // ===== 직접 결제한 지출 =====
  const paidItems = rows.filter(
    (row) => row.expense.payer === selectedPerson
  );

  // ===== 본인 총 소비액 =====
  const owedAud = moneySummary.owed.AUD[selectedPerson];
  const owedKrw = moneySummary.owed.KRW[selectedPerson];

  // ===== AUD / KRW 합산 환산 =====
  const combinedKrw = fx
    ? owedKrw + Math.round((owedAud / 100) * fx.rate)
    : null;

  const combinedAud = fx
    ? owedAud + Math.round((owedKrw / fx.rate) * 100)
    : null;

  return (
    <div
      className="exp-modal-backdrop"
      onClick={() => setSelectedPerson(null)}
    >
      <section
        className="exp-modal exp-person-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exp-person-detail-title"
        onClick={(event) => event.stopPropagation()}
      >
        {/* ===== 상단 이름과 닫기 버튼 ===== */}
        <div className="exp-modal-header">
          <h2 id="exp-person-detail-title">
            {selectedPerson} · 소비 내역
          </h2>

          <button
            type="button"
            aria-label="닫기"
            onClick={() => setSelectedPerson(null)}
          >
            <X size={21} />
          </button>
        </div>

        {/* ===== 1. 본인 전체 소비 금액 ===== */}
        <div className="exp-person-spending-total">
          <small>나의 전체 소비</small>

          <strong>
            {combinedAud === null
              ? "환율 조회 후 합산"
              : formatAud(combinedAud)}
          </strong>

          <span>
            {combinedKrw === null
              ? "원화 합산 대기"
              : `약 ${formatMoney(combinedKrw, "KRW")}`}
          </span>

          {/* ===== 실제 결제 통화별 소비 ===== */}
          <div className="exp-person-original-amounts">
            <span>
              실제 AUD 소비 · {formatAud(owedAud)}
            </span>

            <span>
              실제 KRW 소비 · {formatMoney(owedKrw, "KRW")}
            </span>
          </div>
        </div>

        {/* ===== 2. 공동 비용과 개인 소비 구분 ===== */}
        {groups.map((group) => {
          // ===== 해당 그룹의 AUD 소비 합계 =====
          const aud = group.items.reduce(
            (sum, row) =>
              sum +
              (row.currency === "AUD" ? row.share : 0),
            0
          );

          // ===== 해당 그룹의 KRW 소비 합계 =====
          const krw = group.items.reduce(
            (sum, row) =>
              sum +
              (row.currency === "KRW" ? row.share : 0),
            0
          );

          return (
            <section
              className="exp-person-spending-group"
              key={group.key}
            >
              {/* ===== 그룹 제목과 합계 ===== */}
              <div className="exp-person-spending-group-head">
                <div>
                  <h3>{group.title}</h3>
                  <small>{group.description}</small>
                </div>

                <div className="exp-person-group-totals">
                  {aud > 0 && (
                    <strong>{formatAud(aud)}</strong>
                  )}

                  {krw > 0 && (
                    <strong>
                      {formatMoney(krw, "KRW")}
                    </strong>
                  )}

                  {aud === 0 && krw === 0 && (
                    <strong>내역 없음</strong>
                  )}
                </div>
              </div>

              {/* ===== 그룹별 지출 내역 ===== */}
              {group.items.length === 0 ? (
                <p className="exp-person-spending-empty">
                  등록된 내역이 없어.
                </p>
              ) : (
                <div className="exp-person-detail-list">
                  {group.items.map(
                    ({ expense, currency, share }) => (
                      <div
                        className="exp-person-spending-row"
                        key={expense.id}
                      >
                        <div className="exp-person-spending-row-main">
                          <strong>{expense.title}</strong>

                          {/* ===== 내가 실제 부담하는 금액 ===== */}
                          <b>
                            {formatMoney(share, currency)}
                          </b>
                        </div>

                        <small>
                          {CATEGORY_LABELS[expense.category]}

                          {expense.paymentDate
                            ? ` · ${expense.paymentDate}`
                            : ""}

                          {` · 결제 ${expense.payer}`}
                        </small>

                        {/* ===== N빵이면 원래 전체 금액 표시 ===== */}
                        {expense.mode === "split" && (
                          <small>
                            전체 지출{" "}
                            {formatMoney(
                              expense.amountCents,
                              currency
                            )}
                          </small>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </section>
          );
        })}

        {/* ===== 3. 내가 직접 결제한 내역 ===== */}
        <details className="exp-person-payment-details">
          <summary>
            <span>내가 직접 결제한 내역</span>

            <span className="exp-person-payment-summary-amounts">
              {moneySummary.paid.AUD[selectedPerson] > 0 && (
                <b>
                  {formatAud(
                    moneySummary.paid.AUD[selectedPerson]
                  )}
                </b>
              )}

              {moneySummary.paid.KRW[selectedPerson] > 0 && (
                <b>
                  {formatMoney(
                    moneySummary.paid.KRW[selectedPerson],
                    "KRW"
                  )}
                </b>
              )}

              {paidItems.length === 0 && (
                <b>내역 없음</b>
              )}
            </span>
          </summary>

          <p className="exp-person-detail-note">
            직접 결제한 목록들이고 개인 결제랑 N빵 리스트도 포함되어있어.
          </p>

          {/* ===== 직접 결제 목록 ===== */}
          {paidItems.length === 0 ? (
            <p className="exp-person-spending-empty">
              직접 결제한 기록이 없어.
            </p>
          ) : (
            <div className="exp-person-detail-list">
              {paidItems.map(({ expense, currency }) => (
                <div
                  className="exp-person-spending-row"
                  key={expense.id}
                >
                  <div className="exp-person-spending-row-main">
                    <strong>{expense.title}</strong>

                    <b>
                      {formatMoney(
                        expense.amountCents,
                        currency
                      )}
                    </b>
                  </div>

                  <small>
                    {CATEGORY_LABELS[expense.category]}
                    {" · "}
                    {expense.mode === "split"
                      ? "공동 결제"
                      : "개인 결제"}

                    {expense.paymentDate
                      ? ` · ${expense.paymentDate}`
                      : ""}
                  </small>
                </div>
              ))}
            </div>
          )}
        </details>

        {/* ===== 하단 닫기 버튼 ===== */}
        <button
          type="button"
          className="exp-save-button"
          onClick={() => setSelectedPerson(null)}
        >
          닫기
        </button>
      </section>
    </div>
  );
})()}

{/* ===== 최종 정산 버튼을 누를 때만 표시되는 창 ===== */}
{showSettlement && (
  <div
    className="exp-modal-backdrop"
    onClick={() => setShowSettlement(false)}
  >
    <section
      className="exp-modal exp-settlement-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settlement-modal-title"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ===== 정산창 제목 및 닫기 ===== */}
      <div className="exp-modal-header">
        <h2 id="settlement-modal-title">최종 정산</h2>

        <button
          type="button"
          aria-label="닫기"
          onClick={() => setShowSettlement(false)}
        >
          <X size={21} />
        </button>
      </div>

      <p className="exp-settlement-description">
        정산 상태를 확인한 경비만 계산했어. 이미 송금한 돈은 제외했고 AUD와 KRW는 따로 계산해.
      </p>

      {/* ===== 사람별 결제액과 부담액 정리 ===== */}
      <div className="exp-settlement-summary">
        {PEOPLE.map((person) => (
          <div className="exp-settlement-person" key={person}>
            <div>
              <strong>{person}</strong>
              <small>결제 {formatAud(moneySummary.paid.AUD[person])} · 부담 {formatAud(moneySummary.owed.AUD[person])}</small>
              <small>결제 {formatMoney(moneySummary.paid.KRW[person], "KRW")} · 부담 {formatMoney(moneySummary.owed.KRW[person], "KRW")}</small>
            </div>
            <span>
              {moneySummary.balances.AUD[person] > 0 ? "AUD 받을 돈 " : moneySummary.balances.AUD[person] < 0 ? "AUD 보낼 돈 " : "AUD 정산 없음"}
              {moneySummary.balances.AUD[person] !== 0 && formatMoney(Math.abs(moneySummary.balances.AUD[person]), "AUD")}
              <br />
              {moneySummary.balances.KRW[person] > 0 ? "KRW 받을 돈 " : moneySummary.balances.KRW[person] < 0 ? "KRW 보낼 돈 " : "KRW 정산 없음"}
              {moneySummary.balances.KRW[person] !== 0 && formatMoney(Math.abs(moneySummary.balances.KRW[person]), "KRW")}
            </span>
          </div>
        ))}
      </div>

      {moneySummary.unreviewedCount > 0 && (
        <p className="exp-form-error">정산 여부를 확인하지 않은 기존 경비 {moneySummary.unreviewedCount}건은 송금 계산에서 제외했어. 지출 내역에서 수정해 상태를 지정해 줘.</p>
      )}

      {/* ===== 실제 송금 안내 ===== */}
      <h3 className="exp-settlement-subtitle">
        송금 내역
      </h3>

      <div className="exp-settlement-list">
        {settlements.length === 0 ? (
          <p className="exp-settlement-empty">
            {expenses.length === 0
              ? "지출을 등록하면 정산 결과가 표시돼."
              : "현재 서로 송금할 금액이 없어."}
          </p>
        ) : (
          settlements.map((transfer) => (
            <div
              className="exp-settlement-row"
              key={`${transfer.currency}-${transfer.from}-${transfer.to}`}
            >
              {/* ===== 보내는 사람과 받는 사람 ===== */}
              <div className="exp-settlement-people">
                <strong>{transfer.from}</strong>
                <span>→</span>
                <strong>{transfer.to}</strong>
              </div>

              {/* ===== AUD 및 참고용 원화 금액 ===== */}
              <div className="exp-settlement-amount">
                <strong>
                  {formatMoney(transfer.amountMinor, transfer.currency)}
                </strong>

                {fx && transfer.currency === "AUD" && (
                  <small>{formatKrw(transfer.amountMinor, fx.rate)}</small>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ===== 정산창 닫기 ===== */}
      <button
        type="button"
        className="exp-save-button"
        onClick={() => setShowSettlement(false)}
      >
        확인
      </button>
    </section>
  </div>
)}


      {/* ===== 지출 내역 ===== */}
      <section className="exp-section exp-history">
        <div className="exp-section-header">
          <h2>지출 내역</h2>

          <button
            type="button"
            className="exp-add-button"
            onClick={openAddModal}
          >
            <Plus size={16} />
          </button>
        </div>

        {/* ===== 정산 상태별 필터: 목록만 바꾸며 총경비는 유지 ===== */}
        <div className="exp-status-filters">
          {([
            ["all", "전체"], ["unsettled", "미정산"],
            ["complete", "정산 완료"], ["unreviewed", "기타"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button"
              className={expenseFilter === value ? "active" : ""}
              onClick={() => setExpenseFilter(value)}>{label}</button>
          ))}
        </div>
        {/* ===== 기록이 없는 경우 ===== */}
        {expenses.length === 0 ? (
          <div className="exp-empty">
            아직 기록된 지출이 없어.
            <br />
            추가 버튼으로 첫 지출을 등록해.
          </div>
        ) : visibleExpenses.length === 0 ? (
          <div className="exp-empty">조건에 맞는 지출이 없어.</div>
        ) : (

<div className="exp-list">
    {/* ===== 왼쪽 스와이프로 수정·삭제하는 경비 목록 ===== */}
  {visibleExpenses.map((expense) => (
    <div
      key={expense.id}
      className="exp-swipe"

      // ===== 스와이프 시작 위치 저장 =====
      onPointerDown={(event) => {
        if (
          event.pointerType === "mouse" &&
          event.button !== 0
        ) {
          return;
        }

        expenseSwipeStart.current = {
          x: event.clientX,
          y: event.clientY,
        };
      }}

      // ===== 밀어낸 거리로 방향 판단 =====
      onPointerUp={(event) => {
        const start = expenseSwipeStart.current;
        expenseSwipeStart.current = null;

        if (!start) return;

        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;

        // ===== 일반 터치나 세로 스크롤은 무시 =====
        if (
          Math.abs(dx) < 40 ||
          Math.abs(dx) <= Math.abs(dy)
        ) {
          return;
        }

        // ===== 왼쪽으로 밀면 열고 오른쪽으로 밀면 닫기 =====
        setOpenSwipeId(
          dx < 0 ? expense.id : null
        );
      }}

      // ===== 스크롤로 포인터가 취소되면 초기화 =====
      onPointerCancel={() => {
        expenseSwipeStart.current = null;
      }}
    >
      {/* ===== 지출 항목 오른쪽의 숨겨진 버튼 ===== */}
      <div
        className="exp-swipe-actions"
        aria-hidden={openSwipeId !== expense.id}
      >
        {/* ===== 기존 지출 수정 ===== */}
        <button
          type="button"
          className="exp-swipe-edit"
          tabIndex={openSwipeId === expense.id ? 0 : -1}
          aria-label={`${expense.title} 수정`}
          onClick={() => openEditModal(expense)}
        >
          <Pencil size={17} />
          <span>수정</span>
        </button>

        {/* ===== 기존 지출 삭제 ===== */}
        <button
          type="button"
          className="exp-swipe-delete"
          tabIndex={openSwipeId === expense.id ? 0 : -1}
          aria-label={`${expense.title} 삭제`}
          onClick={() => {
            handleDelete(expense);
            setOpenSwipeId(null);
          }}
        >
          <Trash2 size={17} />
          <span>삭제</span>
        </button>
      </div>

      {/* ===== 좌우로 움직이는 실제 지출 내용 ===== */}
      <div
        className={`exp-swipe-content ${
          openSwipeId === expense.id ? "is-open" : ""
        }`}
      >
        <div className="exp-item">

          {/* ===== 카테고리 아이콘 ===== */}
          <div className="exp-item-icon">
            {expense.category === "cafe" ? (
              <Coffee size={19} />
            ) : expense.category === "food" ? (
              <UtensilsCrossed size={19} />
            ) : expense.category === "shopping" ? (
              <ShoppingBag size={19} />
            ) : expense.category === "transit" ? (
              <Train size={19} />
            ) : expense.category === "stay" ? (
              <BedDouble size={19} />
            ) : (
              <Receipt size={19} />
            )}
          </div>

          {/* ===== 지출 이름과 분배 정보 ===== */}
          <div className="exp-item-info">
            <span className="exp-item-category">
              {CATEGORY_LABELS[expense.category]}
              {" · "}
                {expense.mode === "split" ? "N빵" : "개인"}
                {" · "}
                <button type="button" className={`exp-status-tag is-${getSettlementChoice(expense)}`}
                  title="눌러서 정산 상태 수정" onClick={() => openEditModal(expense)}>
                  {settlementLabel(getSettlementChoice(expense))}
                </button>
              </span>

            <strong>{expense.title}</strong>

              <small>결제 {expense.payer}{expense.paymentDate ? ` · ${expense.paymentDate}` : ""}{expense.paymentDate && expense.paymentDate < "2026-12-15" ? " · 사전 결제" : ""}</small>
            {expense.stopId && (
              <small>일정 · {itineraryDays.flatMap((d) => d.stops.map((s) => ({...s,day:d.day})))
                .find((s) => s.id === expense.stopId)?.name ?? '삭제된 일정'}</small>
            )}

            <small>
              참여 {expense.participants.join(", ")}
            </small>
          </div>

          {/* ===== 금액과 원화 환산액 ===== */}
          <div className="exp-item-right">
            <strong>
                {formatMoney(expense.amountCents, expenseCurrency(expense))}
            </strong>

              {fx && expenseCurrency(expense) === "AUD" && (
                <small className="exp-won">{formatKrw(expense.amountCents, fx.rate)}</small>
              )}
          </div>
        </div>
      </div>
    </div>
  ))}
</div>

        )}
      </section>

      {/* ===== 환율 사용 방식 설명 ===== */}

      {/* ===== 지출 추가 모달 ===== */}
      {showModal && (
        <div className="exp-modal-backdrop" onClick={() => setShowModal(false)}>
          <section
            className="exp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="exp-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            {/* ===== 모달 제목 ===== */}
            <div className="exp-modal-header">
              {/* ===== 추가 / 수정 상태에 따라 제목 변경 ===== */}
<h2 id="exp-modal-title">
  {editingExpense ? "지출 수정" : "새 지출 등록"}
</h2>

              <button
                type="button"
                aria-label="닫기"
                onClick={() => setShowModal(false)}
              >
                <X size={21} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* ===== 지출 내역 ===== */}
              <label className="exp-field">
                사용 내역
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="예: 브런치, 카페, 택시"
                  required
                />
              </label>

              {/* ===== 금액 ===== */}
              <label className="exp-field">
                금액 ({currency})
                <input
                  type="number"
                  min={currency === "KRW" ? "1" : "0.01"}
                  step={currency === "KRW" ? "1" : "0.01"}
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>

              {/* ===== 통화와 실제 결제 날짜 ===== */}
              <div className="exp-field-grid">
                <label className="exp-field">통화
                  <select value={currency} onChange={e => {setCurrency(e.target.value as ExpenseCurrency); setAmount(""); setSettlementInputs({});}}>
                    <option value="AUD">AUD · 호주달러</option>
                    <option value="KRW">KRW · 원화</option>
                  </select>
                </label>
                <label className="exp-field">결제 날짜
                  <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} />
                </label>
              </div>
              <p className="exp-field-help">실제 결제일을 알면 입력해. 예전 기록은 날짜가 비어 있어도 돼. 통화를 변경하면 금액 입력은 초기화돼.</p>

              {/* ===== 카테고리와 결제자 ===== */}
              <div className="exp-field-grid">
                <label className="exp-field">
                  카테고리
                  <select
                    value={category}
                    onChange={(event) =>
                      setCategory(event.target.value as ExpenseCategory)
                    }
                  >
                    <option value="cafe">카페</option>
                    <option value="food">식사</option>
                    <option value="shopping">쇼핑</option>
                    <option value="transit">교통</option>
                    <option value="stay">숙소</option>
                    <option value="other">기타</option>
                  </select>
                </label>

                <label className="exp-field">
                  결제자
                  <select
                    value={payer}
                    onChange={(event) =>
                      setPayer(event.target.value as PersonName)
                    }
                  >
                    {PEOPLE.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* ===== 선택사항: 일정 선택 화면을 별도 열어 연결 ===== */}
              <div className="trip-exp-link">
                <div className="trip-exp-link-heading">
                  <strong>일정 연결</strong><small>선택사항</small>
                </div>
                {linkedStopId && (
                  <div className="trip-exp-chosen">
                    <span>{linkedStop ? `12월 ${linkedStop.day}일 · ${linkedStop.time} ${linkedStop.name}` : '연결된 일정이 삭제됨'}</span>
                    <button type="button" onClick={() => setLinkedStopId(null)}>해제</button>
                  </div>
                )}
                <button type="button" className="trip-exp-picker-button"
                  onClick={() => {
                    const linkedDay = itineraryDays.find((d) => d.stops.some((s) => s.id === linkedStopId));
                    setPickerDay(linkedDay?.day ?? 16);
                    setShowStopPicker(true);
                  }}>
                  {linkedStopId ? '다른 일정 선택하기' : '일정과 연결하기'}
                </button>
              </div>

              {/* ===== N빵 / 개인 지출 선택 ===== */}
              <div className="exp-split-section">
                <span className="exp-field-title">비용 구분</span>

                <div className="exp-mode-options">
                  <button
                    type="button"
                    className={mode === "split" ? "active" : ""}
                    aria-pressed={mode === "split"}
                    onClick={() => {
                      setMode("split");
                      setFormError("");
                    }}
                  >
                    N빵
                  </button>

                  <button
                    type="button"
                    className={mode === "personal" ? "active" : ""}
                    aria-pressed={mode === "personal"}
                    onClick={() => {
                      setMode("personal");

                      // ===== 개인 비용 기본값은 결제자 =====
                      setPersonalOwner(payer);
                      setFormError("");
                    }}
                  >
                    개인
                  </button>
                </div>
              </div>

              {/* ===== 비용 분담 대상 선택 ===== */}
              {mode === "split" ? (
                <div className="exp-split-section">
                  <span className="exp-field-title">N빵 참여자</span>

                  <p className="exp-field-help">
                    기본 3명 · 원하는 사람만 선택
                  </p>

                  <div className="exp-participant-options">
                    {PEOPLE.map((person) => (
                      <label key={person} className="exp-participant">
                        <input
                          type="checkbox"
                          checked={participants.includes(person)}
                          onChange={() => toggleParticipant(person)}
                        />

                        <span>{person}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <label className="exp-field">
                  이 비용을 부담할 사람
                  <select
                    value={personalOwner}
                    onChange={(event) =>
                      setPersonalOwner(event.target.value as PersonName)
                    }
                  >
                    {PEOPLE.map((person) => (
                      <option key={person} value={person}>
                        {person}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {/* ===== 송금 여부: 이미 보낸 금액은 최종 정산에서 빼기 ===== */}
              <div className="exp-split-section">
                <span className="exp-field-title">친구끼리 정산한 상태</span>
                <label className="exp-field">
                  <select value={settlementChoice} onChange={e => setSettlementChoice(e.target.value as SettlementChoice)}>
                    {editingExpense && <option value="unreviewed">아직 확인하지 않음</option>}
                    <option value="pending">정산 필요 · 아직 안 보냄</option>
                    <option value="complete">정산 완료 · 전부 받음</option>
                    <option value="partial">부분 정산 · 일부만 받음</option>
                  </select>
                </label>
                {settlementChoice === "complete" && <p className="exp-field-help">결제자에게 각 부담자의 몫이 모두 송금된 것으로 기록돼.</p>}
                {settlementChoice === "partial" && (
                  <div className="exp-settlement-inputs">
                    <p className="exp-field-help">결제자 {payer}에게 송금한 금액을 입력해.</p>
                    {PEOPLE.filter(person => person !== payer && previewShares[person] > 0).map(person => (
                      <label className="exp-field" key={person}>{person} · 송금 금액 {formatMoney(previewShares[person],currency)}
                        <input type="number" inputMode="decimal" min="0"
                          max={inputMoneyValue(previewShares[person],currency)}
                          step={currency === "KRW" ? "1" : "0.01"}
                          value={settlementInputs[person] ?? ""}
                          onChange={e=>setSettlementInputs(prev=>({...prev,[person]:e.target.value}))}
                          placeholder="이미 송금한 금액" />
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* ===== 개인별 분담 금액 미리보기 ===== */}
              <div className="exp-preview">
                <strong>인당 금액 미리보기</strong>

                {PEOPLE.map((person) => (
                  <div className="exp-preview-row" key={person}>
                    <span>{person}</span>
                    <b>{formatMoney(previewShares[person], currency)}</b>
                  </div>
                ))}
              </div>

              {/* ===== 입력 오류 안내 ===== */}
              {formError && (
                <p className="exp-form-error" role="alert">
                  {formError}
                </p>
              )}

              {/* ===== 지출 저장 ===== */}
              
{/* ===== 새 지출 등록 또는 기존 지출 수정 저장 ===== */}
<button className="exp-save-button" type="submit">
  <Check size={17} />
  {editingExpense ? "수정 저장" : "지출 저장"}
</button>

            </form>
          </section>
        </div>
      )}

      {/* ===== 기존 일정 화면과 같은 날짜 칩·일정 카드 구성의 전체 화면 선택창 ===== */}
      {showStopPicker && (
        <div className="trip-exp-picker-overlay" role="dialog" aria-modal="true" aria-label="연결할 일정 선택">
          <div className="trip-exp-picker-page">
            <div className="trip-exp-picker-head">
              <div><span>SELECT AN ITINERARY</span><h2>일정 선택</h2></div>
              <button type="button" onClick={() => setShowStopPicker(false)} aria-label="돌아가기">✕</button>
            </div>
            <div className="date-strip" aria-label="날짜 선택">
              {itineraryDays.map((d) => (
                <button type="button" key={d.day}
                  className={`date-chip ${pickerDay === d.day ? 'active' : ''}`}
                  onClick={() => setPickerDay(d.day)}>
                  <span>{d.weekday}</span><strong>{d.day}</strong>
                </button>
              ))}
            </div>
            <div className="day-summary detail">
              <div><span>DEC {pickerDay} · 2026</span>
                <h3>{itineraryDays.find((d) => d.day === pickerDay)?.title}</h3>
                <p>연결할 장소를 눌러줘.</p>
              </div>
            </div>
            <div className="trip-exp-picker-list">
              {(itineraryDays.find((d) => d.day === pickerDay)?.stops ?? []).map((s) => (
                <button key={s.id} type="button" className="trip-exp-picker-stop"
                  onClick={() => {setLinkedStopId(s.id); setShowStopPicker(false);}}>
                  <span className="trip-exp-picker-time">{s.time}</span>
                  <span className="trip-exp-picker-desc"><strong>{s.name}</strong><small>{s.detail}</small></span>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
            <button type="button" className="trip-exp-picker-back" onClick={() => setShowStopPicker(false)}>
              경비 입력으로 돌아가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
