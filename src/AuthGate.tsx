/* ===== 시드니 초대장 로그인: 기존 Firebase 인증 유지 ===== */
import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import "./auth-gate.css";

/* ===== 기존 여행 전용 계정 ===== */
const TRAVEL_UID = "6K0pyVeBDKU8sMaz6KZt2MNFAe42";
const LOGIN_EMAIL = import.meta.env.VITE_TRAVEL_LOGIN_EMAIL ?? "";

type Scene = "closed" | "opening" | "letter";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [scene, setScene] = useState<Scene>("closed");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ===== 로그인 상태 복원: 로그인되어 있으면 연출 건너뛰기 ===== */
  useEffect(() => {
    return onAuthStateChanged(
      auth,
      (user) => {
        if (user && user.uid !== TRAVEL_UID) {
          void signOut(auth);
          setAllowed(false);
        } else {
          setAllowed(Boolean(user));
        }
        setLoading(false);
      },
      () => {
        setError("로그인 상태를 확인하지 못했어.");
        setLoading(false);
      },
    );
  }, []);

  /* ===== 봉투를 연 뒤 종이 입력 화면으로 전환 ===== */
  useEffect(() => {
    if (scene !== "opening") return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const timer = window.setTimeout(
      () => setScene("letter"),
      reduceMotion ? 100 : 1550,
    );
    return () => window.clearTimeout(timer);
  }, [scene]);

  /* ===== 실제 Firebase 비밀번호 인증 ===== */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);

    try {
      if (!LOGIN_EMAIL) {
        throw new Error("여행용 계정 이메일 설정을 확인해 줘.");
      }

      /* ===== 종이에 서명하는 연출이 끝날 때까지 대기 ===== */
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (!reduceMotion) {
        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1100);
        });
      }

      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithEmailAndPassword(
        auth,
        LOGIN_EMAIL,
        password,
      );

      if (result.user.uid !== TRAVEL_UID) {
        await signOut(auth);
        throw new Error("허용된 여행 계정이 아니야.");
      }
      setPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message.startsWith("Firebase:")
          ? "비밀번호를 확인해 줘."
          : message || "입장에 실패했어.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="letter-entry letter-entry--loading">
        <span>SYDNEY ’26</span>
      </div>
    );
  }

  if (allowed) return <>{children}</>;

  return (
    <main className="letter-entry">
      {/* ===== 배경: 그림자와 빛이 드리운 어두운 책상 ===== */}
      <div className="letter-entry__spotlight" aria-hidden="true" />

      {scene !== "letter" ? (
        <section className="letter-entry__intro" aria-label="여행 초대장 봉투">
          <p className="letter-entry__eyebrow">시드니에서 날라온</p>
          <h1 className="letter-entry__intro-title">수상한 초대장…</h1>

          {/* ===== 봉투 전체가 실제 클릭 버튼 ===== */}
          <button
            className={`letter-entry__envelope ${scene === "opening" ? "is-opening" : ""}`}
            type="button"
            onClick={() => setScene("opening")}
            disabled={scene === "opening"}
            aria-label="초대장 봉투 열기"
          >
            <span className="letter-entry__envelope-back" />

            {/* ===== 봉투에서 실제로 위로 올라오는 편지 ===== */}
            <span className="letter-entry__peek-paper" aria-hidden="true">
              <span className="letter-entry__peek-small">
                PERSONAL & CONFIDENTIAL
              </span>
              <span className="letter-entry__peek-title">SYDNEY ’26</span>
              <span className="letter-entry__peek-line" />
            </span>

            {/* ===== 접힌 봉투의 앞면 ===== */}
            <span className="letter-entry__fold letter-entry__fold--left" />
            <span className="letter-entry__fold letter-entry__fold--right" />
            <span className="letter-entry__fold letter-entry__fold--bottom" />

            {/* ===== 위쪽 삼각 덮개 ===== */}
            <span className="letter-entry__flap" />

            {/* ===== 밀랍 봉인 ===== */}
            <span className="letter-entry__wax" aria-hidden="true">
              S
            </span>
          </button>
         
{/* ===== 봉투 아래 작은 개봉 안내 ===== */}
<p className="letter-entry__instruction">
  {scene === "opening"
    ? "봉인을 푸는 중..."
    : "봉인을 눌러 열어보세요"}
</p>

          <p className="letter-entry__date">15 — 24 DECEMBER 2026</p>
        </section>
      ) : (
        /* ===== 실제 비밀번호 입력이 가능한 종이 초대장 ===== */
        <section
          className="letter-entry__paper"
          aria-label="시드니 여행 초대장"
        >
          <div className="letter-entry__paper-border">
            <p className="letter-entry__letterhead">A PRIVATE INVITATION</p>
            {/* <div className="letter-entry__monogram" aria-hidden="true">S</div> */}
            {/* <p className="letter-entry__salutation">You are cordially invited to</p> */}
            <h1 className="letter-entry__paper-title">
              SYDNEY <em>’26</em>
            </h1>
            <div className="letter-entry__divider" aria-hidden="true">
              ✦
            </div>

            <p className="letter-entry__message">
              당신 앞으로 한 통의 편지가 도착했습니다.
              <br />
              목적지는 시드니, 출발은 12월 15일.
              <br />
              초대장을 열 마지막 열쇠는
              <br />
              세은이의 생년월일입니다.
            </p>

            <form className="letter-entry__form" onSubmit={handleSubmit}>
              <input
                id="trip-secret-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="oooooo"
                autoComplete="current-password"
                required
              />

              {/* ===== 편지지에 직접 서명하는 초대 수락 버튼 ===== */}
              <button
                type="submit"
                className={`letter-entry__sign-button ${submitting ? "is-signing" : ""}`}
                disabled={submitting}
                aria-label={submitting ? "서명 및 인증 중" : "초대 수락하기"}
              >
                <span className="letter-entry__sign-label">초대 수락하기</span>

                {/* ===== 잉크로 그려지는 서명 선 ===== */}
                <svg
                  className="letter-entry__sign-drawing"
                  viewBox="0 0 230 55"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    pathLength="100"
                    d="M8 40
         C22 31 25 8 35 16
         C45 25 19 49 39 36
         C51 26 51 15 58 32
         S71 43 80 26
         C89 12 90 42 104 31
         S119 20 132 32
         S150 40 161 25
         C176 13 177 40 193 32
         S214 24 224 29"
                  />
                </svg>
              </button>

              {error && (
                <p className="letter-entry__error" role="alert">
                  {error}
                </p>
              )}
            </form>
            <p className="letter-entry__footer">SYDNEY · AUSTRALIA · 2026</p>
          </div>
        </section>
      )}
    </main>
  );
}
