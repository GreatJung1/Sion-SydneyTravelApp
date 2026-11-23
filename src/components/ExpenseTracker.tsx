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

// ===== 실제 저장되는 지출 데이터 =====
export type Expense = {
  id: string;
  title: string;
  amountCents: number;
  payer: PersonName;
  participants: PersonName[];
  category: ExpenseCategory;
  mode: ExpenseMode;
  createdAt: string;
};

// ===== 경비 화면 컴포넌트에 전달할 값 =====

// ===== 부모 App.tsx에서 전달받는 경비 기능 =====
type ExpenseTrackerProps = {
  expenses: Expense[];

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
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
}: ExpenseTrackerProps) {

  // ===== 지출 입력창 =====
  const [showModal, setShowModal] = useState(false);
  // ===== 최종 정산 상세창 열림 / 닫힘 =====
const [showSettlement, setShowSettlement] = useState(false);

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

  // ===== AUD → KRW 환율 =====
  const [fx, setFx] = useState<FxRate | null>(null);
  const [fxStatus, setFxStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

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

  // ===== 전체 지출 합계 =====
  const totalCents = useMemo(
    () => expenses.reduce((sum, expense) => sum + expense.amountCents, 0),
    [expenses],
  );

  // ===== 개인별 실제 결제액 / 최종 부담액 계산 =====
  const personTotals = useMemo(() => {
    const paid: Record<PersonName, number> = {
      정세은: 0,
      김서영: 0,
      최서은: 0,
    };

    const owed: Record<PersonName, number> = {
      정세은: 0,
      김서영: 0,
      최서은: 0,
    };

    for (const expense of expenses) {
      // ===== 실제 돈을 낸 사람에게 결제액 합산 =====
      paid[expense.payer] += expense.amountCents;

      // ===== 개인이면 한 명, N빵이면 선택한 사람들 =====
      const selectedPeople =
        expense.mode === "personal"
          ? expense.participants.slice(0, 1)
          : expense.participants;

      const shares = allocateShares(expense.amountCents, selectedPeople);

      // ===== 각 사람의 부담액 합산 =====
      PEOPLE.forEach((person) => {
        owed[person] += shares[person];
      });
    }

    return { paid, owed };
  }, [expenses]);

  // ===== 최종 송금 내역 타입 =====
  type SettlementTransfer = {
    from: PersonName;
    to: PersonName;
    amountCents: number;
  };

  // ===== 모든 지출을 합산해 최종 정산 계산 =====
  const settlements = useMemo<SettlementTransfer[]>(() => {
    // ===== 실제 결제액 - 본인 부담액 =====
    const balances = PEOPLE.map((person) => ({
      person,
      balance: personTotals.paid[person] - personTotals.owed[person],
    }));

    // ===== 돈을 받아야 하는 사람 =====
    const creditors = balances
      .filter((item) => item.balance > 0)
      .map((item) => ({
        person: item.person,
        amount: item.balance,
      }))
      .sort((a, b) => b.amount - a.amount);

    // ===== 돈을 보내야 하는 사람 =====
    const debtors = balances
      .filter((item) => item.balance < 0)
      .map((item) => ({
        person: item.person,
        amount: -item.balance,
      }))
      .sort((a, b) => b.amount - a.amount);

    const transfers: SettlementTransfer[] = [];

    let i = 0;
    let j = 0;

    // ===== 채무자와 채권자의 금액을 순서대로 상계 =====
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];

      const amount = Math.min(debtor.amount, creditor.amount);

      // ===== 실제 필요한 송금 내역 생성 =====
      if (amount > 0) {
        transfers.push({
          from: debtor.person,
          to: creditor.person,
          amountCents: amount,
        });
      }

      debtor.amount -= amount;
      creditor.amount -= amount;

      if (debtor.amount === 0) i++;
      if (creditor.amount === 0) j++;
    }

    return transfers;
  }, [personTotals]);

  // ===== 입력 중인 금액 및 분배 미리보기 =====
  const previewCents = parseAmountCents(amount) ?? 0;

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

  // ===== 기존 입력값 모두 복원 =====
  setTitle(expense.title);
  setAmount((expense.amountCents / 100).toFixed(2));
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

  // ===== 금액을 AUD 센트 단위로 변환 =====
  const cents = parseAmountCents(amount);

  if (!title.trim()) {
    setFormError("사용 내역을 입력해 줘.");
    return;
  }

  if (cents === null) {
    setFormError("금액은 소수점 둘째 자리까지 입력해 줘.");
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

  // ===== 새 등록과 수정에서 공통으로 사용할 데이터 =====
  const values = {
    title: title.trim(),
    amountCents: cents,
    category,
    payer,
    mode,
    participants: finalParticipants,
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

      {/* ===== 크기를 줄인 전체 지출 카드 ===== */}
      <section className="exp-total">
        <span>전체 지출 · AUD</span>

        <strong>{formatAud(totalCents)}</strong>

        {fx && <small>{formatKrw(totalCents, fx.rate)}</small>}
      </section>

      {/* ===== 개인별 부담액 카드 ===== */}
      <section className="exp-section">
        <div className="exp-people-grid">
          {PEOPLE.map((person) => {
            const owed = personTotals.owed[person];
            const paid = personTotals.paid[person];

            return (
              <article className="exp-person-card" key={person}>
                <span className="exp-person-name">{person}</span>

                {/* ===== 본인이 부담할 금액 ===== */}
                <strong>{formatAud(owed)}</strong>

                {/* ===== 원화 참고 환산 ===== */}
                {fx && (
                  <small className="exp-won">{formatKrw(owed, fx.rate)}</small>
                )}

                {/* ===== 실제 카드나 현금으로 낸 금액 ===== */}
                <span className="exp-person-paid">결제 {formatAud(paid)}</span>
              </article>
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
        모든 지출을 합산한 최종 정산 결과야.
      </p>

      {/* ===== 사람별 결제액과 부담액 정리 ===== */}
      <div className="exp-settlement-summary">
        {PEOPLE.map((person) => {
          // ===== 실제 결제액에서 부담액 차감 =====
          const balance =
            personTotals.paid[person] -
            personTotals.owed[person];

          return (
            <div className="exp-settlement-person" key={person}>
              <div>
                <strong>{person}</strong>
                <small>
                  결제 {formatAud(personTotals.paid[person])}
                  {" · "}
                  부담 {formatAud(personTotals.owed[person])}
                </small>
              </div>

              {/* ===== 양수는 받을 돈, 음수는 보낼 돈 ===== */}
              <span>
                {balance > 0
                  ? `받을 돈 ${formatAud(balance)}`
                  : balance < 0
                    ? `보낼 돈 ${formatAud(-balance)}`
                    : "정산 없음"}
              </span>
            </div>
          );
        })}
      </div>

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
              key={`${transfer.from}-${transfer.to}`}
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
                  {formatAud(transfer.amountCents)}
                </strong>

                {fx && (
                  <small>
                    {formatKrw(transfer.amountCents, fx.rate)}
                  </small>
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

        {/* ===== 기록이 없는 경우 ===== */}
        {expenses.length === 0 ? (
          <div className="exp-empty">
            아직 기록된 지출이 없어.
            <br />
            추가 버튼으로 첫 지출을 등록해.
          </div>
        ) : (
          

<div className="exp-list">
    {/* ===== 왼쪽 스와이프로 수정·삭제하는 경비 목록 ===== */}
  {expenses.map((expense) => (
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
            </span>

            <strong>{expense.title}</strong>

            <small>결제 {expense.payer}</small>

            <small>
              참여 {expense.participants.join(", ")}
            </small>
          </div>

          {/* ===== 금액과 원화 환산액 ===== */}
          <div className="exp-item-right">
            <strong>
              {formatAud(expense.amountCents)}
            </strong>

            {fx && (
              <small className="exp-won">
                {formatKrw(
                  expense.amountCents,
                  fx.rate
                )}
              </small>
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
      <p className="exp-exchange-note">
        원화는 조회된 기준환율에 따른 참고 금액이야. 실제 카드 청구액과 다를 수
        있어.
      </p>

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
                금액 (AUD)
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                />
              </label>

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

              {/* ===== 개인별 분담 금액 미리보기 ===== */}
              <div className="exp-preview">
                <strong>분담 금액 미리보기</strong>

                {PEOPLE.map((person) => (
                  <div className="exp-preview-row" key={person}>
                    <span>{person}</span>
                    <b>{formatAud(previewShares[person])}</b>
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
    </div>
  );
}
