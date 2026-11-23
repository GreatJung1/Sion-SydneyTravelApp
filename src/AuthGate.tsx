
/* ===== 여행 전용 비밀번호 입장 화면 ===== */
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

/* ===== 허용된 여행용 Firebase 계정 ===== */
const TRAVEL_UID = "6K0pyVeBDKU8sMaz6KZt2MNFAe42";

/* ===== 이메일은 화면에 노출하지 않음 ===== */
const LOGIN_EMAIL = import.meta.env.VITE_TRAVEL_LOGIN_EMAIL ?? "";

export default function AuthGate({
  children,
}: {
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /* ===== 기존 로그인 상태 자동 확인 ===== */
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

  /* ===== 최초 비밀번호 인증 ===== */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setError("");
    setSubmitting(true);

    try {
      if (!LOGIN_EMAIL) {
        throw new Error("여행용 계정 이메일 설정이 필요해.");
      }

      /* 브라우저를 종료해도 로그인 유지 */
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
          ? "비밀번호 또는 계정 설정을 확인해 줘."
          : message || "로그인에 실패했어.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* ===== 자동 로그인 확인 중 ===== */
  if (loading) {
    return <div style={{ padding: 40 }}>여행 공간 연결 중...</div>;
  }

  /* ===== 인증 성공 시 기존 여행 앱 표시 ===== */
  if (allowed) {
    return <>{children}</>;
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f7f5f2",
        color: "#242424",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 340,
          display: "grid",
          gap: 16,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 34 }}>✳</div>
        <h1 style={{ margin: 0 }}>SYDNEY ’26</h1>
        <p>우리만의 여행 공간</p>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="여행 비밀번호"
          autoComplete="current-password"
          aria-label="여행 비밀번호"
          required
          style={{
            padding: 16,
            borderRadius: 12,
            border: "1px solid #ddd",
            fontSize: 16,
          }}
        />

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: 16,
            border: 0,
            borderRadius: 12,
            background: "#242424",
            color: "white",
            fontSize: 16,
            cursor: "pointer",
          }}
        >
          {submitting ? "확인 중..." : "입장하기"}
        </button>

        {error && <p role="alert" style={{ color: "#b42318" }}>{error}</p>}
      </form>
    </main>
  );
}
