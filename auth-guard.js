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
// 카카오 로그인 (팝업 방식)
// ============================================
function loginWithKakao() {
  const KAKAO_REDIRECT_URI = 'https://ytp20231992.github.io/busukgi-auth/';
  const KAKAO_REST_API_KEY = 'f100a5892b84f1c7b80ec313c76fb647';

  const authUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code`;

  // 팝업 창 열기
  const popup = window.open(authUrl, 'KakaoAdminLogin', 'width=500,height=600,popup=yes');

  if (!popup) {
    alert('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.');
    return;
  }

  console.log('카카오 로그인 팝업 열림');

  // postMessage 수신 대기
  const messageHandler = async (event) => {
    // 보안: origin 확인
    if (event.origin !== 'https://ytp20231992.github.io') {
      return;
    }

    if (event.data.type === 'KAKAO_LOGIN_SUCCESS') {
      console.log('카카오 로그인 성공 메시지 수신:', event.data);

      // 관리자 권한 확인
      if (event.data.user.kakao_id !== ADMIN_KAKAO_ID) {
        alert('❌ 관리자 권한이 없습니다.\\n\\n등록된 관리자만 접근할 수 있습니다.');
        window.removeEventListener('message', messageHandler);
        return;
      }

      // JWT 토큰과 사용자 정보 저장
      localStorage.setItem('admin_kakao_id', event.data.user.kakao_id);
      localStorage.setItem('admin_token', event.data.token);
      localStorage.setItem('admin_name', event.data.user.nickname || '관리자');

      // 리스너 제거
      window.removeEventListener('message', messageHandler);

      // 페이지 리로드
      window.location.reload();

    } else if (event.data.type === 'KAKAO_LOGIN_ERROR') {
      console.error('카카오 로그인 실패:', event.data.error);
      alert('로그인에 실패했습니다: ' + (event.data.error || '알 수 없는 오류'));
      window.removeEventListener('message', messageHandler);
    }
  };

  window.addEventListener('message', messageHandler);

  // 팝업이 닫히면 리스너 제거
  const popupCheckInterval = setInterval(() => {
    if (popup.closed) {
      clearInterval(popupCheckInterval);
      window.removeEventListener('message', messageHandler);
      console.log('팝업이 닫혔습니다');
    }
  }, 500);
}

// ============================================
// URL에서 인증 코드 처리 (팝업 방식으로 변경되어 더 이상 사용 안 함)
// ============================================
async function handleKakaoCallback() {
  // 팝업 방식을 사용하므로 URL 콜백 처리는 불필요
  return false;
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
