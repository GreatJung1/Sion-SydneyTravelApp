# Sydney 2026 — Firebase 실시간 공유 테스트

이 ZIP은 **기존 `sydney-pwa-test` 폴더의 파일을 교체**하여 작동하는 Firebase 온라인 테스트입니다. 실제 여행 앱 전체가 아닌 로그인과 2~3인 실시간 공동 메모만 확인합니다.

## 1. Firebase 연결 설정

Firebase Console → 프로젝트 설정(톱니바퀴) → 일반 → 내 앱 → 웹 앱 → **SDK 설정 및 구성 / 구성(Config)** 에서 `firebaseConfig` 값을 확인합니다.

`firebase-config.js`를 VS Code로 열고, 아래 예시처럼 **값 전체를 교체**하세요. `export const`를 유지해야 합니다.

```javascript
export const firebaseConfig = {
  apiKey: "Firebase 콘솔에서 복사한 값",
  authDomain: "sion-sydneytravelapp.firebaseapp.com",
  projectId: "sion-sydneytravelapp",
  storageBucket: "Firebase 콘솔에서 복사한 값",
  messagingSenderId: "Firebase 콘솔에서 복사한 값",
  appId: "Firebase 콘솔에서 복사한 값"
};
```

Firebase 웹 앱 config는 공개 클라이언트 식별 정보이고 비밀번호/관리자 키가 아닙니다. **비밀번호, Firebase 서비스 계정 private key, 관리자 인증 파일을 코드 또는 공개 GitHub에 올리지 마세요.**

## 2. Firestore 보안 규칙 (반드시 먼저 설정)

Firebase Console → Authentication → 사용자(Users)에서 두 계정의 **UID**를 각각 복사하세요. Firebase Console → Firestore Database → **규칙(Rules)** 탭에 아래 내용을 붙여넣고, `첫번째_사용자_UID`, `두번째_사용자_UID`를 실제 UID로 바꾼 뒤 **게시(Publish)** 하세요.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function travelMember() {
      return request.auth != null &&
        request.auth.uid in ["첫번째_사용자_UID", "두번째_사용자_UID"];
    }

    match /trips/sydney2026/sharedNotes/{noteId} {
      allow read: if travelMember();
      allow create: if travelMember()
        && request.resource.data.keys().hasOnly(['text', 'createdBy', 'createdAt'])
        && request.resource.data.keys().hasAll(['text', 'createdBy', 'createdAt'])
        && request.resource.data.text is string
        && request.resource.data.text.size() > 0
        && request.resource.data.text.size() <= 300
        && request.resource.data.createdBy == request.auth.uid
        && request.resource.data.createdAt == request.time;
      allow update, delete: if false;
    }
  }
}
```

현재 규칙은 **이 두 UID만 공동 메모를 읽고 생성**할 수 있고, 삭제/수정은 막습니다. 세 번째 계정이 추가되면 UID를 배열에 하나 더 추가하세요.

> 보안 주의: 이미 다른 컬렉션을 사용하고 있다면 전체 Firestore 규칙을 무조건 덮어쓰지 말고 기존 규칙과 통합해야 합니다. 현재 새 프로젝트에서 테스트용으로 구성한 경우에만 통째로 적용합니다. 테스트가 끝나면 본 앱용 정교한 규칙으로 변경합니다.

## 3. GitHub 업로드

1. ZIP을 풀고 `firebase-config.js`에 실제 설정을 넣습니다.
2. 기존 저장소 `Sion-SydneyTravelApp` → `sydney-pwa-test` 폴더를 열고 `Add file → Upload files`로 들어갑니다.
3. 압축 푼 폴더 **안의 파일 9개**를 전부 업로드하고 `Commit changes` 합니다. ZIP 자체를 올리거나 **중첩된 폴더**를 만들면 안 됩니다.
4. GitHub Actions `pages build and deployment`가 성공했는지 확인합니다.
5. 기존 주소 `https://greatjung1.github.io/Sion-SydneyTravelApp/sydney-pwa-test/`를 엽니다.
6. 기존 Service Worker 캐시 때문에 구버전이 보이면 **새로고침 → 완전히 닫기 → 다시 열기**를 시도합니다. 캐시 제거 전에 기존 로컬 테스트 기록을 백업하세요.

## 4. 2명 동기화 검증

1. 기기 A에서 첫 번째 계정 로그인 → `테스트 1` 메모 추가.
2. 다른 브라우저나 기기 B에서 두 번째 계정 로그인 → 같은 메모가 보이면 서버 읽기 성공.
3. B에서 `테스트 2` 메모 추가 → A에 즉시 보이면 실시간 구독 성공.
4. 두 기기 모두 로그아웃/로그인한 뒤 기록이 유지되는지 확인.
5. 필요하면 `현재 공유 메모 JSON 백업` 버튼으로 메모를 내보낼 수 있습니다.

## 주의

- 로그인 사용자 2명은 이미 Firebase 콘솔에 생성되어 있어야 합니다. 이메일/비밀번호 로그인 제공업체를 켜야 합니다.
- 이 버전은 **온라인 동기화만** 검증합니다. 인터넷이 없을 때의 동작은 아직 보장하지 않습니다.
- 현재 Firestore 규칙은 `trips/sydney2026/sharedNotes` 경로만 허용합니다. 정산이나 일정 등은 나중에 경로별 규칙을 추가합니다.
- 기존 로컬 PWA 테스트 `localStorage` 기록은 Firebase로 자동 전송되지 않습니다.
- 계정 정보나 비밀번호를 채팅으로 보내지 마세요. UID와 웹 구성값만 설정에 사용합니다.
