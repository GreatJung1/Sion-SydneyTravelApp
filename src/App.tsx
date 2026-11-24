import SydneyWeather from "./components/SydneyWeather";
import DailyRouteMap from "./components/DailyRouteMap";

/* ===== Firebase 공동 일정/방문/경비 동기화 ===== */
import {
  watchSharedTrip,
  initializeTripOnce,
  saveSharedStop,
  removeSharedStop,
  toggleSharedVisit,
  addSharedExpense,
  editSharedExpense,
  removeSharedExpense,
} from "./tripCloud";

/* ===== 새 경비 관리 화면 ===== */
import ExpenseTracker from "./components/ExpenseTracker";

/* ===== 경비 데이터 타입 ===== */
import type { Expense } from "./components/ExpenseTracker";

/* ===== 경비 화면 전용 디자인 ===== */
import "./expense-tracker.css";

/* ===== 지도에서 핀 선택하는 컴포넌트 ===== */
import MapPicker from "./components/MapPicker";

/* ===== 저장된 장소를 지도에 표시하는 컴포넌트 ===== */
import MapCollection from "./components/MapCollection";

/* ===== 지도 위치 데이터 타입 ===== */
import type { MapLocation } from "./components/MapPicker";

/* ===== 지도 기능 CSS ===== */
import "./map-picker.css";

/* ===== React 상태 및 스와이프 위치 관리 ===== */
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Compass,
  Heart,
  MapPin,
  Navigation,
  Plus,
  Route,
  Star,
  Wallet,
  X,
  Pencil,
  Trash2,
  Copy,
} from "lucide-react";
import "./index.css";

type Tab = "home" | "plan" | "money" | "shoot" | "saved";

type Stop = {
  id: string;
  time: string;
  name: string;
  detail: string;
  category: "food" | "cafe" | "travel" | "store" | "spot" | "stay";

  // ===== 지도 연결 정보: 입력하지 않아도 됨 =====
  mapUrl?: string;
  // ===== 사용자가 지도에서 선택한 실제 위치 =====
  mapLocation?: MapLocation;
};

type Day = {
  day: number;
  weekday: string;
  title: string;
  subtitle: string;
  stops: Stop[];
};
type Reel = {
  id: string;
  name: string;
  place: string;
  done: number;
  total: number;
  type: string;
};

const seedDays: Day[] = [
  {
    // ===== 12월 15일: 출국 및 시드니 도착 =====
    day: 15,
    weekday: "TUE",
    title: "Welcome to Sydney",
    subtitle: "인천 출발 · 시드니 도착",
    stops: [
      {
        id: "15a",
        time: "08:00",
        name: "인천공항 T2 출발",
        detail: "대한항공 KE401 · 시드니행 · 한국 시간",
        category: "travel",
      },
      {
        id: "15b",
        time: "20:05",
        name: "Sydney Airport T1 도착",
        detail: "KE401 · 입국심사 및 수하물 수령 · 시드니 시간",
        category: "travel",
      },
      {
        id: "15c",
        time: "미정",
        name: "Veriu Green Square",
        detail: "공항에서 숙소 이동 · 체크인 · 짐 정리",
        category: "stay",
      },
      {
        id: "15d",
        time: "미정",
        name: "Woolworths Green Square",
        detail: "물 · 과일 · 요거트 · 빵 · 간식 구매",
        category: "spot",
      },
      {
        id: "15e",
        time: "미정",
        name: "숙소 복귀 및 휴식",
        detail: "간단한 야식 · 취침",
        category: "stay",
      },
    ],
  },

  {
    day: 16,
    weekday: "WED",
    title: "Hello, Harbour!",
    subtitle: "시드니의 첫 풍경",
    stops: [
      {
        id: "16a",
        time: "09:30",
        name: "Barangaroo",
        detail: "산책 · 사진 촬영",
        category: "spot",
      },
      {
        id: "16b",
        time: "11:00",
        name: "The Rocks",
        detail: "거리 구경 · 카페",
        category: "spot",
      },
      {
        id: "16c",
        time: "14:00",
        name: "Sydney Opera House",
        detail: "대표 포토스폿 · 릴스 촬영",
        category: "spot",
      },
      {
        id: "16d",
        time: "16:00",
        name: "Royal Botanic Garden",
        detail: "Mrs Macquarie’s Point",
        category: "spot",
      },
    ],
  },
  {
    day: 17,
    weekday: "THU",
    title: "Wild & Wonderful",
    subtitle: "동물원 · 블루마운틴",
    stops: [
      {
        id: "17a",
        time: "AM",
        name: "Featherdale Wildlife Park",
        detail: "호주 동물 만나기",
        category: "spot",
      },
      {
        id: "17b",
        time: "PM",
        name: "Blue Mountains",
        detail: "산 전망 · 사진",
        category: "spot",
      },
    ],
  },
  {
    day: 18,
    weekday: "FRI",
    title: "Coastal Mood",
    subtitle: "본다이에서 쿠지까지",
    stops: [
      {
        id: "18a",
        time: "AM",
        name: "Bondi Beach",
        detail: "바다 · 단체 사진",
        category: "spot",
      },
      {
        id: "18b",
        time: "PM",
        name: "Bronte Beach",
        detail: "코스탈 워크 · 릴스",
        category: "spot",
      },
      {
        id: "18c",
        time: "PM",
        name: "Coogee Beach",
        detail: "해변 산책 마무리",
        category: "spot",
      },
    ],
  },
  {
    day: 19,
    weekday: "SAT",
    title: "Local Saturday",
    subtitle: "마켓 · 대학 · 뉴타운",
    stops: [
      {
        id: "19a",
        time: "AM",
        name: "Carriageworks Market",
        detail: "마켓 구경",
        category: "spot",
      },
      {
        id: "19b",
        time: "PM",
        name: "University of Sydney",
        detail: "캠퍼스 사진",
        category: "spot",
      },
      {
        id: "19c",
        time: "PM",
        name: "Newtown",
        detail: "쇼핑 · 음식점 탐방",
        category: "spot",
      },
    ],
  },
  {
    day: 20,
    weekday: "SUN",
    title: "Road Trip Begins",
    subtitle: "해안도로 드라이브",
    stops: [
      {
        id: "20a",
        time: "AM",
        name: "Mascot",
        detail: "렌터카 픽업",
        category: "travel",
      },
      {
        id: "20b",
        time: "PM",
        name: "Sea Cliff Bridge",
        detail: "해안 절경 · 사진",
        category: "spot",
      },
      {
        id: "20c",
        time: "PM",
        name: "Towradgi",
        detail: "숙소 체크인",
        category: "stay",
      },
    ],
  },
  {
    day: 21,
    weekday: "MON",
    title: "Country & Coast",
    subtitle: "보우럴 · 허스트빌",
    stops: [
      {
        id: "21a",
        time: "AM",
        name: "Bowral",
        detail: "마을 산책",
        category: "spot",
      },
      {
        id: "21b",
        time: "PM",
        name: "Hurstville",
        detail: "숙소 이동",
        category: "stay",
      },
    ],
  },
  {
    day: 22,
    weekday: "TUE",
    title: "One More Day",
    subtitle: "자유 일정",
    stops: [
      {
        id: "22a",
        time: "ALL DAY",
        name: "Free Day",
        detail: "하고 싶은 일정 추가 예정",
        category: "spot",
      },
    ],
  },

  {
    // ===== 12월 23일: 마지막 날 및 귀국편 출발 =====
    day: 23,
    weekday: "WED",
    title: "Until Next Time",
    subtitle: "마지막 자유시간 · 공항 이동 · 출국",
    stops: [
      {
        id: "23a",
        time: "11:00",
        name: "Travelodge Hurstville 체크아웃",
        detail: "11시 전후 예정 · 캐리어 호텔 보관",
        category: "stay",
      },
      {
        id: "23b",
        time: "미정",
        name: "마지막 쇼핑 및 자유시간",
        detail: "기념품 · 카페 · 식사 · 마지막 사진",
        category: "spot",
      },
      {
        id: "23c",
        time: "17:45",
        name: "Travelodge Hurstville 재집결",
        detail: "17:45~18:00 예정 · 캐리어 수령 및 짐 정리",
        category: "stay",
      },
      {
        id: "23d",
        time: "18:20",
        name: "호텔에서 공항으로 출발",
        detail: "18:20~18:30 예정 · Uber 또는 택시",
        category: "travel",
      },
      {
        id: "23e",
        time: "19:00",
        name: "Sydney Airport T1",
        detail: "공항 도착 목표 · 체크인 · 출국심사",
        category: "travel",
      },
      {
        id: "23f",
        time: "21:55",
        name: "시드니공항 T1 출발",
        detail: "대한항공 KE402 · 인천행 · 시드니 시간",
        category: "travel",
      },
    ],
  },

  {
    // ===== 12월 24일: 한국 도착 =====
    day: 24,
    weekday: "THU",
    title: "Back in Korea",
    subtitle: "인천 도착 · 여행 종료",
    stops: [
      {
        id: "24a",
        time: "06:35",
        name: "인천공항 T2 도착",
        detail: "대한항공 KE402 · 한국 시간 · 입국 및 수하물 수령",
        category: "travel",
      },
    ],
  },
];
const seedReels: Reel[] = [
  {
    id: "r1",
    name: "Sydney in a few seconds",
    place: "여러 장소 · 여행 전체",
    done: 3,
    total: 9,
    type: "MULTI-DAY",
  },
  {
    id: "r2",
    name: "Harbour transition",
    place: "Opera House · The Rocks",
    done: 1,
    total: 4,
    type: "TRANSITION",
  },
  {
    id: "r3",
    name: "Beach day challenge",
    place: "Bondi · Bronte · Coogee",
    done: 0,
    total: 5,
    type: "CHALLENGE",
  },
];

const navItems = [
  { id: "home" as Tab, label: "홈", icon: Compass },
  { id: "plan" as Tab, label: "일정", icon: CalendarDays },
  { id: "money" as Tab, label: "경비", icon: Wallet },
  { id: "shoot" as Tab, label: "릴스", icon: Clapperboard },
  { id: "saved" as Tab, label: "기억", icon: Bookmark },
];

// ===== 지도 좌표 또는 기존 Google Maps 링크 열기 =====
function getGoogleMapsUrl(stop: Stop): string | null {
  // ===== 선택한 핀이 있으면 좌표를 우선 사용 =====
  if (stop.mapLocation) {
    const { lat, lng } = stop.mapLocation;

    return (
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(`${lat},${lng}`)
    );
  }

  // ===== 기존 Google Maps 링크도 지원 =====
  if (!stop.mapUrl) return null;

  try {
    const url = new URL(stop.mapUrl);
    const host = url.hostname.toLowerCase();

    // ===== Google Maps 주소만 허용 =====
    if (
      url.protocol === "https:" &&
      (host === "google.com" ||
        host.endsWith(".google.com") ||
        host === "maps.app.goo.gl")
    ) {
      return url.href;
    }
  } catch {
    return null;
  }

  return null;
}

/* ===== FOUR-FEATURES 2026 ===== */
/* ===== 무료 Google Maps 길찾기: 지도 좌표가 정확할 때만 표시 ===== */
type DirectionsMode = "walking" | "transit" | "driving";
function getDirectionsUrl(stop: Stop, mode: DirectionsMode): string | null {
  const loc = stop.mapLocation;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng))
    return null;
  const destination = encodeURIComponent(`${loc.lat},${loc.lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=${mode}`;
}

/* ===== 좌표 간 직선거리 (m): Haversine 공식 ===== */
function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

function formatDistance(meters: number) {
  return meters < 1000
    ? `${Math.round(meters)}m`
    : `${(meters / 1000).toFixed(1)}km`;
}

function formatLinkedExpenseSummary(
  expenses: Expense[],
  stopId: string,
): string | null {
  const linked = expenses.filter((e) => e.stopId === stopId);
  if (linked.length === 0) return null;

  const aud = linked
    .filter((e) => e.currency !== "KRW")
    .reduce((sum, e) => sum + e.amountCents, 0);

  const krw = linked
    .filter((e) => e.currency === "KRW")
    .reduce((sum, e) => sum + e.amountCents, 0);

  const values: string[] = [];

  if (aud > 0) values.push(`A$${(aud / 100).toFixed(2)}`);
  if (krw > 0) values.push(`₩${krw.toLocaleString("ko-KR")}`);

  return values.join(" · ");
}

function getTripCountdown() {
  const start = Date.UTC(2026, 11, 15);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.ceil((start - today) / 86400000);
  return diff > 0
    ? `D-${diff}`
    : diff === 0
      ? "D-DAY"
      : today <= Date.UTC(2026, 11, 23)
        ? "ON TRIP"
        : "THE END";
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  dark = false,
}: {
  value: number;
  max: number;
  dark?: boolean;
}) {
  return (
    <div className={`progress-track ${dark ? "on-dark" : ""}`}>
      <div
        className="progress-fill"
        style={{ width: `${max ? (100 * value) / max : 0}%` }}
      />
    </div>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>("home");

  /* ===== 저장 탭 방문 필터·내 주변·길찾기 모드 ===== */
  const [savedFilter, setSavedFilter] = useState<"all" | "todo" | "done">(
    "all",
  );
  const [nearby, setNearby] = useState(false);
  const [myPosition, setMyPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoMessage, setGeoMessage] = useState("");
  const [routeMode, setRouteMode] = useState<DirectionsMode>("walking");
  /* ===== 일정에서 경비 추가 시 전달할 ID (저장 이후 초기화) ===== */
  const [expenseFromStop, setExpenseFromStop] = useState<string | null>(null);

  // ===== 선택된 여행 날짜 =====
  const [selectedDay, setSelectedDay] = useState(16);

  // ===== 수정 가능한 여행 일정 + 저장된 데이터 불러오기 =====
  const [days, setDays] = useState<Day[]>(() => {
    try {
      const saved = localStorage.getItem("sydney-days-v1");
      return saved ? (JSON.parse(saved) as Day[]) : seedDays;
    } catch {
      return seedDays;
    }
  });

  // ===== 방문 완료 상태 + 저장된 데이터 불러오기 =====
  const [visited, setVisited] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("sydney-visited-v1");
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  // ===== 전체 여행 일정 클립보드 복사 =====
  async function copyFullItinerary(format: "text" | "json") {
    const sortedDays = [...days].sort((a, b) => a.day - b.day);

    const output =
      format === "json"
        ? JSON.stringify(
            {
              trip: "Sydney 2026",
              days: sortedDays,
              visited,
            },
            null,
            2,
          )
        : [
            "시드니 여행 전체 일정",
            "",
            ...sortedDays.map((day) => {
              return [
                `━━ 12월 ${day.day}일 ━━`,
                `${day.title} · ${day.subtitle}`,
                "",
                ...day.stops.map((stop) =>
                  [
                    `${stop.time} | ${stop.name}`,
                    stop.detail,
                    stop.mapLocation?.address
                      ? `주소: ${stop.mapLocation.address}`
                      : "",
                    stop.mapUrl ? `지도: ${stop.mapUrl}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                ),
              ].join("\n");
            }),
          ].join("\n\n");

    try {
      await navigator.clipboard.writeText(output);
      window.alert("전체 일정이 복사됐어!");
    } catch {
      window.alert("복사 실패: 브라우저 권한을 확인해 줘.");
    }
  }

  // ===== 일정 수정 모달 상태 =====
  const [showStopModal, setShowStopModal] = useState(false);
  const [editingStopId, setEditingStopId] = useState<string | null>(null);

  // ===== 현재 수정·삭제 메뉴가 열린 일정 ID =====
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  // ===== 오른쪽으로 밀었을 때 왼쪽에 열리는 경비·길찾기 메뉴 =====
  const [openQuickSwipeId, setOpenQuickSwipeId] = useState<string | null>(null);

  // ===== 손가락 또는 마우스가 처음 닿은 좌표 =====
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  // ===== 스와이프 직후 일반 클릭이 실행되지 않도록 방지 =====
  const lastSwipe = useRef<{ id: string; time: number } | null>(null);

  // ===== 일정 입력값 =====
  const [stopTime, setStopTime] = useState("");

  const [stopName, setStopName] = useState("");
  const [stopDetail, setStopDetail] = useState("");

  // ===== 일정의 Google Maps 링크 입력값 =====
  const [stopMapUrl, setStopMapUrl] = useState("");

  // ===== 현재 일정에서 선택한 지도 위치 =====
  const [stopMapLocation, setStopMapLocation] = useState<MapLocation | null>(
    null,
  );

  // ===== 지도 선택창 열림/닫힘 =====
  const [showMapPicker, setShowMapPicker] = useState(false);


const [showSavedPlaceList, setShowSavedPlaceList] = useState(false);
const [savedPlaceQuery, setSavedPlaceQuery] = useState("");


  const [stopCategory, setStopCategory] = useState<Stop["category"]>("spot");

  const [reels, setReels] = useState(seedReels);

  /* ===== 날짜별 동선 지도 열림 상태 ===== */
  const [showDayMap, setShowDayMap] = useState(false);

  // ===== 실제 경비 기록을 브라우저 저장소에서 불러오기 =====
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    try {
      const saved = localStorage.getItem("sydney-expenses-v2");
      return saved ? (JSON.parse(saved) as Expense[]) : [];
    } catch {
      return [];
    }
  });

  // ===== 첫 접속의 로컬 데이터는 다른 기기와 합쳐지기 전에 보관 =====
  const initialLocal = useRef<{
    days: Day[];
    visited: string[];
    expenses: Expense[];
  } | null>(null);
  const [cloudStatus, setCloudStatus] = useState<
    "loading" | "setup" | "ready" | "error"
  >("loading");
  const [cloudError, setCloudError] = useState("");
  const [uploading, setUploading] = useState(false);

  // ===== 최초 마운트에서 로컬 데이터를 보관하고 공동 DB를 구독 =====
  useEffect(() => {
    const snapshot = { days, visited, expenses };
    initialLocal.current = snapshot;
    try {
      if (!localStorage.getItem("sydney-pre-firestore-backup-v1")) {
        localStorage.setItem(
          "sydney-pre-firestore-backup-v1",
          JSON.stringify(snapshot),
        );
      }
    } catch {
      // ===== 기기 저장공간 부족 시에도 Firebase 연결은 유지 =====
    }

    return watchSharedTrip(
      (data) => {
        setDays(data.days);
        setVisited(data.visited);
        setExpenses(data.expenses);
        setCloudStatus(data.initialized ? "ready" : "setup");
      },
      (error) => {
        setCloudError(error.message);
        setCloudStatus("error");
      },
    );
    // ===== 최초 구독만 생성하고 상태 변경으로 재구독하지 않음 =====
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 서버 데이터가 정상 도착한 뒤에만 로컬 사본 갱신 =====
  useEffect(() => {
    if (cloudStatus !== "ready") return;
    try {
      localStorage.setItem("sydney-days-v1", JSON.stringify(days));
    } catch {
      /* 저장 공간 부족 */
    }
  }, [cloudStatus, days]);
  useEffect(() => {
    if (cloudStatus !== "ready") return;
    try {
      localStorage.setItem("sydney-visited-v1", JSON.stringify(visited));
    } catch {
      /* 저장 공간 부족 */
    }
  }, [cloudStatus, visited]);
  useEffect(() => {
    if (cloudStatus !== "ready") return;
    try {
      localStorage.setItem("sydney-expenses-v2", JSON.stringify(expenses));
    } catch {
      /* 저장 공간 부족 */
    }
  }, [cloudStatus, expenses]);

  // ===== 최초 이전 전에 현재 기기의 기록을 JSON 파일로 내려받기 =====
  function downloadLocalBackup() {
    if (!initialLocal.current) return;
    const contents = JSON.stringify(initialLocal.current, null, 2);
    const blob = new Blob([contents], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sydney-before-firestore.json";
    link.click();
    // ===== Safari가 파일 저장을 시작할 시간을 확보 =====
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ===== 사용자가 명시적으로 선택했을 때만 최초 공동 데이터 업로드 =====
  async function beginSharedTrip() {
    const local = initialLocal.current;
    if (cloudStatus !== "setup" || uploading || !local) return;
    if (
      !window.confirm(
        `이 기기의 ${local.days.length}일 일정·방문 ${local.visited.length}개·경비 ${local.expenses.length}건을 공동 DB의 최초 데이터로 등록할까?\n다른 기기에 더 최신 기록이 있다면 취소해야 해.`,
      )
    )
      return;
    setUploading(true);
    setCloudError("");
    try {
      const created = await initializeTripOnce(local);
      if (!created)
        setCloudError(
          "이미 다른 기기가 공동 데이터를 시작했어. 서버 기록을 불러오는 중이야.",
        );
    } catch (error) {
      setCloudError(
        error instanceof Error ? error.message : "초기 업로드에 실패했어.",
      );
    } finally {
      setUploading(false);
    }
  }

  const [likes, setLikes] = useState<string[]>(["Opera House"]);
  const selected =
    days.find((d) => d.day === selectedDay) ?? days[0] ?? seedDays[0];
  const doneToday = selected.stops.filter((s) => visited.includes(s.id)).length;

  // ===== 전체 여행 일정 개수 =====
  const totalStops = days.reduce((sum, day) => sum + day.stops.length, 0);

  // ===== 전체 여행에서 완료한 일정 개수 =====
  const completedStops = days.reduce(
    (sum, day) =>
      sum + day.stops.filter((stop) => visited.includes(stop.id)).length,
    0,
  );

  // ===== 전체 여행 진행률 (%) =====
  const tripProgress =
    totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
  // ===== 지도 링크가 등록된 일정 자동 수집 =====

  // ===== 일정에서 지도 연결된 장소 자동 수집 =====
  const mapCollection = useMemo(
    () =>
      days.flatMap((day) =>
        day.stops
          .filter((stop) => Boolean(stop.mapLocation || stop.mapUrl))
          .map((stop) => ({
            ...stop,
            day: day.day,
          })),
      ),
    [days],
  );

  // ===== 지도 컬렉션에서 재사용 가능한 장소 =====
  const reusablePlaces = useMemo(() => {
    const seen = new Set<string>();

    return mapCollection
      .filter((place) => {
        const placeLabel =
          place.mapLocation?.name?.trim() ||
          place.name.trim();

        const key = place.mapLocation
          ? `${placeLabel.toLowerCase()}:${place.mapLocation.lat.toFixed(5)},${place.mapLocation.lng.toFixed(5)}`
          : `${place.name.trim().toLowerCase()}:${place.mapUrl ?? ""}`;

        if (seen.has(key)) return false;

        seen.add(key);
        return true;
      })
      .sort(
        (a, b) =>
          Number(b.category === "stay") -
            Number(a.category === "stay") ||
          (a.mapLocation?.name || a.name).localeCompare(
            b.mapLocation?.name || b.name,
            "ko"
          )
      );
  }, [mapCollection]);

  // ===== 저장된 장소 이름 및 주소 검색 =====
  const filteredReusablePlaces = useMemo(() => {
    const query = savedPlaceQuery.trim().toLowerCase();

    return reusablePlaces.filter((place) =>
      [
        place.name,
        place.mapLocation?.name ?? "",
        place.mapLocation?.address ?? "",
        place.category === "stay" ? "숙소 호텔" : "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [reusablePlaces, savedPlaceQuery]);

  /* ===== 방문 필터 및 위치순 정렬: 위치 정보는 기기 내 메모리에만 보관 ===== */
  const visiblePlaces = useMemo(() => {
    const filtered = mapCollection.filter(
      (place) =>
        savedFilter === "all" ||
        (savedFilter === "done"
          ? visited.includes(place.id)
          : !visited.includes(place.id)),
    );
    if (!nearby || !myPosition) return filtered;
    return filtered
      .filter(
        (place) =>
          place.mapLocation &&
          Number.isFinite(place.mapLocation.lat) &&
          Number.isFinite(place.mapLocation.lng),
      )
      .sort(
        (a, b) =>
          distanceMeters(myPosition, a.mapLocation!) -
          distanceMeters(myPosition, b.mapLocation!),
      );
  }, [mapCollection, visited, savedFilter, nearby, myPosition]);

  function toggleNearby() {
    if (nearby) {
      setNearby(false);
      return;
    }
    if (myPosition) {
      setNearby(true);
      return;
    }
    if (!navigator.geolocation) {
      setGeoMessage("이 브라우저는 위치 확인을 지원하지 않아.");
      return;
    }
    setGeoLoading(true);
    setGeoMessage("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMyPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLoading(false);
        setNearby(true);
      },
      (err) => {
        setGeoLoading(false);
        setGeoMessage(
          err.code === 1
            ? "위치 권한이 거부됐어. 브라우저 설정에서 허용해 줘."
            : "현재 위치를 가져오지 못했어. 다시 시도해 줘.",
        );
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  }

  // ===== 홈 화면에도 표시할 전체 지출 합계 (AUD) =====
  const totalExpense = useMemo(
    () => ({
      aud:
        expenses
          .filter((e) => e.currency !== "KRW")
          .reduce((sum, e) => sum + e.amountCents, 0) / 100,

      krw: expenses
        .filter((e) => e.currency === "KRW")
        .reduce((sum, e) => sum + e.amountCents, 0),
    }),
    [expenses],
  );

  const totalReels = reels.reduce((sum, r) => sum + r.total, 0);
  const doneReels = reels.reduce((sum, r) => sum + r.done, 0);

  function toggleVisited(id: string) {
    void toggleSharedVisit(id).catch((error: Error) => {
      window.alert(`방문 체크 저장 실패: ${error.message}`);
    });
  }

  // ===== 새 일정 입력창 열기 =====
 
function openAddStop() {
  setEditingStopId(null);
  setStopMapLocation(null);
  setStopMapUrl("");

  setStopTime("");
  setStopName("");
  setStopDetail("");
  setStopCategory("spot");

  setShowSavedPlaceList(false);
  setSavedPlaceQuery("");

  setShowStopModal(true);
}


  
function openEditStop(stop: Stop) {
  setShowSavedPlaceList(false);
  setSavedPlaceQuery("");

  // 아래의 기존 코드는 그대로 유지

    setEditingStopId(stop.id);
    // ===== 기존 일정에 등록된 지도 링크 불러오기 =====
    setStopMapUrl(stop.mapUrl ?? "");
    setStopMapLocation(stop.mapLocation ?? null);

    // ===== 정확한 시간 형식일 때만 시간 선택기에 표시 =====
    const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(stop.time);

    setStopTime(validTime ? stop.time : "");
    setStopName(stop.name);
    setStopDetail(stop.detail);
    setStopCategory(stop.category);
    setShowStopModal(true);
  }

  // ===== 기존 장소 정보 불러오기 =====
  function importSavedPlace(
    place: (typeof mapCollection)[number]
  ) {
    const locationName =
      place.mapLocation?.name?.trim();

    setStopName(
      locationName &&
        locationName !== "지도에서 선택한 위치"
        ? locationName
        : place.name
    );

    setStopCategory(place.category);

    setStopMapLocation(
      place.mapLocation
        ? { ...place.mapLocation }
        : null
    );

    setStopMapUrl(place.mapUrl ?? "");

    // 시간과 상세 내용은 사용자가 직접 정함
    setShowSavedPlaceList(false);
    setSavedPlaceQuery("");
  }

  // ===== 일정 추가 및 수정: Firestore 날짜별 트랜잭션 =====
  function saveStop(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const time = stopTime.trim();
    const name = stopName.trim();
    if (!time || !name) return;

    const stop: Stop = {
      id: editingStopId ?? `stop-${crypto.randomUUID()}`,
      time,
      name,
      detail: stopDetail.trim(),
      category: stopCategory,
      mapUrl: stopMapUrl.trim(),
      ...(stopMapLocation ? { mapLocation: stopMapLocation } : {}),
    };
    void saveSharedStop(selectedDay, stop, editingStopId)
      .then(() => {
        setEditingStopId(null);
        setShowStopModal(false);
      })
      .catch((error: Error) => {
        window.alert(`일정 저장 실패: ${error.message}`);
      });
  }

  // ===== 일정 삭제 시 방문 체크도 함께 삭제 =====
  function deleteStop(stop: Stop) {
    if (!window.confirm(`"${stop.name}" 일정을 삭제할까요?`)) return;
    void removeSharedStop(selectedDay, stop.id).catch((error: Error) => {
      window.alert(`일정 삭제 실패: ${error.message}`);
    });
  }

  function changeReel(id: string) {
    setReels((previous) =>
      previous.map((r) =>
        r.id === id ? { ...r, done: (r.done + 1) % (r.total + 1) } : r,
      ),
    );
  }

  function toggleLike(name: string) {
    setLikes((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  }

  // ===== Firestore 초기 연결 중: 수정할 수 없는 대기 화면 =====
  if (cloudStatus === "loading") {
    return (
      <main style={{ padding: 32, textAlign: "center" }}>
        <h2>SYDNEY ’26</h2>
        <p>공동 여행 기록 연결 중...</p>
        <p>네트워크 상태를 확인해 줘.</p>
      </main>
    );
  }

  if (cloudStatus === "error") {
    return (
      <main style={{ padding: 32, textAlign: "center" }}>
        <h2>공동 기록 연결 실패</h2>
        <p role="alert">{cloudError}</p>
        <button type="button" onClick={() => window.location.reload()}>
          다시 시도
        </button>
      </main>
    );
  }

  if (cloudStatus === "setup") {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: 24,
        }}
      >
        <section
          style={{ width: "100%", maxWidth: 420, display: "grid", gap: 14 }}
        >
          <h1>SYDNEY ’26</h1>
          <h2>공동 여행 기록 시작하기</h2>
          <p>
            아직 Firestore에 공동 일정이 없어.{" "}
            <strong>최신 일정이 들어 있는 기기에서만</strong> 아래 버튼을 눌러.
          </p>
          <p>
            이 기기: {initialLocal.current?.days.length ?? 0}일 일정 · 장소{" "}
            {initialLocal.current?.days.reduce(
              (sum, day) => sum + day.stops.length,
              0,
            ) ?? 0}
            곳 · 방문 {initialLocal.current?.visited.length ?? 0}개 · 경비{" "}
            {initialLocal.current?.expenses.length ?? 0}건
          </p>
          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
            }}
          >
            {initialLocal.current?.days.map((day) => (
              <div key={day.day}>
                12월 {day.day}일 — {day.title} ({day.stops.length}곳)
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadLocalBackup}
            style={{ padding: 14 }}
          >
            이 기기 기록 JSON 백업
          </button>
          <button
            type="button"
            onClick={() => void beginSharedTrip()}
            disabled={uploading}
            style={{
              padding: 16,
              background: "#222",
              color: "#fff",
              borderRadius: 10,
            }}
          >
            {uploading ? "업로드 중..." : "이 기기 기록으로 공동 DB 시작"}
          </button>
          {cloudError && (
            <p role="alert" style={{ color: "#b42318" }}>
              {cloudError}
            </p>
          )}
          <small>
            다른 아이폰에서는 초기 업로드하지 않아도 돼. 공동 DB가 만들어지면
            자동으로 불러와.
          </small>
        </section>
      </main>
    );
  }

  const dayStrip = (
    <div className="date-strip" aria-label="여행 날짜 선택">
      {days.map((d) => (
        <button
          type="button"
          key={d.day}
          className={`date-chip ${selectedDay === d.day ? "active" : ""}`}
          onClick={() => setSelectedDay(d.day)}
        >
          <span>{d.weekday}</span>
          <strong>{d.day}</strong>
        </button>
      ))}
    </div>
  );

  {
    /* ===== 날짜별 일정 목록 ===== */
  }

  // ===== 날짜별 일정 목록: 왼쪽 스와이프로 수정·삭제 표시 =====
  const stopList = (
    <div className="stop-list">
      {selected.stops.map((s, i) => (
        <div
          key={s.id}
          className="stop-swipe"
          // ===== 손가락 또는 마우스를 누른 시작 위치 저장 =====
          onPointerDown={(e) => {
            if (tab !== "plan") return;
            if (e.pointerType === "mouse" && e.button !== 0) return;

            swipeStart.current = {
              x: e.clientX,
              y: e.clientY,
            };
          }}
          // ===== 좌우 스와이프 방향 판단 =====
          onPointerUp={(e) => {
            if (tab !== "plan" || !swipeStart.current) return;

            const dx = e.clientX - swipeStart.current.x;
            const dy = e.clientY - swipeStart.current.y;

            swipeStart.current = null;

            // 일반 클릭이나 세로 스크롤은 제외
            if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) {
              return;
            }

            lastSwipe.current = {
              id: s.id,
              time: Date.now(),
            };

            // 왼쪽으로 밀면 열기, 오른쪽으로 밀면 닫기
            // ===== 왼쪽으로 밀기: 기존 수정·삭제 메뉴 =====
            // ===== 오른쪽으로 밀기: 신규 경비·길찾기 메뉴 =====

            if (dx < 0) {
              // 경비·길찾기 메뉴가 열려 있었다면 먼저 닫기
              if (openQuickSwipeId === s.id) {
                setOpenQuickSwipeId(null);
              } else {
                setOpenSwipeId(s.id);
                setOpenQuickSwipeId(null);
              }
            } else {
              // 수정·삭제 메뉴가 열려 있었다면 먼저 닫기
              if (openSwipeId === s.id) {
                setOpenSwipeId(null);
              } else {
                setOpenQuickSwipeId(s.id);
                setOpenSwipeId(null);
              }
            }
          }}
          // ===== 스크롤 등으로 동작이 취소되면 초기화 =====
          onPointerCancel={() => {
            swipeStart.current = null;
          }}
        >
          {/* ===== 왼쪽에 숨어 있는 경비·길찾기 메뉴 ===== */}
          {tab === "plan" && (
            <div
              className={`stop-swipe-actions stop-swipe-actions-left ${
                openQuickSwipeId === s.id ? "is-active" : ""
              }`}
              aria-hidden={openQuickSwipeId !== s.id}
            >
              {/* ===== 해당 일정에 연결해서 경비 추가 ===== */}
              <button
                type="button"
                className="swipe-quick-expense"
                tabIndex={openQuickSwipeId === s.id ? 0 : -1}
                aria-label={`${s.name} 경비 추가`}
                onClick={() => {
                  setOpenQuickSwipeId(null);
                  setExpenseFromStop(s.id);
                  setTab("money");
                }}
              >
                <Wallet size={17} />
                <span>경비</span>
              </button>

              {/* ===== Google Maps 길찾기 ===== */}
              {getDirectionsUrl(s, routeMode) ? (
                <a
                  className="swipe-quick-directions"
                  href={getDirectionsUrl(s, routeMode)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  tabIndex={openQuickSwipeId === s.id ? 0 : -1}
                  aria-label={`${s.name} 길찾기`}
                  onClick={() => setOpenQuickSwipeId(null)}
                >
                  <Navigation size={17} />
                  <span>길찾기</span>
                </a>
              ) : (
                <button
                  type="button"
                  className="swipe-quick-directions"
                  disabled
                  title="먼저 일정에 지도 위치를 등록해 줘"
                >
                  <Navigation size={17} />
                  <span>위치 없음</span>
                </button>
              )}
            </div>
          )}

          {/* ===== 오른쪽에 숨어 있는 수정·삭제 메뉴 ===== */}
          {tab === "plan" && (
            <div
              className="stop-swipe-actions"
              aria-hidden={openSwipeId !== s.id}
            >
              {/* ===== 일정 수정 버튼 ===== */}
              <button
                type="button"
                className="swipe-edit"
                tabIndex={openSwipeId === s.id ? 0 : -1}
                aria-label={`${s.name} 수정`}
                onClick={() => {
                  setOpenSwipeId(null);
                  openEditStop(s);
                }}
              >
                <Pencil size={17} />
                <span>수정</span>
              </button>

              {/* ===== 일정 삭제 버튼 ===== */}
              <button
                type="button"
                className="swipe-delete"
                tabIndex={openSwipeId === s.id ? 0 : -1}
                aria-label={`${s.name} 삭제`}
                onClick={() => {
                  setOpenSwipeId(null);
                  deleteStop(s);
                }}
              >
                <Trash2 size={17} />
                <span>삭제</span>
              </button>
            </div>
          )}

          {/* ===== 좌우로 움직이는 일정 본문 ===== */}
          <div
            className={`stop-swipe-content ${
              tab === "plan" && openSwipeId === s.id
                ? "is-open"
                : tab === "plan" && openQuickSwipeId === s.id
                  ? "is-open-left"
                  : ""
            }`}
          >
            <div
              className={`stop-row ${visited.includes(s.id) ? "visited" : ""}`}
            >
              {/* ===== 일정 탭: 완료 체크 / 메뉴 닫기 ===== */}

              {/* ===== 일정 내용과 완료 체크를 별도로 분리 ===== */}
              <div className="stop-visit">
                {/* ===== 동그라미 클릭: 방문 완료 체크 ===== */}
                <button
                  type="button"
                  className="stop-check-button"
                  aria-label={`${s.name} 방문 완료 체크`}
                  aria-pressed={visited.includes(s.id)}
                  onClick={() => {
                    // ===== 스와이프 직후 잘못된 클릭 방지 =====
                    if (
                      lastSwipe.current?.id === s.id &&
                      Date.now() - lastSwipe.current.time < 500
                    ) {
                      return;
                    }

                    // ===== 수정·삭제 메뉴가 열렸으면 먼저 닫기 =====
                    if (openSwipeId === s.id || openQuickSwipeId === s.id) {
                      setOpenSwipeId(null);
                      setOpenQuickSwipeId(null);
                      return;
                    }

                    // ===== 완료 상태 변경 =====
                    toggleVisited(s.id);
                  }}
                >
                  <div className="stop-rail">
                    <span
                      className={`rail-dot ${
                        visited.includes(s.id) ? "done" : ""
                      }`}
                    >
                      {visited.includes(s.id) && (
                        <Check size={12} strokeWidth={3} />
                      )}
                    </span>

                    {/* ===== 기존 일정 연결선 유지 ===== */}
                    {i !== selected.stops.length - 1 && (
                      <span className="rail-line" />
                    )}
                  </div>
                </button>

                {/* ===== 일정 시간 ===== */}
                <span className="stop-time">{s.time}</span>

                {/* ===== 장소명 클릭: Google Maps 열기 ===== */}

                <span className="stop-copy">
                  {/* ===== 장소 이름 ===== */}
                  {getGoogleMapsUrl(s) ? (
                    <a
                      href={getGoogleMapsUrl(s) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="stop-name-link"
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <strong>{s.name}</strong>
                    </a>
                  ) : (
                    <strong>{s.name}</strong>
                  )}

                  {/* ===== 장소 설명 ===== */}
                  {s.detail && <small>{s.detail}</small>}

                  {/* ===== 해당 장소에 연결된 경비 합계 ===== */}
                  {tab === "plan" &&
                    expenses.some((e) => e.stopId === s.id) && (
                      <span className="trip-stop-spent">
                        사용 {formatLinkedExpenseSummary(expenses, s.id)}
                      </span>
                    )}
                </span>

                {/* ===== 홈 화면에서만 화살표 표시 ===== */}
                {tab === "home" && (
                  <ChevronRight className="row-chevron" size={17} />
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="app-shell">
      <main className="app-content">
        <header className="topbar">
          <div className="brand-mark">
            {/* ===== 모든 기기에서 동일하게 보이는 별표 로고 ===== */}
            <span className="brand-star">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 3V21 M3 12H21 M5.6 5.6L18.4 18.4 M1F8.4 5.6L5.6 18.4" />
              </svg>
            </span>{" "}
            SYDNEY
            <span className="brand-apostrophe">’</span>26
          </div>
          <div className="topbar-right">
            {/* <span className="preview-badge">UI PREVIEW</span> */}
            <div className="avatar-stack">
              <span>J</span>
              {/* <span>1</span>
              <span>2</span> */}
            </div>
          </div>
        </header>

        {tab === "home" && (
          <>
            <div className="intro">
              <div>
                <h1>
                  <em>시드니</em>
                </h1>
              </div>
              <div className="intro-note">
                <span>시옹 - 9 days</span>
              </div>
            </div>
            <SydneyWeather countdown={getTripCountdown()} />
            <div className="stat-grid">
              {/* ===== 남은 일정 카드 ===== */}
              <button className="stat-card" onClick={() => setTab("plan")}>
                <div className="stat-main">
                  <div className="stat-icon">
                    <Route size={19} />
                  </div>
                  <strong>
                    {selected.stops.length - doneToday}
                    <small> left</small>
                  </strong>
                </div>

                <div className="stat-footer">
                  일정 확인 <ArrowRight size={14} />
                </div>
              </button>
              <button
                className="stat-card olive"
                onClick={() => setTab("shoot")}
              >
                <div className="stat-main">
                  <div className="stat-icon">
                    <Camera size={19} />
                  </div>
                  <strong>
                    {doneReels}
                    <small> / {totalReels}</small>
                  </strong>
                </div>

                <div className="stat-footer">
                  릴스 <ArrowRight size={14} />
                </div>
              </button>
            </div>
            <section className="block-section">
              <SectionTitle
                eyebrow="DAY BY DAY"
                title="여행 일정"
                action={
                  <button
                    className="text-action"
                    onClick={() => setTab("plan")}
                  >
                    전체 보기 <ArrowUpRight size={15} />
                  </button>
                }
              />
              {dayStrip}
              <div className="day-summary">
                <div>
                  <span>
                    DEC {selected.day} · {selected.weekday}
                  </span>
                  <h3>{selected.title}</h3>
                  <p>{selected.subtitle}</p>
                </div>
                <div className="mini-progress">
                  {doneToday}/{selected.stops.length} <CheckCircle2 size={15} />
                </div>
              </div>
              {stopList}
            </section>
            <section className="block-section">
              <SectionTitle eyebrow="THE LITTLE DETAILS" title="한눈에 보기" />
              <div className="quick-grid">
                <button onClick={() => setTab("money")} className="quick-item">
                  <span className="quick-icon">
                    <Wallet size={19} />
                  </span>
                  <span>
                    <strong>A${totalExpense.aud.toFixed(2)}</strong>
                    <small>
                      원화 ₩{totalExpense.krw.toLocaleString("ko-KR")} · 기록된
                      공동 지출
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
                <button onClick={() => setTab("saved")} className="quick-item">
                  <span className="quick-icon">
                    <Bookmark size={19} />
                  </span>
                  <span>
                    <strong>{likes.length} saved places</strong>
                    <small>마음에 드는 장소</small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              </div>
            </section>
          </>
        )}

        {tab === "plan" && (
          <>
            <div className="page-intro">
              <h1>
                일정<span className="period">.</span>
              </h1>
              <p>
                전체 여행 진행률 <strong>{tripProgress}%</strong>
              </p>
            </div>

            <section className="block-section">
              {dayStrip}

              {/* ===== 날짜 제목 영역 ===== */}
              <div
                className="day-summary detail"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: 0,
                }}
              >
                {/* 첫 번째 줄: 날짜·제목 + 완료 개수·추가 */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <span
                      style={{
                        color: "#8b927b",
                        fontSize: 9,
                        fontWeight: 800,
                        letterSpacing: "0.11em",
                      }}
                    >
                      DEC {selected.day} · {selected.weekday}
                    </span>
                    <h3>{selected.title}</h3>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      flexShrink: 0,
                    }}
                  >
                    <div className="mini-progress">
                      {doneToday}/{selected.stops.length}
                      <CheckCircle2 size={15} />
                    </div>

                    <button
                      type="button"
                      className="exp-add-button"
                      onClick={openAddStop}
                      aria-label="일정 추가"
                      title="일정 추가"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>

                {/* 두 번째 줄: 설명 + 지도 버튼 */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 8,
                    width: "100%",
                  }}
                >
                  <p style={{ margin: 0, minWidth: 0 }}>{selected.subtitle}</p>

                  
<button
  type="button"
  className="plan-map-top-button"
  onClick={() => setShowDayMap(true)}
  style={{
    width: "auto",
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 0",
    fontSize: 10,
    whiteSpace: "nowrap",
    border: "none",
    background: "transparent",
    boxShadow: "none",
    borderRadius: 0,
    color: "#6a7756",
    cursor: "pointer",
  }}
>
  <MapPin size={12} />
  지도로 한눈에 보기
</button>

                </div>
              </div>

              {/* ===== 선택한 날짜의 완료 진행률 ===== */}
              <ProgressBar value={doneToday} max={selected.stops.length} />

              {/* ===== 해당 날짜의 전체 일정 목록 ===== */}
              {stopList}

              <div className="plan-copy-actions">
                {/* ===== 선택한 날짜 초압축 일정 복사 ===== */}
                <button
                  type="button"
                  className="plan-copy-button"
                  onClick={async () => {
                    const compact = selected.stops
                      .map((stop) => `${stop.time || "미정"} : ${stop.name}`)
                      .join("\n");

                    try {
                      await navigator.clipboard.writeText(
                        compact || "등록된 일정 없음",
                      );

                      window.alert(
                        `12월 ${selected.day}일 초압축 일정 복사 완료!`,
                      );
                    } catch {
                      window.alert("클립보드 복사에 실패했어.");
                    }
                  }}
                >
                  <Copy size={12} />
                  하루 일정 요약
                </button>

                <button
                  type="button"
                  className="plan-copy-button"
                  onClick={() => void copyFullItinerary("text")}
                >
                  <Copy size={12} />
                  전체 일정 복사
                </button>

                <button
                  type="button"
                  className="plan-copy-button"
                  onClick={() => void copyFullItinerary("json")}
                >
                  <Copy size={12} />
                  JSON 복사
                </button>
              </div>
            </section>
            {/* <p className="help-note">
              <CheckCircle2 size={15} /> 장소 카드를 누르면 방문 여부가 바뀌어.
            </p> */}
          </>
        )}

        {/* ===== 공동 경비 관리 화면 ===== */}
        {tab === "money" && (
          <ExpenseTracker
            expenses={expenses}
            itineraryDays={days}
            initialStopId={expenseFromStop}
            onInitialStopConsumed={() => setExpenseFromStop(null)}
            // ===== 새로운 지출 등록 =====
            onAddExpense={(expense) => {
              void addSharedExpense(expense).catch((error: Error) => {
                window.alert(`경비 추가 실패: ${error.message}`);
              });
            }}
            // ===== 개별 지출 문서 수정 =====
            onUpdateExpense={(updatedExpense) => {
              void editSharedExpense(updatedExpense).catch((error: Error) => {
                window.alert(`경비 수정 실패: ${error.message}`);
              });
            }}
            // ===== 개별 지출 문서 삭제 =====
            onDeleteExpense={(id) => {
              void removeSharedExpense(id).catch((error: Error) => {
                window.alert(`경비 삭제 실패: ${error.message}`);
              });
            }}
          />
        )}

        {tab === "shoot" && (
          <>
            <div className="page-intro">
              {/* <span className="eyebrow">LIGHTS · CAMERA · MEMORIES</span> */}
              <h1>
                릴스<span className="period">..</span>
              </h1>
              {/* <p>하나의 영상에 여러 장소와 날짜를 연결해.</p> */}
            </div>

            <section className="block-section">
              <div className="reel-grid">
                {reels.map((r, i) => (
                  <button
                    key={r.id}
                    className="reel-card"
                    onClick={() => changeReel(r.id)}
                  >
                    <div className={`reel-thumbnail reel-thumb-${i}`}>
                      <Clapperboard size={30} strokeWidth={1.4} />
                      <span>0{i + 1}</span>
                    </div>
                    <div className="reel-info">
                      <span className="reel-type">{r.type}</span>
                      <h3>{r.name}</h3>
                      <p>
                        <MapPin size={13} />
                        {r.place}
                      </p>
                      <div className="reel-progress">
                        <ProgressBar value={r.done} max={r.total} />
                        <span>
                          {r.done}/{r.total}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <p className="help-note">
                <CheckCircle2 size={15} /> 카드를 누르면 촬영 진행률이 한 단계씩
                증가해.
              </p>
            </section>
          </>
        )}

        {tab === "saved" && (
          <>
            <div className="page-intro">
              {/* <span className="eyebrow">PLACES & LITTLE THINGS</span> */}
              <h1>
                저장<span className="period">..</span>
              </h1>
            </div>

            {/* ===== 일정에서 자동 생성되는 지도 컬렉션 ===== */}
            <section className="block-section">
              <SectionTitle
                eyebrow="PLACES FROM OUR TRIP"
                title={`지도 컬렉션 · ${visiblePlaces.length}`}
              />

              {/* ===== 등록된 모든 위치를 지도에 핀으로 표시 ===== */}
              {/* ===== 전체 / 미방문 / 완료 / 내 주변 + 길찾기 방법 ===== */}
              <div className="trip-saved-controls">
                <div className="trip-saved-filter">
                  {(
                    [
                      ["all", "전체"],
                      ["todo", "미방문"],
                      ["done", "완료"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      className={savedFilter === value ? "active" : ""}
                      onClick={() => setSavedFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="trip-saved-extra">
                  <button
                    type="button"
                    className={nearby ? "active" : ""}
                    disabled={geoLoading}
                    onClick={toggleNearby}
                  >
                    <MapPin size={14} />{" "}
                    {geoLoading
                      ? "위치 확인 중..."
                      : nearby
                        ? "내 주변 ON"
                        : "내 주변 거리순"}
                  </button>
                  <label>
                    길찾기
                    <select
                      value={routeMode}
                      onChange={(e) =>
                        setRouteMode(e.target.value as DirectionsMode)
                      }
                    >
                      <option value="walking">도보</option>
                      <option value="transit">대중교통</option>
                      <option value="driving">자동차</option>
                    </select>
                  </label>
                </div>
                {geoMessage && <small role="status">{geoMessage}</small>}
                {nearby && (
                  <small>직선거리 순서야. 실제 도로 이동시간과는 달라.</small>
                )}
              </div>
              <MapCollection
                places={visiblePlaces}
                visited={visited}
                routeMode={routeMode}
              />

              {/* ===== 지도에 연결된 일정 목록 ===== */}
              <div className="place-list">
                {visiblePlaces.length === 0 ? (
                  <p className="map-empty">
                    조건에 맞는 장소가 없어. 위치가 없는 일정은 내 주변 모드에서
                    제외돼.
                  </p>
                ) : (
                  visiblePlaces.map((place) => {
                    // ===== 해당 장소의 Google Maps 링크 =====
                    const url = getGoogleMapsUrl(place);

                    return (
                      <div className="place-row" key={place.id}>
                        {/* ===== 장소 아이콘 ===== */}
                        <div className="place-art">
                          <MapPin size={22} />
                        </div>

                        {/* ===== 장소명 및 여행 날짜 ===== */}
                        <div className="place-name">
                          <span>DEC {place.day} · 2026</span>
                          {visited.includes(place.id) && (
                            <span className="trip-visited-tag">방문 완료</span>
                          )}

                          {/* ===== 장소 이름을 누르면 Google Maps 열기 ===== */}
                          <strong>
                            {url ? (
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="place-title-link"
                              >
                                {place.name}
                              </a>
                            ) : (
                              place.name
                            )}
                          </strong>

                          <small>
                            {place.mapLocation?.address ||
                              place.detail ||
                              "지도 위치 등록됨"}
                            {nearby && myPosition && place.mapLocation && (
                              <span>
                                {" "}
                                · 직선거리{" "}
                                {formatDistance(
                                  distanceMeters(myPosition, place.mapLocation),
                                )}
                              </span>
                            )}
                          </small>
                        </div>

                        {/* ===== 방문 체크: 기존 Firebase 방문 상태 재사용 ===== */}
                        <button
                          type="button"
                          className="trip-visit-action"
                          aria-label={`${place.name} 방문 상태 변경`}
                          aria-pressed={visited.includes(place.id)}
                          onClick={() => toggleVisited(place.id)}
                        >
                          <Check size={17} />
                        </button>
                        {/* ===== 무료 Google Maps 길찾기 URL: 좌표가 있어야 정확 ===== */}
                        {getDirectionsUrl(place, routeMode) && (
                          <a
                            className="map-collection-link"
                            href={getDirectionsUrl(place, routeMode)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`${place.name} 길찾기`}
                          >
                            <Navigation size={18} />
                          </a>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <div className="collection-summary">
              <Star size={19} /> {likes.length} places saved{" "}
              <span>SYDNEY '26</span>
            </div>
            <section className="block-section">
              <SectionTitle eyebrow="OUR SHORTLIST" title="장소 컬렉션" />
              <div className="place-list">
                {[
                  {
                    name: "Opera House",
                    area: "Circular Quay",
                    kind: "LANDMARK",
                    n: 1,
                  },
                  { name: "Bondi Beach", area: "Bondi", kind: "BEACH", n: 2 },
                  {
                    name: "The Rocks",
                    area: "Sydney CBD",
                    kind: "NEIGHBOURHOOD",
                    n: 3,
                  },
                  {
                    name: "Blue Mountains",
                    area: "Katoomba",
                    kind: "NATURE",
                    n: 4,
                  },
                ].map((p) => (
                  <div className="place-row" key={p.name}>
                    <div className={`place-art place-art-${p.n}`}>
                      <MapPin size={23} />
                    </div>
                    <div className="place-name">
                      <span>{p.kind}</span>
                      <strong>{p.name}</strong>
                      <small>{p.area}</small>
                    </div>
                    <button
                      type="button"
                      className={`like-button ${likes.includes(p.name) ? "liked" : ""}`}
                      onClick={() => toggleLike(p.name)}
                      aria-label={`${p.name} 즐겨찾기`}
                    >
                      <Heart
                        size={20}
                        fill={likes.includes(p.name) ? "currentColor" : "none"}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="prototype-note">질문은 뗴으니한테.</footer>
      </main>
      <nav className="bottom-nav" aria-label="메인 메뉴">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-button ${tab === item.id ? "selected" : ""}`}
              onClick={() => {
                setTab(item.id);
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <Icon size={21} strokeWidth={tab === item.id ? 2.3 : 1.8} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* ===== 일정 추가·수정 모달 ===== */}
      {showStopModal && (
        <div className="modal-backdrop" onClick={() => setShowStopModal(false)}>
          <div
            className="modal-panel stop-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stop-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ===== 모달 상단 제목 ===== */}
            <div className="modal-head">
              <div>
                <span className="eyebrow">DEC {selectedDay}, 2026</span>
                <h2 id="stop-modal-title">
                  {editingStopId ? "일정 수정" : "일정 추가"}
                </h2>
              </div>

              {/* ===== 모달 닫기 ===== */}
              <button
                type="button"
                className="close-button"
                onClick={() => setShowStopModal(false)}
                aria-label="닫기"
              >
                <X size={21} />
              </button>
            </div>

            {/* ===== 일정 입력 폼 ===== */}
            <form onSubmit={saveStop}>

{/* ===== 저장된 장소에서 가져오기 ===== */}
<div className="saved-place-import">
  <button
    type="button"
    className="saved-place-import-toggle"
    aria-expanded={showSavedPlaceList}
    onClick={() => {
      setShowSavedPlaceList((open) => !open);
      setSavedPlaceQuery("");
    }}
  >
    <span>
      <Bookmark size={15} />
      저장된 장소 가져오기
    </span>
    <ChevronRight size={15} />
  </button>

  {showSavedPlaceList && (
    <div className="saved-place-import-panel">
      <input
        type="search"
        value={savedPlaceQuery}
        onChange={(e) =>
          setSavedPlaceQuery(e.target.value)
        }
        placeholder="장소명 · 숙소 · 주소 검색"
        aria-label="저장된 장소 검색"
      />

      <div className="saved-place-import-results">
        {filteredReusablePlaces.length === 0 ? (
          <p className="saved-place-import-empty">
            {reusablePlaces.length === 0
              ? "위치를 연결해 저장한 일정이 아직 없어."
              : "검색 결과가 없어."}
          </p>
        ) : (
          filteredReusablePlaces.map((place) => (
            <button
              key={place.id}
              type="button"
              className="saved-place-import-option"
              onClick={() => importSavedPlace(place)}
            >
              <strong>
                {place.mapLocation?.name || place.name}
              </strong>

              <small>
                {place.category === "stay"
                  ? "숙소 · "
                  : ""}
                12월 {place.day}일 등록
                {place.mapLocation?.address
                  ? ` · ${place.mapLocation.address}`
                  : ""}
              </small>
            </button>
          ))
        )}
      </div>
    </div>
  )}
</div>

              {/* ===== 시간: 기기 기본 시간 선택기 ===== */}
              <label>
                시간
                <input
                  type="time"
                  step="300"
                  value={stopTime}
                  onChange={(e) => setStopTime(e.target.value)}
                  required
                />
              </label>

              {/* ===== 장소 또는 일정 이름 ===== */}
              <label>
                장소 / 일정 이름
                <input
                  value={stopName}
                  onChange={(e) => setStopName(e.target.value)}
                  placeholder="예: Sydney Opera House"
                  required
                />
              </label>

              {/* ===== 상세 설명 ===== */}
              <label>
                상세 내용
                <input
                  value={stopDetail}
                  onChange={(e) => setStopDetail(e.target.value)}
                  placeholder="예: 사진 촬영 · 점심"
                />
              </label>

              {/* ===== 카테고리 단일 선택 ===== */}
              <label>
                카테고리
                <select
                  value={stopCategory}
                  onChange={(e) =>
                    setStopCategory(e.target.value as Stop["category"])
                  }
                >
                  <option value="food">식사</option>
                  <option value="cafe">카페</option>
                  <option value="travel">이동</option>
                  <option value="spot">관광</option>
                  <option value="stay">숙소</option>
                </select>
              </label>

              {/* ===== 구글 지도 자동 연결 및 열기 ===== */}

              {/* ===== 일정 입력창: 지도에서 위치 선택 ===== */}
              <div className="map-connect">
                <span>지도 연결 (선택)</span>

                {/* ===== 지도 선택창 열기 ===== */}
                <button
                  type="button"
                  className="map-pick-button"
                  onClick={() => setShowMapPicker(true)}
                >
                  <MapPin size={17} />
                  {stopMapLocation
                    ? "지도 위치 다시 선택"
                    : "지도에서 위치 선택"}
                </button>

                {/* ===== 현재 선택한 장소 표시 ===== */}
                {stopMapLocation && (
                  <>
                    <p className="map-pick-summary">
                      연결됨 · {stopMapLocation.name}
                    </p>

                    {/* ===== 지도 연결만 해제 ===== */}
                    <button
                      type="button"
                      className="map-pick-remove"
                      onClick={() => {
                        setStopMapLocation(null);
                        setStopMapUrl("");
                      }}
                    >
                      위치 연결 해제
                    </button>
                  </>
                )}
              </div>

              {/* ===== 지도 선택 방법 안내 ===== */}
              <p className="map-input-note">
                장소를 검색하거나 지도에서 직접 위치를 선택할 수 있어. 일정 저장
                후 지도 컬렉션에 자동 등록돼.
              </p>

              {/* ===== 일정 저장 버튼 ===== */}
              <button type="submit" className="wide-primary">
                <Check size={18} />
                {editingStopId ? "수정 저장" : "일정 추가"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ===== 일정의 위치를 지도에서 선택하는 창 ===== */}
      {showMapPicker && (
        <MapPicker
          // ===== 장소 검색창에 현재 일정 이름 입력 =====
          initialQuery={stopName}
          // ===== 기존에 선택했던 핀 위치 =====
          initialLocation={stopMapLocation}
          // ===== 지도 선택창 닫기 =====
          onClose={() => setShowMapPicker(false)}
          // ===== 지도에서 위치 확정 =====
          onSelect={(location) => {
            // 선택한 좌표 저장
            setStopMapLocation(location);

            // Google Maps에서 열 수 있는 링크 생성
            const coordinates = `${location.lat},${location.lng}`;

            setStopMapUrl(
              `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`,
            );

            // 일정 이름이 비어 있으면 선택한 장소명 사용
            if (!stopName.trim()) {
              setStopName(location.name);
            }

            // 다시 일정 입력창으로 돌아가기
            setShowMapPicker(false);
          }}
        />
      )}
      {/* ===== 하루 전체 동선 지도 ===== */}
      {showDayMap && (
        <DailyRouteMap
          day={selected.day}
          stops={selected.stops}
          onClose={() => setShowDayMap(false)}
        />
      )}
    </div>
  );
}

export default App;
