 // auth-guard.js
// 관리자 대시보드 접근 제어

// ============================================
// Configuration
// ============================================
// admin.js에서 이미 선언되므로 여기서는 선언하지 않음
// const SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_KAKAO_ID는 admin.js에서 전역으로 사용

// Kakao SDK 설정
const KAKAO_JS_KEY = '3c9c0a87136909fcbdc02c3b429f00a5'; // 카카오 JavaScript 키

// ============================================
// 초기화
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  // Kakao SDK 초기화
  if (typeof Kakao !== 'undefined' && !Kakao.isInitialized()) {
    Kakao.init(KAKAO_JS_KEY);
  }

  // 인증 확인
  await checkAuth();
});

// ============================================
// 인증 확인
// ============================================
async function checkAuth() {
  // 먼저 URL에 인증 코드가 있는지 확인 (카카오 로그인 콜백)
  const hasCallback = await handleKakaoCallback();
  if (hasCallback) {
    return; // 콜백 처리 중이면 여기서 종료
  }

  const adminToken = localStorage.getItem('admin_token');
  const adminKakaoId = localStorage.getItem('admin_kakao_id');

  // 1. 로컬 스토리지 체크
  if (!adminToken || !adminKakaoId) {
    showLoginScreen();
    return;
  }

  // 2. 관리자 ID 검증
  if (adminKakaoId !== ADMIN_KAKAO_ID) {
    alert('관리자 권한이 없습니다.');
    logout();
    return;
  }

  // 3. 토큰 유효성 검증 (Supabase API 호출)
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        admin_kakao_id: adminKakaoId,
        action: 'get_stats'
      }),
    });

    if (!response.ok) {
      throw new Error('인증 실패');
    }

    // 인증 성공 - 대시보드 표시
    showDashboard();
    updateAdminInfo();

    // admin.js 초기화
    if (typeof initAdminDashboard === 'function') {
      initAdminDashboard();
    }

  } catch (error) {
    console.error('인증 오류:', error);
    alert('세션이 만료되었습니다. 다시 로그인해주세요.');
    logout();
  }
}

// ============================================
// 로그인 화면 표시
// ============================================
function showLoginScreen() {
  document.body.innerHTML = `
    <div style="
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    ">
      <div style="
        background: white;
        padding: 48px;
        border-radius: 24px;
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
        text-align: center;
        max-width: 400px;
        width: 90%;
      ">
        <h1 style="
          font-size: 28px;
          color: #667eea;
          margin-bottom: 12px;
        ">🏠 SanGa Pro</h1>
        <p style="
          color: #666;
          margin-bottom: 32px;
          font-size: 16px;
        ">관리자 대시보드</p>

        <div style="
          background: #f8f9fa;
          padding: 20px;
          border-radius: 12px;
          margin-bottom: 24px;
        ">
          <p style="
            color: #666;
            font-size: 14px;
            line-height: 1.6;
          ">
            관리자만 접근할 수 있습니다.<br>
            카카오 계정으로 로그인하세요.
          </p>
        </div>

        <button id="kakaoLoginBtn" style="
          width: 100%;
          padding: 16px;
          background: #FEE500;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        ">
          <span>카카오 로그인</span>
        </button>
      </div>
    </div>
  `;

  // 카카오 로그인 버튼 이벤트
  document.getElementById('kakaoLoginBtn').addEventListener('click', loginWithKakao);
}

// ============================================
// 카카오 로그인
// ============================================
function loginWithKakao() {
  if (typeof Kakao === 'undefined') {
    alert('카카오 SDK 로딩 중입니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  // 카카오 SDK v2 방식: authorize 사용
  Kakao.Auth.authorize({
    redirectUri: window.location.href
  });
}

// ============================================
// URL에서 인증 코드 처리
// ============================================
async function handleKakaoCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');

  if (!code) {
    return false; // 인증 코드가 없으면 일반 플로우 진행
  }

  console.log('카카오 인증 코드 감지:', code);

  try {
    // 인증 코드를 토큰으로 교환
    const tokenResponse = await fetch(`https://kauth.kakao.com/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'f100a5892b84f1c7b80ec313c76fb647',
        redirect_uri: window.location.origin + window.location.pathname,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error('토큰 발급 실패');
    }

    console.log('토큰 발급 성공');

    // 사용자 정보 가져오기
    const userResponse = await fetch(`https://kapi.kakao.com/v2/user/me`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
      },
    });

    const userData = await userResponse.json();
    console.log('사용자 정보:', userData);

    const kakaoId = userData.id.toString();

    // 관리자 ID 확인
    if (kakaoId !== ADMIN_KAKAO_ID) {
      alert('❌ 관리자 권한이 없습니다.\n\n등록된 관리자만 접근할 수 있습니다.');
      // URL 파라미터 제거하고 로그인 화면으로
      window.history.replaceState({}, document.title, window.location.pathname);
      showLoginScreen();
      return true;
    }

    console.log('관리자 권한 확인 완료, Supabase 인증 시작');

    // Supabase auth-kakao-callback 호출하여 JWT 토큰 발급
    const authResponse = await fetch(`${SUPABASE_URL}/functions/v1/auth-kakao-callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        access_token: tokenData.access_token
      }),
    });

    const authData = await authResponse.json();

    if (!authResponse.ok) {
      throw new Error(authData.error || 'Supabase 인증 실패');
    }

    console.log('Supabase 인증 성공:', authData);

    // 로컬 스토리지에 저장 (JWT 토큰 사용)
    localStorage.setItem('admin_kakao_id', kakaoId);
    localStorage.setItem('admin_token', authData.token);  // JWT 토큰
    localStorage.setItem('admin_name', userData.kakao_account?.profile?.nickname || '관리자');

    // URL 파라미터 제거하고 리로드
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();

    return true;

  } catch (error) {
    console.error('카카오 로그인 처리 실패:', error);
    alert('로그인 처리 중 오류가 발생했습니다.');
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }
}

// ============================================
// 대시보드 표시
// ============================================
function showDashboard() {
  // 원래 HTML이 표시됨 (로그인 화면이 아닌 경우)
  document.body.style.display = 'block';
}

// ============================================
// 관리자 정보 업데이트
// ============================================
function updateAdminInfo() {
  const adminName = localStorage.getItem('admin_name') || '관리자';
  const adminNameEl = document.getElementById('adminName');
  if (adminNameEl) {
    adminNameEl.textContent = `${adminName} 님`;
  }
}

// ============================================
// 로그아웃
// ============================================
function logout() {
  // 로컬 스토리지 클리어
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_kakao_id');
  localStorage.removeItem('admin_name');

  // 로그인 화면으로
  window.location.reload();
}

// ============================================
// 전역 함수 노출
// ============================================
window.adminLogout = logout;
