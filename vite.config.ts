import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 로컬에서는 루트(/), GitHub Pages에서는 저장소 경로를 사용
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES_BASE || "/",
});
