# Sydney PWA iPhone Test

## 배포 (GitHub Pages)
1. GitHub에 새 **Public** 저장소를 만듭니다 (예: `sydney-pwa-test`).
2. 이 폴더의 **파일 7개를 저장소 최상위(root)**에 업로드합니다. ZIP 자체를 올리지 마세요.
3. 저장소 `Settings → Pages → Build and deployment`에서 `Deploy from a branch`, `main`, `/(root)`를 선택해 저장합니다.
4. Pages 화면에 표시되는 `https://사용자명.github.io/sydney-pwa-test/` 주소로 아이폰 Safari에서 접속합니다. 배포 완료까지 몇 분 걸릴 수 있습니다.
5. Safari 공유 메뉴 → `홈 화면에 추가` → 추가.
6. 홈 화면 아이콘에서 실행하여 기록 저장 후 종료/재실행 테스트. 이후 온라인에서 앱을 한 번 열고 비행기 모드 테스트.

## 로컬 PC 테스트
VS Code Live Server 또는 `python -m http.server 8000` 실행 후 `http://localhost:8000` 접속. `file://`로 파일을 직접 열면 Service Worker가 동작하지 않습니다.

## 주의
- 이 테스트는 **localStorage**를 사용합니다. 본 앱은 IndexedDB 예정.
- 홈 화면에 추가한 앱과 Safari 탭은 iOS에서 저장 공간이 별도로 취급될 수 있습니다. **홈 화면 아이콘에서 저장한 기록은 그 아이콘으로 다시 열어 확인**하세요.
- 웹 저장소는 영구 보관이 보장되지 않습니다. JSON 백업을 파일 앱/iCloud Drive에 저장하세요.
- GitHub Pages는 공개 사이트입니다. 개인정보·비밀번호를 코드에 넣지 마세요.
