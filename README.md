# SYDNEY ’26 여행 웹앱

React + TypeScript + Vite로 구현한 여행 일정·지도·경비·릴스 웹앱.

## 실행

Node.js 22.12 이상(권장 22 LTS) 설치 후:

```bash
npm ci
npm run dev
```

배포 전 검사:

```bash
npm run build
```

## GitHub Pages에 배포

1. GitHub에서 새 **Public** 저장소 생성 (예: `sydney-travel-app`).
2. 이 폴더의 **내용물 전체**를 저장소의 최상위에 업로드합니다. `src`만 올리거나 ZIP을 그대로 올리지 마세요.
3. `Settings → Pages → Build and deployment → Source`를 **GitHub Actions**로 변경합니다.
4. 저장소의 `main` 브랜치에 커밋하면 `.github/workflows/deploy.yml`이 자동 실행됩니다.
5. `Actions`에서 배포 성공을 확인하고 `https://사용자명.github.io/저장소이름/`에 접속합니다.

> 배포 스크립트는 저장소 이름을 자동으로 Vite `base` 경로에 적용합니다. 단, `사용자명.github.io`라는 루트 사이트 저장소에 올리는 경우에는 별도 `base` 조정이 필요합니다.

## 주의

- 일정·경비는 현재 **브라우저 localStorage**에 저장됩니다. 서로 다른 기기 및 사용자 간 자동 동기화는 아직 없습니다.
- GitHub Pages 웹사이트 배포는 Firebase 데이터베이스 설정과 별개입니다.
- Public 저장소에 올리면 여행 일정 등 소스 코드에 포함된 내용이 공개됩니다. 실명·숙소·항공편 등 민감한 내용을 올리기 전에 공개 범위를 검토하세요.
- `.env` 비밀키와 `node_modules`, `dist` 등은 Git에 올리지 않습니다.
