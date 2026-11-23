
/* ===== Firebase 앱 연결 ===== */
import { initializeApp, getApps, getApp } from "firebase/app";

/* ===== Firebase 로그인 기능 ===== */
import { getAuth } from "firebase/auth";

/* ===== Firestore 실시간 데이터베이스 ===== */
import { getFirestore } from "firebase/firestore";

/* ===== 기존 시드니 여행 Firebase 프로젝트 설정 ===== */
const firebaseConfig = {
  apiKey: "AIzaSyDscESeiCLdzD40kIcg-CNx8iLWAt7gOhA",
  authDomain: "sion-sydneytravelapp.firebaseapp.com",
  projectId: "sion-sydneytravelapp",
  storageBucket: "sion-sydneytravelapp.firebasestorage.app",
  messagingSenderId: "563818485347",
  appId: "1:563818485347:web:00504bd7fa8fbef7fc0a56",
};

/* ===== 중복 초기화 방지 ===== */
export const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

/* ===== 로그인 관리 객체 ===== */
export const auth = getAuth(app);

/* ===== 공동 일정·경비 데이터베이스 ===== */
export const db = getFirestore(app);
