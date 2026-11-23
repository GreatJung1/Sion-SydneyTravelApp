
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
// ===== 새로운 비밀의 문 로그인 화면 불러오기 =====
import AuthGate from "./AuthGate.tsx";

// ===== React 앱 시작 =====
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* ===== 로그인 후 기존 여행 앱 표시 ===== */}
    <AuthGate>
      <App />
    </AuthGate>
  </StrictMode>,
);
