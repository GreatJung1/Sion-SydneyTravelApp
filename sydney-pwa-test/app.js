import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js';
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const $ = (id) => document.getElementById(id);
const show = (id, visible) => { $(id).hidden = !visible; $(id).classList.toggle('hidden', !visible); };
const setMessage = (id, text, isError = false) => { $(id).textContent = text; $(id).classList.toggle('error', isError); };
const updateNetwork = () => { $('net').textContent = navigator.onLine ? '온라인' : '오프라인 (동기화 불가)'; };
addEventListener('online', updateNetwork);
addEventListener('offline', updateNetwork);
updateNetwork();

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('REPLACE_')
  && firebaseConfig.appId && !firebaseConfig.appId.includes('REPLACE_');
if (!configured) {
  show('setup', true);
  $('session').textContent = '연결 설정 필요';
} else {
  try {
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const notesCollection = collection(db, 'trips', 'sydney2026', 'sharedNotes');
    let unsubscribe = null;
    let currentNotes = [];

    function render(notes) {
      const box = $('entries');
      box.replaceChildren();
      $('count').textContent = `${notes.length}건`;
      if (!notes.length) {
        const p = document.createElement('p');
        p.className = 'subtext';
        p.textContent = '아직 공유된 메모가 없어. 첫 번째 기록을 추가해 봐.';
        box.append(p);
      }
      for (const item of notes) {
        const div = document.createElement('div'); div.className = 'record';
        const p = document.createElement('p'); p.textContent = item.text || '';
        const small = document.createElement('small');
        const date = item.createdAt?.toDate?.();
        small.textContent = `${date ? date.toLocaleString('ko-KR') : '동기화 중'} · 작성자 UID ${String(item.createdBy || '').slice(0, 7)}…`;
        div.append(p, small); box.append(div);
      }
    }

    onAuthStateChanged(auth, (user) => {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
      currentNotes = [];
      show('loginBox', !user);
      show('notesBox', !!user);
      $('session').textContent = user ? '로그인됨' : '로그인 필요';
      if (!user) { setMessage('loginMsg', ''); return; }
      $('who').textContent = `접속 계정: ${user.email || ''}`;
      setMessage('noteMsg', 'Firestore에서 기록을 불러오는 중…');
      const q = query(notesCollection, orderBy('createdAt', 'desc'));
      unsubscribe = onSnapshot(q, (snapshot) => {
        currentNotes = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        render(currentNotes);
        setMessage('noteMsg', snapshot.metadata.fromCache
          ? '캐시 데이터 표시 중. 서버 연결 상태를 확인해.'
          : '서버와 동기화됨. 다른 계정에서도 같은 기록을 볼 수 있어.');
      }, (error) => {
        setMessage('noteMsg', error.code === 'permission-denied'
          ? '접근 거부: Firestore 규칙에 현재 계정의 UID가 포함됐는지 확인해.'
          : `동기화 오류: ${error.code || error.message}`, true);
      });
    });

    $('loginForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const btn = $('loginBtn'); btn.disabled = true;
      setMessage('loginMsg', '로그인 중…');
      try {
        await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
        $('password').value = '';
        setMessage('loginMsg', '');
      } catch (error) {
        setMessage('loginMsg', error.code === 'auth/invalid-credential'
          ? '이메일 또는 비밀번호를 확인해.'
          : `로그인 실패: ${error.code || error.message}`, true);
      } finally { btn.disabled = false; }
    });

    $('logout').addEventListener('click', async () => {
      try { await signOut(auth); } catch (error) { setMessage('noteMsg', `로그아웃 실패: ${error.code}`, true); }
    });

    $('noteForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const text = $('note').value.trim();
      if (!text || text.length > 300 || !auth.currentUser) return;
      if (!navigator.onLine) { setMessage('noteMsg', '이번 버전은 온라인에서만 기록을 추가해.', true); return; }
      const btn = $('addBtn'); btn.disabled = true;
      setMessage('noteMsg', '서버에 저장하는 중…');
      try {
        await addDoc(notesCollection, { text, createdBy: auth.currentUser.uid, createdAt: serverTimestamp() });
        $('note').value = '';
        setMessage('noteMsg', '서버에 저장 완료. 다른 계정에서 확인해.');
      } catch (error) {
        setMessage('noteMsg', error.code === 'permission-denied'
          ? '저장 거부: Firestore 규칙에 로그인 UID가 포함됐는지 확인해.'
          : `저장 실패: ${error.code || error.message}`, true);
      } finally { btn.disabled = false; }
    });

    $('export').addEventListener('click', () => {
      const data = {
        format: 'sydney-shared-notes-test', version: 1, exportedAt: new Date().toISOString(),
        notes: currentNotes.map(({ id, text, createdBy, createdAt }) => ({
          id, text, createdBy, createdAt: createdAt?.toDate?.()?.toISOString() || null
        }))
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type:'application/json'}));
      const a = document.createElement('a');
      a.href = url; a.download = `sydney-shared-notes-${new Date().toISOString().slice(0,10)}.json`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
    });
  } catch (error) {
    show('setup', true);
    $('setup').querySelector('p').textContent = `Firebase 초기화 오류: ${error.message}`;
    $('session').textContent = '초기화 실패';
  }
}
