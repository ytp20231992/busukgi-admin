// admin.js
// 관리자 대시보드 JavaScript

// ============================================
// Configuration
// ============================================
const SUPABASE_URL = 'https://asdqtfuvjlsgjazseekm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZHF0ZnV2amxzZ2phenNlZWttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3NzAwODAsImV4cCI6MjA3ODM0NjA4MH0.wLnBozm_DHUQpM68PZXXJ_02u_tW3t5KVcupove926U';
const ADMIN_KAKAO_ID = '4519453813'; // 환경변수와 동일하게 설정

// ============================================
// State
// ============================================
let currentUsers = [];
let currentPage = 1;
const USERS_PER_PAGE = 20;
let currentTab = 'users';

// ============================================
// Initialization
// ============================================
// auth-guard.js에서 인증이 완료된 후 호출됨
function initAdminDashboard() {
  updateDeployTime();
  initTabs();
  refreshData();

  // Form handlers
  document.getElementById('addSubForm').addEventListener('submit', handleAddSubscription);
  document.getElementById('memoForm').addEventListener('submit', handleUpdateMemo);
  document.getElementById('blockForm').addEventListener('submit', handleBlockUser);
  document.getElementById('editUserForm').addEventListener('submit', handleEditUser);

  // Search on Enter
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      searchUsers();
    }
  });
}

// ============================================
// Tab Management
// ============================================
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tab = button.dataset.tab;
      switchTab(tab);
    });
  });
}

function switchTab(tab) {
  currentTab = tab;

  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tab}`);
  });

  // Load data for tab
  if (tab === 'users') {
    loadUsers();
  } else if (tab === 'deleted') {
    loadDeletedUsers();
  } else if (tab === 'groups') {
    loadGroups();
  } else if (tab === 'molit-status') {
    loadMolitStatus();
  } else if (tab === 'pnu-matcher') {
    loadPnuStats();
  } else if (tab === 'lookup-stats') {
    loadLookupStats();
  } else if (tab === 'session-stats') {
    loadSessionStats();
  } else if (tab === 'settings') {
    loadAppSettings();
  }
}

// ============================================
// API Calls
// ============================================
async function callAdminAPI(action, data = {}) {
  try {
    const adminToken = localStorage.getItem('admin_token');

    if (!adminToken) {
      throw new Error('인증 토큰이 없습니다. 다시 로그인해주세요.');
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        admin_token: adminToken,
        action: action,
        ...data
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('❌ API 오류 상세:', {
        status: response.status,
        statusText: response.statusText,
        result: result,
        action: action,
        data: data
      });
      throw new Error(result.error || result.details || `API 호출 실패 (${response.status})`);
    }

    return result;
  } catch (error) {
    console.error('API 오류:', error);
    showError(error.message);
    throw error;
  }
}

// ============================================
// Data Loading
// ============================================
async function refreshData() {
  showLoading(true);
  hideMessages();

  try {
    // Load stats
    const result = await callAdminAPI('get_stats');
    updateStats(result.stats);

    // Load current tab data
    if (currentTab === 'users') {
      await loadUsers();
    } else if (currentTab === 'settings') {
      await loadAppSettings();
    }

    // Update sync time
    document.getElementById('lastSync').textContent =
      `마지막 동기화: ${new Date().toLocaleTimeString('ko-KR')}`;

    showSuccess('데이터를 새로고침했습니다.');
    setTimeout(hideMessages, 3000);

  } catch (error) {
    showError('데이터 로드 실패: ' + error.message);
  } finally {
    showLoading(false);
  }
}

let currentSubscriptionFilter = 'all'; // all, active, expired, none

async function loadUsers(search = '') {
  showLoading(true);

  try {
    const result = await callAdminAPI('list_users', {
      search: search || undefined
    });

    currentUsers = result.users || [];
    currentPage = 1;

    renderUsersTable();
  } catch (error) {
    showError('사용자 목록 로드 실패');
  } finally {
    showLoading(false);
  }
}

function setSubscriptionFilter(filter) {
  currentSubscriptionFilter = filter;

  // 필터 버튼 활성화 상태 업데이트
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  renderUsersTable();
}

async function loadSubscriptions() {
  const container = document.getElementById('subscriptionsContent');

  try {
    const result = await callAdminAPI('list_users');
    const users = result.users || [];

    console.log('전체 사용자 수:', users.length);
    console.log('샘플 사용자 데이터:', users[0]);

    // Filter users with active subscriptions (구독 종료일이 미래인 경우만)
    const activeSubscriptions = users.filter(u => {
      const hasSubscription = u.plan && u.plan !== 'free';
      const isActive = u.end_date && new Date(u.end_date) > new Date();

      console.log(`User ${u.nickname || u.username}: plan=${u.plan}, status=${u.status}, end_date=${u.end_date}, isActive=${isActive}`);

      return hasSubscription && isActive;
    });

    console.log('활성 구독 수:', activeSubscriptions.length);

    if (activeSubscriptions.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <div class="message">활성 구독이 없습니다</div>
          <div class="submessage">구독 종료일이 아직 남아있는 유료 구독이 없습니다</div>
        </div>
      `;
      return;
    }

    // Render table
    let html = `
      <table>
        <thead>
          <tr>
            <th>사용자</th>
            <th>플랜</th>
            <th>시작일</th>
            <th>종료일</th>
            <th>남은 기간</th>
            <th>상태</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
    `;

    activeSubscriptions.forEach(user => {
      const startDate = user.start_date ? new Date(user.start_date).toLocaleDateString('ko-KR') : '-';
      const endDate = user.end_date ? new Date(user.end_date).toLocaleDateString('ko-KR') : '-';

      // Calculate days left
      const daysLeft = user.end_date ? Math.ceil((new Date(user.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

      // Subscription count
      const subCount = user.subscription_count || 1;

      html += `
        <tr>
          <td>
            <strong>${escapeHtml(user.nickname || user.username || user.kakao_id)}</strong>
            ${user.email ? `<br><small>${escapeHtml(user.email)}</small>` : ''}
            ${subCount > 1 ? `<br><small style="color: #667eea;">📋 총 ${subCount}회 구독</small>` : ''}
          </td>
          <td><span class="badge ${user.plan}">${user.plan.toUpperCase()}</span></td>
          <td>${startDate}</td>
          <td>${endDate}</td>
          <td>${daysLeft > 0 ? daysLeft + '일' : '만료됨'}</td>
          <td><span class="badge active">활성</span></td>
          <td>
            <button class="action-btn secondary" onclick='viewSubscriptionHistory("${user.user_id}", "${escapeHtml(user.nickname || user.username || user.kakao_id)}")'>📋 이력</button>
            <button class="action-btn primary" onclick='openAddSubModal("${user.user_id}")'>➕ 연장</button>
            <button class="action-btn danger" onclick='cancelSubscription("${user.user_id}")'>❌ 취소</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

  } catch (error) {
    showError('구독 목록 로드 실패');
  }
}

// ============================================
// Subscription Management Modal (통합 구독 관리)
// ============================================
let currentManageUserId = null;
let currentManageUser = null;

async function openSubscriptionManageModal(user) {
  currentManageUserId = user.user_id;
  currentManageUser = user;

  const modal = document.getElementById('subscriptionManageModal');
  const content = document.getElementById('subscriptionManageContent');

  content.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">로딩 중...</p>';
  openModal('subscriptionManageModal');

  try {
    const result = await callAdminAPI('get_subscription_history', { userId: user.user_id });
    const history = result.history || [];

    const displayName = user.nickname || user.username || user.kakao_id;

    if (history.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <div class="message">구독 이력이 없습니다</div>
          <div class="submessage">${escapeHtml(displayName)}님의 구독 이력이 없습니다.</div>
        </div>
      `;
    } else {
      let html = `
        <h4 style="margin-bottom: 16px;">${escapeHtml(displayName)}님의 구독 이력</h4>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>플랜</th>
              <th>타입</th>
              <th>시작일</th>
              <th>종료일</th>
              <th>기간</th>
              <th>상태</th>
              <th>등록일</th>
            </tr>
          </thead>
          <tbody>
      `;

      history.forEach((sub, index) => {
        const startDate = new Date(sub.start_date).toLocaleDateString('ko-KR');
        const endDate = new Date(sub.end_date).toLocaleDateString('ko-KR');
        const createdAt = new Date(sub.created_at).toLocaleDateString('ko-KR');
        const durationDays = Math.ceil((new Date(sub.end_date) - new Date(sub.start_date)) / (1000 * 60 * 60 * 24));

        const subType = sub.subscription_type === 'current' ? '현재' : '예약';
        const subTypeClass = sub.subscription_type === 'current' ? 'active' : 'warning';

        const statusClass = sub.status === 'active' ? 'active' :
                           sub.status === 'cancelled' ? 'blocked' :
                           sub.status === 'refunded' ? 'danger' : 'expired';
        const statusText = sub.status === 'active' ? '활성' :
                          sub.status === 'cancelled' ? '취소됨' :
                          sub.status === 'refunded' ? '환불됨' : '만료';

        html += `
          <tr>
            <td>${history.length - index}</td>
            <td><span class="badge ${sub.plan}">${sub.plan.toUpperCase()}</span></td>
            <td><span class="badge ${subTypeClass}">${subType}</span></td>
            <td>${startDate}</td>
            <td>${endDate}</td>
            <td>${durationDays}일</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>${createdAt}</td>
          </tr>
        `;
      });

      html += `</tbody></table>`;

      // 통계 정보 추가
      const totalDays = history
        .filter(s => s.status !== 'refunded')
        .reduce((sum, s) => sum + Math.ceil((new Date(s.end_date) - new Date(s.start_date)) / (1000 * 60 * 60 * 24)), 0);

      html += `
        <div style="margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
          <strong>📊 통계</strong><br>
          <small>총 구독 횟수: ${history.length}회 | 총 구독 일수: ${totalDays}일</small>
        </div>
      `;

      content.innerHTML = html;
    }

    // 버튼 표시/숨김 처리
    const hasActiveSubscription = user.subscription_id && user.status === 'active' && user.end_date && new Date(user.end_date) > new Date();
    const hasScheduled = user.scheduled_subscription && user.scheduled_subscription.status === 'active';

    document.getElementById('btnCancelScheduled').style.display = hasScheduled ? 'inline-block' : 'none';
    document.getElementById('btnCancelAll').style.display = hasActiveSubscription ? 'inline-block' : 'none';

  } catch (error) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="icon">❌</div>
        <div class="message">구독 이력을 불러올 수 없습니다</div>
        <div class="submessage">${escapeHtml(error.message)}</div>
      </div>
    `;
  }
}

function openAddSubModalFromManage() {
  if (!currentManageUserId) return;
  openAddSubModal(currentManageUserId);
}

async function cancelScheduledFromManage() {
  if (!currentManageUserId) return;
  await cancelScheduledSubscription(currentManageUserId);
  // 모달 새로고침
  await openSubscriptionManageModal(currentManageUser);
}

async function cancelAllFromManage() {
  if (!currentManageUserId) return;
  await cancelAllSubscriptions(currentManageUserId);
  closeModal();
  await loadUsers();
}

// ============================================
// Subscription History Management (구독관리 탭 제거로 주석 처리)
// ============================================
async function viewSubscriptionHistory(userId, userName) {
  const modal = document.getElementById('subscriptionHistoryModal');
  const content = document.getElementById('subscriptionHistoryContent');

  content.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">로딩 중...</p>';
  openModal('subscriptionHistoryModal');

  try {
    const result = await callAdminAPI('get_subscription_history', { userId });
    const history = result.history || [];

    if (history.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <div class="message">구독 이력이 없습니다</div>
        </div>
      `;
      return;
    }

    let html = `
      <h4 style="margin-bottom: 16px;">${escapeHtml(userName)}님의 구독 이력</h4>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>플랜</th>
            <th>시작일</th>
            <th>종료일</th>
            <th>기간</th>
            <th>상태</th>
            <th>등록일</th>
          </tr>
        </thead>
        <tbody>
    `;

    history.forEach((sub, index) => {
      const startDate = new Date(sub.start_date).toLocaleDateString('ko-KR');
      const endDate = new Date(sub.end_date).toLocaleDateString('ko-KR');
      const createdAt = new Date(sub.created_at).toLocaleDateString('ko-KR');
      const durationDays = Math.ceil((new Date(sub.end_date) - new Date(sub.start_date)) / (1000 * 60 * 60 * 24));

      const statusClass = sub.status === 'active' ? 'active' :
                         sub.status === 'cancelled' ? 'blocked' :
                         sub.status === 'refunded' ? 'danger' : 'expired';
      const statusText = sub.status === 'active' ? '활성' :
                        sub.status === 'cancelled' ? '취소됨' :
                        sub.status === 'refunded' ? '환불됨' : '만료';

      html += `
        <tr>
          <td>${history.length - index}</td>
          <td><span class="badge ${sub.plan}">${sub.plan.toUpperCase()}</span></td>
          <td>${startDate}</td>
          <td>${endDate}</td>
          <td>${durationDays}일</td>
          <td><span class="badge ${statusClass}">${statusText}</span></td>
          <td>${createdAt}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;

    // 통계 정보 추가
    const totalDays = history
      .filter(s => s.status !== 'refunded')
      .reduce((sum, s) => sum + Math.ceil((new Date(s.end_date) - new Date(s.start_date)) / (1000 * 60 * 60 * 24)), 0);

    html += `
      <div style="margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <strong>📊 통계</strong><br>
        <small>총 구독 횟수: ${history.length}회 | 총 구독 일수: ${totalDays}일</small>
      </div>
    `;

    content.innerHTML = html;

  } catch (error) {
    content.innerHTML = `
      <div class="empty-state">
        <div class="icon">❌</div>
        <div class="message">구독 이력을 불러올 수 없습니다</div>
        <div class="submessage">${escapeHtml(error.message)}</div>
      </div>
    `;
  }
}

// 예약 구독만 취소
async function cancelScheduledSubscription(userId) {
  if (!confirm('예약 구독을 취소하시겠습니까?\n\n현재 구독은 유지되며, 예약 구독만 취소됩니다.')) {
    return;
  }

  try {
    await callAdminAPI('cancel_scheduled_subscription', { userId });
    showSuccess('예약 구독이 취소되었습니다.');

    // 현재 탭에 따라 적절한 목록 새로고침
    if (currentTab === 'users') {
      await loadUsers();
    }
  } catch (error) {
    showError('예약 구독 취소 실패: ' + error.message);
  }
}

// 모든 구독 취소 (현재 + 예약)
async function cancelAllSubscriptions(userId) {
  if (!confirm('⚠️ 모든 구독을 취소하시겠습니까?\n\n현재 구독과 예약 구독이 모두 취소됩니다.\n구독 기간 만료 후 서비스가 종료됩니다.')) {
    return;
  }

  try {
    await callAdminAPI('cancel_subscription', { userId });
    showSuccess('모든 구독이 취소되었습니다.');

    // 현재 탭에 따라 적절한 목록 새로고침
    if (currentTab === 'users') {
      await loadUsers();
    }
  } catch (error) {
    showError('구독 취소 실패: ' + error.message);
  }
}

// ============================================
// Deleted Users Management
// ============================================
async function loadDeletedUsers() {
  const container = document.getElementById('deletedUsersContent');
  showLoading(true);

  try {
    const result = await callAdminAPI('list_deleted_users');
    const blockedUsers = result.blockedUsers || [];
    const deletedUsers = result.deletedUsers || [];

    if (blockedUsers.length === 0 && deletedUsers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <div class="message">차단/탈퇴한 회원이 없습니다</div>
        </div>
      `;
      return;
    }

    let html = `
      <div style="margin-bottom: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
        <strong>📊 요약:</strong>
        차단 ${blockedUsers.length}명 | 탈퇴 ${deletedUsers.length}명
      </div>
    `;

    // 1. 차단된 사용자
    if (blockedUsers.length > 0) {
      html += `
        <h3 style="margin-top: 20px; margin-bottom: 10px;">🚫 차단된 회원 (${blockedUsers.length}명)</h3>
        <table>
          <thead>
            <tr>
              <th>사용자</th>
              <th>가입일</th>
              <th>차단일</th>
              <th>차단 사유</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
      `;

      blockedUsers.forEach(item => {
        const user = item.user;
        if (!user) return;

        const displayName = user.nickname || user.username || user.kakao_id || '알 수 없음';
        const email = user.email || '-';
        const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-';
        const blockedAt = item.blocked_at ? new Date(item.blocked_at).toLocaleDateString('ko-KR') : '-';
        const reason = item.reason || '-';

        html += `
          <tr>
            <td>
              <strong>${escapeHtml(displayName)}</strong>
              ${email !== '-' ? `<br><small>${escapeHtml(email)}</small>` : ''}
            </td>
            <td>${createdAt}</td>
            <td>${blockedAt}</td>
            <td>${escapeHtml(reason)}</td>
            <td>
              <button class="action-btn success" onclick='unblockUser("${user.id}")'>✅ 해제</button>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
    }

    // 2. 탈퇴한 사용자 (개인정보 최소화)
    if (deletedUsers.length > 0) {
      html += `
        <h3 style="margin-top: 30px; margin-bottom: 10px;">👤 탈퇴한 회원 (${deletedUsers.length}명) - 법정 분리 보관</h3>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>마스킹된 이메일</th>
              <th>탈퇴일</th>
              <th>탈퇴 유형</th>
              <th>유료 구독 이력</th>
              <th>보관 만료일</th>
              <th>관리</th>
            </tr>
          </thead>
          <tbody>
      `;

      deletedUsers.forEach(item => {
        const deletedAt = new Date(item.deleted_at).toLocaleDateString('ko-KR');
        const retentionUntil = new Date(item.retention_until).toLocaleDateString('ko-KR');
        const deletionType = item.deletion_type === 'self' ? '본인 탈퇴' : '관리자 탈퇴';
        const hadPaid = item.had_paid_subscription ? '✅ 있음' : '❌ 없음';

        html += `
          <tr>
            <td><code style="font-size: 10px;">${item.original_user_id.substring(0, 8)}...</code></td>
            <td>${escapeHtml(item.masked_email || '-')}</td>
            <td>${deletedAt}</td>
            <td>${deletionType}</td>
            <td>${hadPaid}</td>
            <td>${retentionUntil}</td>
            <td>
              <button class="action-btn primary" onclick='viewDeletedUserSubscription("${item.original_user_id}", "${escapeHtml(item.masked_email || '탈퇴 회원')}".replace(/&quot;/g, "\\""))' style="margin-right: 4px;">📊 구독이력</button>
              <button class="action-btn danger" onclick='permanentDeleteUser("${item.original_user_id}", "탈퇴 회원")'>🗑️ 영구삭제</button>
            </td>
          </tr>
        `;
      });

      html += `</tbody></table>`;
      html += `
        <div style="margin-top: 10px; padding: 12px; background: #fff3cd; border-radius: 6px; font-size: 13px;">
          ⚠️ <strong>법정 보관 안내:</strong> 전자상거래법에 따라 탈퇴 회원의 거래 정보는 5년간 분리 보관됩니다.
          보관 만료일 이후 자동으로 영구 삭제됩니다.
        </div>
      `;
    }

    container.innerHTML = html;

  } catch (error) {
    showError('차단/탈퇴 회원 목록 로드 실패: ' + error.message);
  } finally {
    showLoading(false);
  }
}

async function viewDeletedUserSubscription(userId, maskedEmail) {
  const displayName = maskedEmail || '탈퇴한 회원';
  await viewSubscriptionHistory(userId, displayName);
}

async function restoreUser(userId, displayName) {
  if (!confirm(`"${displayName}" 사용자를 복구하시겠습니까?`)) {
    return;
  }

  try {
    await callAdminAPI('unblock_user', { userId });
    showSuccess('사용자가 복구되었습니다.');
    await loadDeletedUsers();
  } catch (error) {
    showError('사용자 복구 실패: ' + error.message);
  }
}

async function permanentDeleteUser(userId, displayName) {
  if (!confirm(`⚠️ 정말로 "${displayName}" 사용자를 영구 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 데이터가 삭제됩니다.\n\n⚠️ 상거래법상 5년간 거래 기록을 보관해야 합니다.\n일반적으로는 복구 기능을 사용하는 것이 좋습니다.`)) {
    return;
  }

  const confirmText = prompt('영구 삭제를 진행하려면 "영구삭제"를 입력하세요:');
  if (confirmText !== '영구삭제') {
    showError('삭제가 취소되었습니다.');
    return;
  }

  try {
    await callAdminAPI('delete_user', { userId, hardDelete: true });
    showSuccess('사용자가 영구 삭제되었습니다.');
    await loadDeletedUsers();
  } catch (error) {
    showError('영구 삭제 실패: ' + error.message);
  }
}

async function loadAppSettings() {
  try {
    const result = await callAdminAPI('get_app_config');
    const config = result.config;

    if (config) {
      document.getElementById('settingMinVersion').value = config.min_version || '1.0.0';
      document.getElementById('settingForceUpdate').checked = config.force_update || false;
      document.getElementById('settingMaintenanceMode').checked = config.maintenance_mode || false;
      document.getElementById('settingMaintenanceMessage').value = config.maintenance_message || '';
    }
  } catch (error) {
    showError('앱 설정 로드 실패: ' + error.message);
  }
}

// ============================================
// Render Functions
// ============================================
function updateStats(stats) {
  document.getElementById('statTotalUsers').textContent = stats.totalUsers || 0;
  document.getElementById('statActiveSubscriptions').textContent = stats.activeSubscriptions || 0;
  document.getElementById('statExpiringSoon').textContent = stats.expiringSoon || 0;
  document.getElementById('statBlocked').textContent = stats.blockedUsers || 0;
}

function renderUsersTable() {
  const container = document.getElementById('usersTableContainer');

  // 필터링 적용
  let filteredUsers = currentUsers;
  if (currentSubscriptionFilter !== 'all') {
    filteredUsers = currentUsers.filter(user => {
      const hasActiveSubscription = user.subscription_id && user.status === 'active' && user.end_date && new Date(user.end_date) > new Date();
      const hasExpiredSubscription = user.subscription_id && (!hasActiveSubscription);
      const hasNoSubscription = !user.subscription_id || user.plan === 'free';

      if (currentSubscriptionFilter === 'active') return hasActiveSubscription;
      if (currentSubscriptionFilter === 'expired') return hasExpiredSubscription;
      if (currentSubscriptionFilter === 'none') return hasNoSubscription;
      return true;
    });
  }

  if (filteredUsers.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">🔍</div>
        <div class="message">사용자를 찾을 수 없습니다</div>
        <div class="submessage">검색어를 변경하거나 필터를 조정해보세요</div>
      </div>
    `;
    document.getElementById('pagination').style.display = 'none';
    return;
  }

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const start = (currentPage - 1) * USERS_PER_PAGE;
  const end = start + USERS_PER_PAGE;
  const pageUsers = filteredUsers.slice(start, end);

  // Render table
  let html = `
    <table>
      <thead>
        <tr>
          <th>사용자</th>
          <th>그룹</th>
          <th>인증 방식</th>
          <th>구독 플랜</th>
          <th>구독 상태</th>
          <th>가입일</th>
          <th>관리</th>
        </tr>
      </thead>
      <tbody>
  `;

  pageUsers.forEach(user => {
    const displayName = user.nickname || user.username || user.kakao_id;
    // 카카오 ID가 있으면 카카오 로그인, username이 있으면 ID/PW 로그인
    const authType = user.kakao_id ? 'kakao' : 'password';
    const sub = user.subscription || {};
    const plan = user.plan || 'free';
    const status = user.is_blocked ? 'blocked' : (user.status === 'active' ? 'active' : 'expired');
    const createdAt = new Date(user.user_created_at).toLocaleDateString('ko-KR');
    const groupName = user.group_name || '미지정';
    const groupColor = user.group_color || '#999';

    // 구독 정보
    const subCount = user.subscription_count || 0;
    const hasActiveSubscription = user.subscription_id && user.status === 'active' && user.end_date && new Date(user.end_date) > new Date();

    // 현재 구독 기간 정보
    const startDate = user.start_date ? new Date(user.start_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : null;
    const endDate = user.end_date ? new Date(user.end_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : null;
    const daysLeft = hasActiveSubscription && user.end_date ? Math.ceil((new Date(user.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;

    // 예약 구독 정보
    const scheduledSub = user.scheduled_subscription;
    const hasScheduled = scheduledSub && scheduledSub.status === 'active';
    const scheduledStartDate = hasScheduled ? new Date(scheduledSub.start_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : null;
    const scheduledEndDate = hasScheduled ? new Date(scheduledSub.end_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : null;

    // 총 남은 기간 계산 (현재 구독 + 예약 구독)
    let totalDaysLeft = daysLeft;
    if (hasScheduled && scheduledSub.end_date) {
      totalDaysLeft = Math.ceil((new Date(scheduledSub.end_date) - new Date()) / (1000 * 60 * 60 * 24));
    }

    html += `
      <tr>
        <td>
          <strong>${escapeHtml(displayName)}</strong>
          ${user.email ? `<br><small>${escapeHtml(user.email)}</small>` : ''}
          ${user.admin_memo ? `<br><small style="color: #999;">📝 ${escapeHtml(user.admin_memo)}</small>` : ''}
          ${subCount > 0 ? `<br><small style="color: #667eea;">📋 구독 ${subCount}회</small>` : ''}
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="width:12px;height:12px;background:${groupColor};border-radius:3px;"></div>
            <span>${escapeHtml(groupName)}</span>
            <button class="action-btn" style="font-size:10px;padding:2px 6px;" onclick='openChangeGroupModal("${user.user_id}")'>변경</button>
          </div>
        </td>
        <td><span class="badge ${authType}">${authType === 'kakao' ? '카카오' : 'ID/PW'}</span></td>
        <td>
          <span class="badge ${plan}">${plan.toUpperCase()}</span>
          ${hasActiveSubscription && startDate && endDate ? `<br><small style="color: #666; white-space: nowrap;">현재: ${startDate} ~ ${endDate} (D-${daysLeft})</small>` : ''}
          ${hasScheduled && scheduledStartDate && scheduledEndDate ? `<br><small style="color: #666; white-space: nowrap;">예약: ${scheduledStartDate} ~ ${scheduledEndDate}</small>` : ''}
          ${totalDaysLeft !== null && totalDaysLeft > 0 ? `<br><small style="color: ${totalDaysLeft <= 7 ? '#f44336' : '#4caf50'};">총: D-${totalDaysLeft}일</small>` : ''}
        </td>
        <td><span class="badge ${status}">${getStatusText(status)}</span></td>
        <td>${createdAt}</td>
        <td style="white-space: nowrap;">
          <button class="action-btn secondary" onclick='viewUser(${JSON.stringify(user)})'>👁️ 상세</button>
          <button class="action-btn primary" onclick='openSubscriptionManageModal(${JSON.stringify(user)})'>💳 구독</button>
          <button class="action-btn success" data-user-id="${user.user_id}" data-memo="${escapeHtml(user.admin_memo || '')}" onclick='openMemoModalFromButton(this)'>📝 메모</button>
          <button class="action-btn" style="background:#9c27b0;color:white;" onclick='viewLoginHistory("${user.user_id}", "${escapeHtml(user.nickname || user.username || user.kakao_id)}")'>🔐 로그인</button>
          ${user.latest_version ? `<span class="badge" style="background:#424242;color:#9e9e9e;font-size:10px;margin-left:4px;" title="마지막 사용 버전">v${escapeHtml(user.latest_version)}</span>` : ''}
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;

  container.innerHTML = html;

  // Update pagination
  document.getElementById('pagination').style.display = totalPages > 1 ? 'flex' : 'none';
  document.getElementById('currentPage').textContent = currentPage;
  document.getElementById('totalPages').textContent = totalPages;
  document.querySelector('.pagination button:first-child').disabled = currentPage === 1;
  document.querySelector('.pagination button:last-child').disabled = currentPage === totalPages;
}

function getStatusText(status) {
  switch (status) {
    case 'active': return '활성';
    case 'expired': return '만료';
    case 'blocked': return '차단됨';
    default: return '알 수 없음';
  }
}

// ============================================
// User Detail Modal with Actions
// ============================================
let currentDetailUser = null;

function viewUser(user) {
  currentDetailUser = user;
  const container = document.getElementById('userDetailContent');
  const sub = user.subscription || {};

  let html = `
    <div class="user-detail-row">
      <div class="label">사용자 ID</div>
      <div class="value">${escapeHtml(user.id)}</div>
    </div>
    <div class="user-detail-row">
      <div class="label">인증 방식</div>
      <div class="value"><span class="badge ${user.auth_type}">${user.auth_type === 'kakao' ? '카카오' : 'ID/PW'}</span></div>
    </div>
  `;

  if (user.username) {
    html += `
      <div class="user-detail-row">
        <div class="label">아이디</div>
        <div class="value">${escapeHtml(user.username)}</div>
      </div>
    `;
  }

  if (user.kakao_id) {
    html += `
      <div class="user-detail-row">
        <div class="label">카카오 ID</div>
        <div class="value">${escapeHtml(user.kakao_id)}</div>
      </div>
    `;
  }

  html += `
    <div class="user-detail-row">
      <div class="label">닉네임</div>
      <div class="value">${escapeHtml(user.nickname || '-')}</div>
    </div>
    <div class="user-detail-row">
      <div class="label">이메일</div>
      <div class="value">${escapeHtml(user.email || '-')}</div>
    </div>
    <div class="user-detail-row">
      <div class="label">구독 플랜</div>
      <div class="value"><span class="badge ${sub.plan || 'free'}">${(sub.plan || 'free').toUpperCase()}</span></div>
    </div>
    <div class="user-detail-row">
      <div class="label">구독 상태</div>
      <div class="value"><span class="badge ${sub.isActive ? 'active' : 'expired'}">${sub.isActive ? '활성' : '만료'}</span></div>
    </div>
  `;

  if (sub.startDate) {
    html += `
      <div class="user-detail-row">
        <div class="label">구독 시작일</div>
        <div class="value">${new Date(sub.startDate).toLocaleString('ko-KR')}</div>
      </div>
      <div class="user-detail-row">
        <div class="label">구독 종료일</div>
        <div class="value">${new Date(sub.endDate).toLocaleString('ko-KR')}</div>
      </div>
      <div class="user-detail-row">
        <div class="label">남은 기간</div>
        <div class="value">${sub.daysLeft}일</div>
      </div>
    `;
  }

  html += `
    <div class="user-detail-row">
      <div class="label">차단 여부</div>
      <div class="value"><span class="badge ${user.is_blocked ? 'blocked' : 'active'}">${user.is_blocked ? '차단됨' : '정상'}</span></div>
    </div>
  `;

  if (user.block_reason) {
    html += `
      <div class="user-detail-row">
        <div class="label">차단 사유</div>
        <div class="value">${escapeHtml(user.block_reason)}</div>
      </div>
    `;
  }

  html += `
    <div class="user-detail-row">
      <div class="label">가입일</div>
      <div class="value">${user.user_created_at ? new Date(user.user_created_at).toLocaleString('ko-KR') : (user.created_at ? new Date(user.created_at).toLocaleString('ko-KR') : '-')}</div>
    </div>
    <div class="user-detail-row">
      <div class="label">관리자 메모</div>
      <div class="value">${escapeHtml(user.admin_memo || '-')}</div>
    </div>
  `;

  container.innerHTML = html;

  // 차단 상태에 따라 버튼 표시/숨김
  if (user.is_blocked) {
    document.getElementById('btnBlockUser').style.display = 'none';
    document.getElementById('btnUnblockUser').style.display = 'inline-block';
  } else {
    document.getElementById('btnBlockUser').style.display = 'inline-block';
    document.getElementById('btnUnblockUser').style.display = 'none';
  }

  openModal('userModal');
}

function openEditUserFromDetail() {
  if (!currentDetailUser) return;
  openEditUserModal(currentDetailUser);
}

function openBlockModalFromDetail() {
  if (!currentDetailUser) return;
  closeModal();
  openBlockModal(currentDetailUser.user_id);
}

async function unblockUserFromDetail() {
  if (!currentDetailUser) return;
  await unblockUser(currentDetailUser.user_id);
  closeModal();
  await loadUsers();
}

function confirmDeleteUserFromDetail() {
  if (!currentDetailUser) return;
  const displayName = currentDetailUser.nickname || currentDetailUser.username || currentDetailUser.kakao_id;
  closeModal();
  confirmDeleteUser(currentDetailUser.user_id, displayName);
}

// ============================================
// User Actions
// ============================================
function searchUsers() {
  const search = document.getElementById('searchInput').value.trim();
  loadUsers(search);
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    renderUsersTable();
  }
}

function nextPage() {
  const totalPages = Math.ceil(currentUsers.length / USERS_PER_PAGE);
  if (currentPage < totalPages) {
    currentPage++;
    renderUsersTable();
  }
}

// ============================================
// Subscription Management
// ============================================
function openAddSubModal(userId) {
  document.getElementById('addSubUserId').value = userId;
  document.getElementById('addSubPlan').value = 'pro';
  document.getElementById('addSubDays').value = 30;
  openModal('addSubModal');
}

async function handleAddSubscription(e) {
  e.preventDefault();

  const userId = document.getElementById('addSubUserId').value;
  const plan = document.getElementById('addSubPlan').value;
  const days = parseInt(document.getElementById('addSubDays').value);

  if (!userId || !plan || !days) {
    showError('모든 필드를 입력해주세요.');
    return;
  }

  try {
    // Send days directly to the API (admin-manage now supports days parameter)
    await callAdminAPI('add_subscription', {
      userId: userId,
      plan: plan,
      days: days
    });

    showSuccess('구독이 추가되었습니다.');
    closeModal();
    await refreshData();
  } catch (error) {
    showError('구독 추가 실패: ' + error.message);
  }
}

// ============================================
// Memo Management
// ============================================
function openMemoModal(userId, currentMemo) {
  document.getElementById('memoUserId').value = userId;
  document.getElementById('memoText').value = currentMemo || '';
  openModal('memoModal');
}

// data 속성에서 메모 모달을 여는 헬퍼 함수
function openMemoModalFromButton(button) {
  const userId = button.dataset.userId;
  const memo = button.dataset.memo || '';
  openMemoModal(userId, memo);
}

async function handleUpdateMemo(e) {
  e.preventDefault();

  const userId = document.getElementById('memoUserId').value;
  const memo = document.getElementById('memoText').value.trim();

  try {
    await callAdminAPI('update_memo', {
      userId: userId,
      memo: memo
    });

    showSuccess('메모가 저장되었습니다.');
    closeModal();
    await refreshData();
  } catch (error) {
    showError('메모 저장 실패: ' + error.message);
  }
}

// ============================================
// Block Management
// ============================================
function openBlockModal(userId) {
  document.getElementById('blockUserId').value = userId;
  document.getElementById('blockReason').value = '';
  openModal('blockModal');
}

async function handleBlockUser(e) {
  e.preventDefault();

  const userId = document.getElementById('blockUserId').value;
  const reason = document.getElementById('blockReason').value.trim();

  if (!reason) {
    showError('차단 사유를 입력해주세요.');
    return;
  }

  console.log('🔍 차단 요청 데이터:', { user_id: userId, reason: reason });

  try {
    const result = await callAdminAPI('block_user', {
      user_id: userId,
      reason: reason
    });

    console.log('✅ 차단 성공:', result);
    showSuccess('사용자가 차단되었습니다.');
    closeModal();
    await refreshData();
  } catch (error) {
    console.error('❌ 차단 실패 상세:', error);
    showError('차단 실패: ' + error.message);
  }
}

async function unblockUser(userId) {
  if (!confirm('이 사용자의 차단을 해제하시겠습니까?')) {
    return;
  }

  try {
    await callAdminAPI('unblock_user', {
      userId: userId
    });

    showSuccess('차단이 해제되었습니다.');
    await refreshData();
  } catch (error) {
    showError('차단 해제 실패: ' + error.message);
  }
}

// ============================================
// App Settings
// ============================================
async function updateAppSettings() {
  const minVersion = document.getElementById('settingMinVersion').value.trim();
  const forceUpdate = document.getElementById('settingForceUpdate').checked;
  const maintenanceMode = document.getElementById('settingMaintenanceMode').checked;
  const maintenanceMessage = document.getElementById('settingMaintenanceMessage').value.trim();

  if (!minVersion) {
    showError('최소 지원 버전을 입력해주세요.');
    return;
  }

  try {
    await callAdminAPI('update_app_config', {
      minVersion: minVersion,
      forceUpdate: forceUpdate,
      maintenanceMode: maintenanceMode,
      maintenanceMessage: maintenanceMessage || null
    });

    showSuccess('앱 설정이 저장되었습니다.');
  } catch (error) {
    showError('설정 저장 실패: ' + error.message);
  }
}

// ============================================
// Modal Management
// ============================================
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.classList.remove('show');
  });
}

// Close modal on background click
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
});

// ============================================
// UI Helpers
// ============================================
function showLoading(show) {
  document.getElementById('loading').classList.toggle('show', show);
}

function showError(message) {
  const errorBox = document.getElementById('errorBox');
  errorBox.textContent = message;
  errorBox.classList.add('show');
}

function showSuccess(message) {
  const successBox = document.getElementById('successBox');
  successBox.textContent = message;
  successBox.classList.add('show');
}

function hideMessages() {
  document.getElementById('errorBox').classList.remove('show');
  document.getElementById('successBox').classList.remove('show');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Group Management
// ============================================
let currentGroups = [];

async function loadGroups() {
  try {
    const result = await callAdminAPI('list_groups');
    currentGroups = result.groups;
    renderGroups();
  } catch (error) {
    showError('그룹 목록 로드 실패: ' + error.message);
  }
}

function renderGroups() {
  const content = document.getElementById('groupsContent');

  if (!currentGroups || currentGroups.length === 0) {
    content.innerHTML = '<p style="text-align:center;padding:40px;color:#999;">등록된 그룹이 없습니다.</p>';
    return;
  }

  const html = `
    <table class="data-table">
      <thead>
        <tr>
          <th style="width:40px;"></th>
          <th>그룹명</th>
          <th>설명</th>
          <th style="width:80px;">시스템</th>
          <th style="width:120px;">생성일</th>
          <th style="width:150px;">작업</th>
        </tr>
      </thead>
      <tbody>
        ${currentGroups.map(group => `
          <tr>
            <td><div style="width:20px;height:20px;background:${escapeHtml(group.color)};border-radius:4px;"></div></td>
            <td><strong>${escapeHtml(group.name)}</strong></td>
            <td>${escapeHtml(group.description || '-')}</td>
            <td>${group.is_system ? '🔒 Yes' : 'No'}</td>
            <td>${new Date(group.created_at).toLocaleDateString('ko-KR')}</td>
            <td>
              ${!group.is_system ? `
                <button class="action-btn" onclick="showEditGroupModal('${group.id}')">✏️ 수정</button>
                <button class="action-btn danger" onclick="confirmDeleteGroup('${group.id}', '${escapeHtml(group.name)}')">🗑️ 삭제</button>
              ` : '<span style="color:#999;">-</span>'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  content.innerHTML = html;
}

function showAddGroupModal() {
  const name = prompt('그룹 이름을 입력하세요:');
  if (!name || !name.trim()) return;

  const description = prompt('그룹 설명을 입력하세요 (선택):');
  const color = prompt('그룹 색상을 입력하세요 (예: #4CAF50):', '#667eea');

  addGroup(name.trim(), description?.trim() || '', color || '#667eea');
}

async function addGroup(name, description, color) {
  try {
    const result = await callAdminAPI('add_group', { name, description, color });
    showSuccess(result.message || '그룹이 추가되었습니다.');
    loadGroups();
  } catch (error) {
    showError('그룹 추가 실패: ' + error.message);
  }
}

function showEditGroupModal(groupId) {
  const group = currentGroups.find(g => g.id === groupId);
  if (!group) return;

  const name = prompt('그룹 이름:', group.name);
  if (name === null) return;

  const description = prompt('그룹 설명:', group.description || '');
  const color = prompt('그룹 색상 (예: #4CAF50):', group.color);

  updateGroup(groupId, name.trim(), description?.trim() || '', color || group.color);
}

async function updateGroup(groupId, name, description, color) {
  try {
    const result = await callAdminAPI('update_group', { groupId, name, description, color });
    showSuccess(result.message || '그룹이 수정되었습니다.');
    loadGroups();
  } catch (error) {
    showError('그룹 수정 실패: ' + error.message);
  }
}

function confirmDeleteGroup(groupId, groupName) {
  if (!confirm(`"${groupName}" 그룹을 삭제하시겠습니까?\n이 그룹의 사용자들은 기본그룹으로 이동됩니다.`)) {
    return;
  }
  deleteGroup(groupId);
}

async function deleteGroup(groupId) {
  try {
    const result = await callAdminAPI('delete_group', { groupId });
    showSuccess(result.message || '그룹이 삭제되었습니다.');
    loadGroups();
  } catch (error) {
    showError('그룹 삭제 실패: ' + error.message);
  }
}

async function openChangeGroupModal(userId) {
  try {
    // 그룹 목록 로드
    const result = await callAdminAPI('list_groups');
    const groups = result.groups;

    if (!groups || groups.length === 0) {
      alert('사용 가능한 그룹이 없습니다.');
      return;
    }

    // 그룹 선택 프롬프트
    let message = '그룹을 선택하세요:\n\n';
    groups.forEach((g, i) => {
      message += `${i + 1}. ${g.name} - ${g.description || '설명 없음'}\n`;
    });

    const choice = prompt(message + '\n번호를 입력하세요:');
    if (!choice) return;

    const index = parseInt(choice) - 1;
    if (index < 0 || index >= groups.length) {
      alert('잘못된 선택입니다.');
      return;
    }

    const selectedGroup = groups[index];
    await changeUserGroup(userId, selectedGroup.id);
  } catch (error) {
    showError('그룹 목록 로드 실패: ' + error.message);
  }
}

async function changeUserGroup(userId, groupId) {
  try {
    console.log('🔍 프론트엔드: 그룹 변경 요청', { userId, groupId, userIdType: typeof userId, groupIdType: typeof groupId });
    const result = await callAdminAPI('change_user_group', { userId, groupId });
    console.log('✅ 프론트엔드: 그룹 변경 성공', result);
    showSuccess(result.message || '사용자 그룹이 변경되었습니다.');
    loadUsers(); // 사용자 목록 새로고침
  } catch (error) {
    console.error('❌ 프론트엔드: 그룹 변경 실패', error);
    showError('그룹 변경 실패: ' + error.message);
  }
}

// ============================================
// User Edit/Delete Functions
// ============================================
function openEditUserModal(user) {
  document.getElementById('editUserId').value = user.user_id;
  document.getElementById('editUsername').value = user.username || '';
  document.getElementById('editNickname').value = user.nickname || '';
  document.getElementById('editEmail').value = user.email || '';
  document.getElementById('editPassword').value = '';

  // 카카오 사용자면 username, password 비활성화
  const isKakao = !!user.kakao_id;
  const usernameField = document.getElementById('editUsername');
  const passwordField = document.getElementById('editPassword');

  usernameField.disabled = isKakao;
  passwordField.disabled = isKakao;

  if (isKakao) {
    usernameField.placeholder = '(카카오 로그인 사용자)';
    passwordField.placeholder = '(카카오 로그인 사용자는 비밀번호 변경 불가)';
  } else {
    usernameField.placeholder = '';
    passwordField.placeholder = '변경하지 않으려면 비워두세요';
  }

  openModal('editUserModal');
}

async function handleEditUser(e) {
  e.preventDefault();

  const userId = document.getElementById('editUserId').value;
  const username = document.getElementById('editUsername').value.trim();
  const nickname = document.getElementById('editNickname').value.trim();
  const email = document.getElementById('editEmail').value.trim();
  const newPassword = document.getElementById('editPassword').value;

  try {
    // 카카오 사용자 체크
    const usernameField = document.getElementById('editUsername');
    const isKakaoUser = usernameField.disabled;

    // 사용자 정보 업데이트
    if (username || nickname || email) {
      await callAdminAPI('update_user', {
        userId,
        username: username || undefined,
        nickname: nickname || undefined,
        email: email || undefined
      });
    }

    // 비밀번호 재설정 (입력된 경우만, 카카오 사용자 제외)
    if (newPassword) {
      if (isKakaoUser) {
        showError('카카오 로그인 사용자는 비밀번호를 변경할 수 없습니다.');
        return;
      }

      await callAdminAPI('reset_password', {
        userId,
        newPassword
      });
    }

    showSuccess('사용자 정보가 수정되었습니다.');
    closeModal();
    await loadUsers();
  } catch (error) {
    showError('사용자 정보 수정 실패: ' + error.message);
  }
}

function confirmDeleteUser(userId, displayName) {
  if (confirm(`정말로 "${displayName}" 사용자를 탈퇴 처리하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.\n- 활성 구독이 취소됩니다\n- 사용자가 차단 처리됩니다`)) {
    deleteUser(userId, false);
  }
}

async function deleteUser(userId, hardDelete = false) {
  try {
    await callAdminAPI('delete_user', { userId, hardDelete });
    showSuccess(hardDelete ? '사용자가 완전히 삭제되었습니다.' : '사용자가 탈퇴 처리되었습니다.');
    await loadUsers();
  } catch (error) {
    showError('사용자 탈퇴 처리 실패: ' + error.message);
  }
}

// ============================================
// Deploy Time Display
// ============================================
function updateDeployTime() {
  // 빌드 버전은 index.html에 하드코딩됨 (배포 시 수동 업데이트 필요)
  // 형식: vYYYYMMDD.N (예: v20251202.1)

  // 현재 시각 업데이트 (1초마다)
  function updateCurrentTime() {
    const currentTimeEl = document.getElementById('currentTime');
    if (currentTimeEl) {
      const now = new Date();
      const timeStr = now.toLocaleString('ko-KR', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      currentTimeEl.textContent = timeStr;
    }
  }

  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);
}

// ============================================
// Login History Functions
// ============================================

let currentLoginHistoryPage = 1;
let currentLoginHistoryUserId = null;

// ============================================
// PNU Matcher Functions
// ============================================

async function callPnuMatcherAPI(action, data = {}) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/land-pnu-matcher`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: action,
        ...data
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('PNU Matcher API 오류:', result);
      throw new Error(result.error || `API 호출 실패 (${response.status})`);
    }

    return result;
  } catch (error) {
    console.error('PNU Matcher API 오류:', error);
    throw error;
  }
}

async function loadPnuStats() {
  try {
    const result = await callPnuMatcherAPI('get_status');

    if (result.stats) {
      const stats = result.stats;

      // 통계 업데이트
      document.getElementById('pnuStatTotal').textContent = formatNumber(stats.total_land_transactions || 0);
      document.getElementById('pnuStatMatched').textContent = formatNumber(stats.matched_count || 0);
      document.getElementById('pnuStatUnmatched').textContent = formatNumber(stats.unmatched_count || 0);
      document.getElementById('pnuStatAmbiguous').textContent = formatNumber(stats.ambiguous_count || 0);
      document.getElementById('pnuStatFailed').textContent = formatNumber(stats.failed_count || 0);

      // 지분거래 및 일괄매각 통계 (bulk_sale_group 필드 기반)
      const shareSaleEl = document.getElementById('pnuStatShareSale');
      const bulkSaleEl = document.getElementById('pnuStatBulkSale');
      if (shareSaleEl) shareSaleEl.textContent = formatNumber(stats.share_sale_count || 0);
      if (bulkSaleEl) bulkSaleEl.textContent = formatNumber(stats.bulk_sale_count || 0);

      // 매칭률 업데이트
      const matchRate = stats.match_rate || 0;
      document.getElementById('pnuMatchRate').textContent = `${matchRate}%`;
      document.getElementById('pnuMatchRateBar').style.width = `${matchRate}%`;

      // 전역 변수에 미처리 건수 저장 (자동 매칭용)
      window.pnuUnmatchedCount = stats.unmatched_count || 0;
    }

    // 중복 후보 목록
    if (result.ambiguous && result.ambiguous.length > 0) {
      renderAmbiguousList(result.ambiguous);
    } else {
      document.getElementById('pnuAmbiguousList').innerHTML =
        '<p style="color: var(--text-secondary); font-size: 12px;">미해결 중복 후보 없음</p>';
    }

    // 실패 목록
    if (result.failed && result.failed.length > 0) {
      renderFailedList(result.failed);
    } else {
      document.getElementById('pnuFailedList').innerHTML =
        '<p style="color: var(--text-secondary); font-size: 12px;">매칭 실패 건 없음</p>';
    }

  } catch (error) {
    showError('PNU 매칭 통계 로드 실패: ' + error.message);
  }
}

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderAmbiguousList(items) {
  const container = document.getElementById('pnuAmbiguousList');

  let html = '<table style="width: 100%; font-size: 11px;">';
  html += '<thead><tr><th>거래ID</th><th>지번</th><th>후보수</th><th>등록일</th></tr></thead><tbody>';

  items.slice(0, 20).forEach(item => {
    const createdAt = new Date(item.created_at).toLocaleDateString('ko-KR');
    html += `
      <tr>
        <td>${item.transaction_id}</td>
        <td>${escapeHtml(item.jibun || '-')}</td>
        <td><span class="badge warning">${item.candidate_count}건</span></td>
        <td>${createdAt}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';

  if (items.length > 20) {
    html += `<p style="margin-top: 8px; font-size: 11px; color: var(--text-secondary);">외 ${items.length - 20}건 더...</p>`;
  }

  container.innerHTML = html;
}

function renderFailedList(items) {
  const container = document.getElementById('pnuFailedList');

  let html = '<table style="width: 100%; font-size: 11px;">';
  html += '<thead><tr><th>거래ID</th><th>실패 사유</th><th>재시도</th></tr></thead><tbody>';

  items.slice(0, 20).forEach(item => {
    const reasonText = {
      'no_ldcode': '법정동코드 없음',
      'api_error': 'API 오류',
      'no_match': '매칭 불가'
    }[item.fail_reason] || item.fail_reason;

    html += `
      <tr>
        <td>${item.transaction_id}</td>
        <td><span class="badge danger">${reasonText}</span></td>
        <td>${item.retry_count || 0}회</td>
      </tr>
    `;
  });

  html += '</tbody></table>';

  if (items.length > 20) {
    html += `<p style="margin-top: 8px; font-size: 11px; color: var(--text-secondary);">외 ${items.length - 20}건 더...</p>`;
  }

  container.innerHTML = html;
}

async function runPnuBatchMatch() {
  const lawdCd = document.getElementById('pnuLawdCd').value.trim();
  const dealYear = document.getElementById('pnuDealYear').value.trim();
  const limit = parseInt(document.getElementById('pnuLimit').value) || 100;
  const dryRun = document.getElementById('pnuDryRun').checked;

  // 버튼 비활성화
  const btn = document.getElementById('btnRunPnuMatch');
  const btnText = document.getElementById('btnRunPnuMatchText');
  btn.disabled = true;
  btnText.textContent = '⏳ 실행 중...';

  // 결과 박스 초기화
  const resultBox = document.getElementById('pnuResultBox');
  const resultContent = document.getElementById('pnuResultContent');
  resultBox.style.display = 'block';
  resultBox.style.borderColor = 'var(--accent-cyan)';
  resultContent.innerHTML = '<p style="color: var(--text-secondary);">매칭 진행 중... (시간이 걸릴 수 있습니다)</p>';

  try {
    const params = {
      limit: limit,
      dry_run: dryRun
    };

    if (lawdCd) params.lawd_cd = lawdCd;
    if (dealYear) params.deal_year = parseInt(dealYear);

    const result = await callPnuMatcherAPI('batch_match', params);

    // 결과 표시
    if (result.success) {
      resultBox.style.borderColor = 'var(--success)';

      let html = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px;">
          <div style="padding: 12px; background: var(--bg-primary); text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--accent-cyan);">${result.processed || 0}</div>
            <div style="font-size: 10px; color: var(--text-secondary);">처리됨</div>
          </div>
          <div style="padding: 12px; background: var(--bg-primary); text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--success);">${result.matched || 0}</div>
            <div style="font-size: 10px; color: var(--text-secondary);">매칭 성공</div>
          </div>
          <div style="padding: 12px; background: var(--bg-primary); text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--warning);">${result.ambiguous || 0}</div>
            <div style="font-size: 10px; color: var(--text-secondary);">중복 후보</div>
          </div>
          <div style="padding: 12px; background: var(--bg-primary); text-align: center;">
            <div style="font-size: 24px; font-weight: 700; color: var(--danger);">${result.failed || 0}</div>
            <div style="font-size: 10px; color: var(--text-secondary);">실패</div>
          </div>
        </div>
      `;

      if (dryRun) {
        html += '<p style="color: var(--warning); font-size: 12px;">⚠️ Dry Run 모드: 실제 데이터는 변경되지 않았습니다.</p>';
      }

      if (result.details && result.details.length > 0) {
        html += '<details style="margin-top: 12px;"><summary style="cursor: pointer; color: var(--accent-cyan);">상세 결과 보기</summary>';
        html += '<div style="max-height: 200px; overflow-y: auto; margin-top: 8px; font-size: 11px;">';
        result.details.forEach(d => {
          const statusIcon = d.status === 'matched' ? '✅' : d.status === 'ambiguous' ? '⚠️' : '❌';
          html += `<div style="padding: 4px 0; border-bottom: 1px solid var(--border-color);">${statusIcon} ID:${d.id} ${d.jibun || ''} - ${d.status}</div>`;
        });
        html += '</div></details>';
      }

      resultContent.innerHTML = html;

      // 통계 새로고침
      await loadPnuStats();

    } else {
      resultBox.style.borderColor = 'var(--danger)';
      resultContent.innerHTML = `<p style="color: var(--danger);">❌ 오류: ${escapeHtml(result.error || '알 수 없는 오류')}</p>`;
    }

  } catch (error) {
    resultBox.style.borderColor = 'var(--danger)';
    resultContent.innerHTML = `<p style="color: var(--danger);">❌ 오류: ${escapeHtml(error.message)}</p>`;
  } finally {
    btn.disabled = false;
    btnText.textContent = '▶ 배치 실행';
  }
}

// 자동 반복 매칭 상태
let pnuAutoMatchRunning = false;

// 실행 결과 카드 업데이트 헬퍼
function updatePnuResultCard(matched, ambiguous, failed, status, borderColor = 'var(--accent-cyan)') {
  const card = document.getElementById('pnuResultCard');
  const statusEl = document.getElementById('pnuResultStatus');

  card.style.display = 'block';
  card.style.borderColor = borderColor;

  document.getElementById('pnuResultMatched').textContent = matched;
  document.getElementById('pnuResultAmbiguous').textContent = ambiguous;
  document.getElementById('pnuResultFailed').textContent = failed;
  statusEl.textContent = status;
}

// 전체 자동 반복 매칭 (남은 건이 없을 때까지)
async function runPnuQuickMatch() {
  const btn = document.getElementById('btnRunPnuQuick');
  const btnText = document.getElementById('btnRunPnuQuickText');

  // 이미 실행 중이면 중지
  if (pnuAutoMatchRunning) {
    pnuAutoMatchRunning = false;
    btnText.textContent = '⏹️ 중지 중...';
    return;
  }

  if (!confirm('남은 데이터가 없을 때까지 100건씩 자동으로 매칭합니다.\n(버튼을 다시 클릭하면 중지됩니다)\n\n시작하시겠습니까?')) {
    return;
  }

  pnuAutoMatchRunning = true;
  btnText.textContent = '⏹️ 중지';
  btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';

  // 누적 통계
  let totalMatched = 0;
  let totalAmbiguous = 0;
  let totalFailed = 0;
  let batchCount = 0;

  try {
    while (pnuAutoMatchRunning) {
      batchCount++;
      updatePnuResultCard(totalMatched, totalAmbiguous, totalFailed, `⚡ 배치 #${batchCount} 진행 중...`);

      const result = await callPnuMatcherAPI('batch_match', {
        limit: 100,
        dry_run: false
      });

      if (!result.success) {
        throw new Error(result.error || '알 수 없는 오류');
      }

      const r = result.result || {};
      // bulk_matched, share_matched도 포함해야 함!
      const batchTotal = (r.matched || 0) + (r.bulk_matched || 0) + (r.share_matched || 0) + (r.ambiguous || 0) + (r.failed || 0);

      // 처리된 건이 0이면 완료
      if (batchTotal === 0) {
        pnuAutoMatchRunning = false;
        updatePnuResultCard(totalMatched, totalAmbiguous, totalFailed, `✅ 완료! (${batchCount}회)`, 'var(--success)');
        break;
      }

      // 누적 통계 업데이트 (bulk_matched, share_matched도 matched에 합산)
      totalMatched += (r.matched || 0) + (r.bulk_matched || 0) + (r.share_matched || 0);
      totalAmbiguous += r.ambiguous || 0;
      totalFailed += r.failed || 0;

      // 실시간 통계 표시
      updatePnuResultCard(totalMatched, totalAmbiguous, totalFailed, `⏳ 배치 #${batchCount} 완료`);

      // 1초 대기 후 다음 배치 (API 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // 사용자가 중지한 경우
    if (!pnuAutoMatchRunning && batchCount > 0) {
      updatePnuResultCard(totalMatched, totalAmbiguous, totalFailed, `⏹️ 중지됨 (${batchCount}회)`, 'var(--warning)');
    }

    // 통계 새로고침
    await loadPnuStats();

  } catch (error) {
    pnuAutoMatchRunning = false;
    updatePnuResultCard(totalMatched, totalAmbiguous, totalFailed, `❌ 오류: ${error.message}`, 'var(--danger)');
  } finally {
    pnuAutoMatchRunning = false;
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    btnText.textContent = '⚡ 자동 매칭';
  }
}

async function retryFailedMatches() {
  if (!confirm('실패한 매칭 건들을 재시도하시겠습니까?\n(재시도 횟수 3회 미만인 건만 처리됩니다)')) {
    return;
  }

  try {
    const result = await callPnuMatcherAPI('retry_failed');

    if (result.success) {
      showSuccess(`재시도 완료: ${result.retried || 0}건 처리됨`);
      await loadPnuStats();
    } else {
      showError('재시도 실패: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    showError('재시도 실패: ' + error.message);
  }
}

// 실패/중복 기록 초기화 (재매칭 대상으로 만들기)
async function clearMatchingRecords(type) {
  const messages = {
    'clear_failures': '실패 기록을 모두 삭제하시겠습니까?\n(삭제된 건들은 다시 매칭 대상이 됩니다)',
    'clear_ambiguous': '중복 후보 기록을 모두 삭제하시겠습니까?\n(삭제된 건들은 다시 매칭 대상이 됩니다)',
    'clear_all': '실패 + 중복 후보 기록을 모두 삭제하시겠습니까?\n(삭제된 건들은 다시 매칭 대상이 됩니다)'
  };

  if (!confirm(messages[type] || '정말 삭제하시겠습니까?')) {
    return;
  }

  try {
    const result = await callPnuMatcherAPI(type);

    if (result.success) {
      if (type === 'clear_all') {
        showSuccess(`삭제 완료: 실패 ${result.deleted_failures || 0}건, 중복 ${result.deleted_ambiguous || 0}건`);
      } else {
        showSuccess(`삭제 완료: ${result.deleted || 0}건`);
      }
      await loadPnuStats();
    } else {
      showError('삭제 실패: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    showError('삭제 실패: ' + error.message);
  }
}

// ============================================
// PNU 서브탭 전환 함수
// ============================================

function switchPnuSubTab(tabName) {
  // 서브탭 버튼 스타일 업데이트
  document.querySelectorAll('.sub-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.subtab === tabName);
  });

  // 서브탭 컨텐츠 표시/숨김
  document.getElementById('pnu-subtab-land').style.display = tabName === 'land' ? 'block' : 'none';
  document.getElementById('pnu-subtab-commercial').style.display = tabName === 'commercial' ? 'block' : 'none';

  // 해당 탭의 통계 로드
  if (tabName === 'land') {
    loadPnuStats();
  } else {
    loadCommercialStats();
  }
}

// ============================================
// Commercial (상가) PNU Matcher Functions
// ============================================

async function callCommercialMatcherAPI(action, data = {}) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/commercial-pnu-matcher`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: action,
        ...data
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Commercial Matcher API 오류:', result);
      throw new Error(result.error || `API 호출 실패 (${response.status})`);
    }

    return result;
  } catch (error) {
    console.error('Commercial Matcher API 오류:', error);
    throw error;
  }
}

async function loadCommercialStats() {
  try {
    const result = await callCommercialMatcherAPI('status');

    if (result.stats) {
      const stats = result.stats;

      // 통계 업데이트
      document.getElementById('commercialStatTotal').textContent = formatNumber(stats.total_commercial_transactions || 0);
      document.getElementById('commercialStatMatched').textContent = formatNumber(stats.matched_count || 0);
      document.getElementById('commercialStatUnmatched').textContent = formatNumber(stats.unmatched_count || 0);
      document.getElementById('commercialStatAmbiguous').textContent = formatNumber(stats.ambiguous_count || 0);
      document.getElementById('commercialStatFailed').textContent = formatNumber(stats.failed_count || 0);
      document.getElementById('commercialStatAutoApproved').textContent = formatNumber(stats.auto_approved_count || 0);

      // 매칭률 업데이트
      const matchRate = stats.match_rate || 0;
      document.getElementById('commercialMatchRate').textContent = `${matchRate}%`;
      document.getElementById('commercialMatchRateBar').style.width = `${matchRate}%`;
    }

    // 중복 후보 목록
    if (result.ambiguous && result.ambiguous.length > 0) {
      renderCommercialAmbiguousList(result.ambiguous);
    } else {
      document.getElementById('commercialAmbiguousList').innerHTML =
        '<p style="color: var(--text-secondary); font-size: 12px;">미해결 중복 후보 없음</p>';
    }

    // 실패 목록
    if (result.failed && result.failed.length > 0) {
      renderCommercialFailedList(result.failed);
    } else {
      document.getElementById('commercialFailedList').innerHTML =
        '<p style="color: var(--text-secondary); font-size: 12px;">매칭 실패 건 없음</p>';
    }

  } catch (error) {
    showError('상가 매칭 통계 로드 실패: ' + error.message);
  }
}

function renderCommercialAmbiguousList(items) {
  const container = document.getElementById('commercialAmbiguousList');

  let html = '<table style="width: 100%; font-size: 11px;">';
  html += '<thead><tr><th>거래ID</th><th>지번</th><th>후보수</th><th>등록일</th></tr></thead><tbody>';

  items.slice(0, 20).forEach(item => {
    const createdAt = new Date(item.created_at).toLocaleDateString('ko-KR');
    html += `
      <tr>
        <td>${item.transaction_id}</td>
        <td>${escapeHtml(item.jibun || '-')}</td>
        <td><span class="badge warning">${item.candidate_count || (item.candidate_pnus?.length || 0)}건</span></td>
        <td>${createdAt}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';

  if (items.length > 20) {
    html += `<p style="margin-top: 8px; font-size: 11px; color: var(--text-secondary);">외 ${items.length - 20}건 더...</p>`;
  }

  container.innerHTML = html;
}

function renderCommercialFailedList(items) {
  const container = document.getElementById('commercialFailedList');

  let html = '<table style="width: 100%; font-size: 11px;">';
  html += '<thead><tr><th>거래ID</th><th>실패 사유</th><th>재시도</th></tr></thead><tbody>';

  items.slice(0, 20).forEach(item => {
    const reasonText = {
      'no_building_register': '건축물대장 없음',
      'no_match': '매칭 불가',
      'api_error': 'API 오류',
      'low_confidence': '신뢰도 낮음'
    }[item.reason] || item.reason || '-';

    html += `
      <tr>
        <td>${item.transaction_id}</td>
        <td><span class="badge danger">${reasonText}</span></td>
        <td>${item.retry_count || 0}회</td>
      </tr>
    `;
  });

  html += '</tbody></table>';

  if (items.length > 20) {
    html += `<p style="margin-top: 8px; font-size: 11px; color: var(--text-secondary);">외 ${items.length - 20}건 더...</p>`;
  }

  container.innerHTML = html;
}

async function runCommercialBatchMatch() {
  const lawdCd = document.getElementById('commercialLawdCd').value.trim();
  const limit = parseInt(document.getElementById('commercialLimit').value) || 50;

  // 버튼 비활성화
  const btn = document.getElementById('btnRunCommercialMatch');
  const btnText = document.getElementById('btnRunCommercialMatchText');
  btn.disabled = true;
  btnText.textContent = '⏳ 실행 중...';

  // 결과 카드 초기화
  updateCommercialResultCard(0, 0, 0, '⏳ 매칭 진행 중... (시간이 걸릴 수 있습니다)');

  try {
    const params = { limit: limit };
    if (lawdCd) params.lawd_cd = lawdCd;

    const result = await callCommercialMatcherAPI('batch_match', params);

    if (result.success !== false) {
      updateCommercialResultCard(
        result.matched || 0,
        result.skipped || 0,
        result.failed || 0,
        `✅ 완료`,
        'var(--success)'
      );

      // 통계 새로고침
      await loadCommercialStats();
    } else {
      updateCommercialResultCard(0, 0, 0, `❌ 오류: ${result.error || '알 수 없는 오류'}`, 'var(--danger)');
    }

  } catch (error) {
    updateCommercialResultCard(0, 0, 0, `❌ 오류: ${error.message}`, 'var(--danger)');
  } finally {
    btn.disabled = false;
    btnText.textContent = '▶ 배치 실행';
  }
}

// 상가 자동 반복 매칭 상태
let commercialAutoMatchRunning = false;

function updateCommercialResultCard(matched, skipped, failed, status, borderColor = 'var(--accent-cyan)') {
  const card = document.getElementById('commercialResultCard');
  const statusEl = document.getElementById('commercialResultStatus');

  card.style.display = 'block';
  card.style.borderColor = borderColor;

  document.getElementById('commercialResultMatched').textContent = matched;
  document.getElementById('commercialResultSkipped').textContent = skipped;
  document.getElementById('commercialResultFailed').textContent = failed;
  statusEl.textContent = status;
}

async function runCommercialQuickMatch() {
  const btn = document.getElementById('btnRunCommercialQuick');
  const btnText = document.getElementById('btnRunCommercialQuickText');

  // 이미 실행 중이면 중지
  if (commercialAutoMatchRunning) {
    commercialAutoMatchRunning = false;
    btnText.textContent = '⏹️ 중지 중...';
    return;
  }

  if (!confirm('남은 데이터가 없을 때까지 50건씩 자동으로 매칭합니다.\n(버튼을 다시 클릭하면 중지됩니다)\n\n⚠️ 상가 매칭은 건축물대장 API를 사용하므로 시간이 오래 걸릴 수 있습니다.\n\n시작하시겠습니까?')) {
    return;
  }

  commercialAutoMatchRunning = true;
  btnText.textContent = '⏹️ 중지';
  btn.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';

  // 누적 통계
  let totalMatched = 0;
  let totalSkipped = 0;
  let totalFailed = 0;
  let batchCount = 0;

  try {
    while (commercialAutoMatchRunning) {
      batchCount++;
      updateCommercialResultCard(totalMatched, totalSkipped, totalFailed, `⚡ 배치 #${batchCount} 진행 중...`);

      const result = await callCommercialMatcherAPI('batch_match', { limit: 50 });

      if (result.success === false) {
        throw new Error(result.error || '알 수 없는 오류');
      }

      const batchTotal = (result.matched || 0) + (result.skipped || 0) + (result.failed || 0);

      // 처리된 건이 0이면 완료
      if (batchTotal === 0) {
        commercialAutoMatchRunning = false;
        updateCommercialResultCard(totalMatched, totalSkipped, totalFailed, `✅ 완료! (${batchCount}회)`, 'var(--success)');
        break;
      }

      // 누적 통계 업데이트
      totalMatched += result.matched || 0;
      totalSkipped += result.skipped || 0;
      totalFailed += result.failed || 0;

      // 실시간 통계 표시
      updateCommercialResultCard(totalMatched, totalSkipped, totalFailed, `⏳ 배치 #${batchCount} 완료`);

      // 2초 대기 후 다음 배치 (건축물대장 API 부하 방지)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // 사용자가 중지한 경우
    if (!commercialAutoMatchRunning && batchCount > 0) {
      updateCommercialResultCard(totalMatched, totalSkipped, totalFailed, `⏹️ 중지됨 (${batchCount}회)`, 'var(--warning)');
    }

    // 통계 새로고침
    await loadCommercialStats();

  } catch (error) {
    commercialAutoMatchRunning = false;
    updateCommercialResultCard(totalMatched, totalSkipped, totalFailed, `❌ 오류: ${error.message}`, 'var(--danger)');
  } finally {
    commercialAutoMatchRunning = false;
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    btnText.textContent = '⚡ 자동 매칭';
  }
}

async function viewLoginHistory(userId, displayName, page = 1) {
  currentLoginHistoryUserId = userId;
  currentLoginHistoryPage = page;

  // 모달 열기
  document.getElementById('loginHistoryModal').classList.add('show');

  // 로딩 표시
  const container = document.getElementById('loginHistoryContent');
  container.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #999;">
      로딩 중...
    </div>
  `;

  try {
    // API 호출
    const result = await callAdminAPI('get_login_history', {
      userId: userId,
      page: page,
      limit: 10
    });

    if (!result.success) {
      throw new Error(result.error || '로그인 기록을 불러올 수 없습니다.');
    }

    const { history, total, totalPages } = result;

    // 기록이 없는 경우
    if (!history || history.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔐</div>
          <div class="message">로그인 기록이 없습니다</div>
          <div class="submessage">${escapeHtml(displayName)}님의 로그인 기록이 없습니다.</div>
        </div>
      `;
      document.getElementById('loginHistoryPagination').innerHTML = '';
      return;
    }

    // 테이블 생성
    let html = `
      <h4 style="margin-bottom: 16px;">${escapeHtml(displayName)}님의 로그인 기록 (총 ${total}건)</h4>
      <table class="login-history-table">
        <thead>
          <tr>
            <th>로그인 시간</th>
            <th>IP 주소</th>
            <th>브라우저</th>
            <th>OS</th>
            <th>디바이스</th>
          </tr>
        </thead>
        <tbody>
    `;

    history.forEach(record => {
      const loginTime = new Date(record.login_at).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });

      const deviceClass = record.device_type || 'desktop';

      html += `
        <tr>
          <td>${loginTime}</td>
          <td>${escapeHtml(record.ip_address || 'unknown')}</td>
          <td>${escapeHtml(record.browser || 'Unknown')}</td>
          <td>${escapeHtml(record.os || 'Unknown')}</td>
          <td><span class="device-badge ${deviceClass}">${escapeHtml(record.device_type || 'desktop')}</span></td>
        </tr>
      `;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;

    // 페이지네이션 표시
    if (totalPages > 1) {
      let paginationHtml = `
        <button onclick="viewLoginHistory('${userId}', '${escapeHtml(displayName)}', ${page - 1})" ${page <= 1 ? 'disabled' : ''}>◀ 이전</button>
        <span class="page-info">${page} / ${totalPages}</span>
        <button onclick="viewLoginHistory('${userId}', '${escapeHtml(displayName)}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''}>다음 ▶</button>
      `;
      document.getElementById('loginHistoryPagination').innerHTML = paginationHtml;
    } else {
      document.getElementById('loginHistoryPagination').innerHTML = '';
    }

  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">❌</div>
        <div class="message">로그인 기록을 불러올 수 없습니다</div>
        <div class="submessage">${escapeHtml(error.message)}</div>
      </div>
    `;
    document.getElementById('loginHistoryPagination').innerHTML = '';
  }
}

// ============================================
// Lookup Stats (조회 통계)
// ============================================

// 시군구코드 → 지역명 매핑 (주요 지역)
const LAWD_CODE_MAP = {
  '11110': '서울 종로구', '11140': '서울 중구', '11170': '서울 용산구', '11200': '서울 성동구',
  '11215': '서울 광진구', '11230': '서울 동대문구', '11260': '서울 중랑구', '11290': '서울 성북구',
  '11305': '서울 강북구', '11320': '서울 도봉구', '11350': '서울 노원구', '11380': '서울 은평구',
  '11410': '서울 서대문구', '11440': '서울 마포구', '11470': '서울 양천구', '11500': '서울 강서구',
  '11530': '서울 구로구', '11545': '서울 금천구', '11560': '서울 영등포구', '11590': '서울 동작구',
  '11620': '서울 관악구', '11650': '서울 서초구', '11680': '서울 강남구', '11710': '서울 송파구',
  '11740': '서울 강동구',
  '26110': '부산 중구', '26140': '부산 서구', '26170': '부산 동구', '26200': '부산 영도구',
  '26230': '부산 부산진구', '26260': '부산 동래구', '26290': '부산 남구', '26320': '부산 북구',
  '26350': '부산 해운대구', '26380': '부산 사하구', '26410': '부산 금정구', '26440': '부산 강서구',
  '26470': '부산 연제구', '26500': '부산 수영구', '26530': '부산 사상구', '26710': '부산 기장군',
  '28110': '인천 중구', '28140': '인천 동구', '28177': '인천 미추홀구', '28185': '인천 연수구',
  '28200': '인천 남동구', '28237': '인천 부평구', '28245': '인천 계양구', '28260': '인천 서구',
  '28710': '인천 강화군', '28720': '인천 옹진군',
  '41110': '경기 수원 장안구', '41111': '경기 수원 권선구', '41113': '경기 수원 팔달구', '41115': '경기 수원 영통구',
  '41130': '경기 성남 수정구', '41131': '경기 성남 중원구', '41133': '경기 성남 분당구',
  '41150': '경기 의정부', '41170': '경기 안양 만안구', '41171': '경기 안양 동안구',
  '41190': '경기 부천', '41210': '경기 광명', '41220': '경기 평택', '41250': '경기 동두천',
  '41270': '경기 안산 상록구', '41271': '경기 안산 단원구', '41280': '경기 고양 덕양구',
  '41281': '경기 고양 일산동구', '41285': '경기 고양 일산서구', '41290': '경기 과천',
  '41310': '경기 구리', '41360': '경기 남양주', '41370': '경기 오산', '41390': '경기 시흥',
  '41410': '경기 군포', '41430': '경기 의왕', '41450': '경기 하남', '41460': '경기 용인 처인구',
  '41461': '경기 용인 기흥구', '41463': '경기 용인 수지구', '41480': '경기 파주',
  '41500': '경기 이천', '41550': '경기 안성', '41570': '경기 김포', '41590': '경기 화성',
  '41610': '경기 광주', '41630': '경기 양주', '41650': '경기 포천', '41670': '경기 여주',
};

function getLawdCodeName(lawdCd) {
  return LAWD_CODE_MAP[lawdCd] || lawdCd;
}

async function loadLookupStats() {
  const period = parseInt(document.getElementById('lookupStatsPeriod').value) || 1;
  const loading = document.getElementById('lookupStatsLoading');
  loading.style.display = 'inline';

  try {
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        admin_token: token,
        action: 'get_lookup_stats',
        period,
        limit: 20
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'API 오류');
    }

    // 총 조회수
    document.getElementById('statTotalLookups').textContent = (data.totalLookups || 0).toLocaleString();

    // 인기 지역 렌더링
    renderPopularRegions(data.popularRegions || []);

    // 인기 검색어 렌더링
    renderPopularQueries(data.popularQueries || []);

    // 유저별 조회 통계 렌더링
    renderUserLookupStats(data.userLookupStats || []);

  } catch (error) {
    console.error('조회 통계 로드 실패:', error);
    document.getElementById('popularRegionsContent').innerHTML = `
      <div class="empty-state">
        <div class="icon">❌</div>
        <div class="message">데이터를 불러올 수 없습니다</div>
        <div class="submessage">${escapeHtml(error.message)}</div>
      </div>
    `;
  } finally {
    loading.style.display = 'none';
  }
}

function renderPopularRegions(regions) {
  const container = document.getElementById('popularRegionsContent');

  if (!regions || regions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div class="message">조회 데이터가 없습니다</div>
      </div>
    `;
    return;
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">순위</th>
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">지역</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">조회수</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">유저수</th>
        </tr>
      </thead>
      <tbody>
  `;

  regions.forEach((region, idx) => {
    const medal = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}`;
    // API에서 룩업한 region_name 우선 사용, 없으면 클라이언트 룩업
    const regionName = region.region_name || getLawdCodeName(region.lawd_cd);
    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 8px;">${medal}</td>
        <td style="padding: 8px; font-weight: 600;">${escapeHtml(regionName)}</td>
        <td style="padding: 8px; text-align: right; color: var(--accent-cyan);">${region.lookup_count.toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; color: var(--text-secondary);">${region.unique_users.toLocaleString()}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderPopularQueries(queries) {
  const container = document.getElementById('popularQueriesContent');

  if (!queries || queries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div class="message">검색어 데이터가 없습니다</div>
      </div>
    `;
    return;
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">순위</th>
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">검색어</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">검색수</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">유저수</th>
        </tr>
      </thead>
      <tbody>
  `;

  queries.forEach((query, idx) => {
    const medal = idx < 3 ? ['🥇', '🥈', '🥉'][idx] : `${idx + 1}`;
    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 8px;">${medal}</td>
        <td style="padding: 8px; font-weight: 600;">${escapeHtml(query.search_query)}</td>
        <td style="padding: 8px; text-align: right; color: var(--accent-magenta);">${query.search_count.toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; color: var(--text-secondary);">${query.unique_users.toLocaleString()}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderUserLookupStats(users) {
  const container = document.getElementById('userLookupStatsContent');

  if (!users || users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div class="message">유저 조회 데이터가 없습니다</div>
      </div>
    `;
    return;
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">유저</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">총 조회</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">PNU</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">검색</th>
          <th style="text-align: center; padding: 8px; color: var(--text-secondary);">상세</th>
        </tr>
      </thead>
      <tbody>
  `;

  users.forEach((user) => {
    // 닉네임 + admin_memo 표시
    const displayName = user.admin_memo
      ? `${user.nickname} <span style="color: var(--text-secondary); font-weight: normal;">(${escapeHtml(user.admin_memo)})</span>`
      : escapeHtml(user.nickname);
    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 8px; font-weight: 600;">${displayName}</td>
        <td style="padding: 8px; text-align: right; color: var(--accent-yellow);">${user.total_lookups.toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; color: var(--accent-cyan);">${user.pnu_lookups.toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; color: var(--accent-magenta);">${user.search_lookups.toLocaleString()}</td>
        <td style="padding: 8px; text-align: center;">
          <button onclick="viewUserLookupHistory('${user.user_id}', '${escapeHtml(user.nickname)}')"
                  style="padding: 4px 8px; background: var(--bg-tertiary); border: 1px solid var(--border-color); color: var(--text-primary); border-radius: 4px; cursor: pointer;">
            📋
          </button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// 유저 조회 내역 - 페이지네이션 상태
let lookupHistoryState = {
  userId: null,
  nickname: null,
  page: 1,
  limit: 30,
  totalCount: 0
};

async function viewUserLookupHistory(userId, nickname, page = 1) {
  try {
    lookupHistoryState.userId = userId;
    lookupHistoryState.nickname = nickname;
    lookupHistoryState.page = page;

    const token = localStorage.getItem('admin_token');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        admin_token: token,
        action: 'get_user_lookup_history',
        userId,
        page,
        limit: lookupHistoryState.limit
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'API 오류');
    }

    lookupHistoryState.totalCount = data.totalCount || 0;

    // PNU에서 지번 추출 (본번-부번)
    const extractJibun = (pnu) => {
      if (!pnu || pnu.length < 19) return '-';
      const bonbun = parseInt(pnu.substring(11, 15), 10);
      const bubun = parseInt(pnu.substring(15, 19), 10);
      return bubun > 0 ? `${bonbun}-${bubun}` : `${bonbun}`;
    };

    // 날짜 포맷 (MM월 DD일 HH:mm)
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hour = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${month}월 ${day}일 ${hour}:${min}`;
    };

    // 지역별로 그룹핑 (최근 조회 지역 우선, 그 안에서 시간순)
    const groupByRegion = (history) => {
      // 1. 지역별로 그룹핑
      const regionMap = new Map();

      for (const item of history) {
        const regionKey = item.pnu ? (item.region_name || getLawdCodeName(item.lawd_cd)) : `🔍 ${item.search_query}`;

        if (!regionMap.has(regionKey)) {
          regionMap.set(regionKey, {
            region: regionKey,
            isPnu: !!item.pnu,
            latestTime: item.lookup_at,
            items: []
          });
        }

        const group = regionMap.get(regionKey);
        group.items.push({
          jibun: item.pnu ? extractJibun(item.pnu) : '-',
          time: formatDate(item.lookup_at),
          rawTime: item.lookup_at
        });

        // 최신 시간 갱신
        if (item.lookup_at > group.latestTime) {
          group.latestTime = item.lookup_at;
        }
      }

      // 2. 지역별 최신 조회 시간으로 정렬
      const groups = Array.from(regionMap.values());
      groups.sort((a, b) => new Date(b.latestTime) - new Date(a.latestTime));

      // 3. 각 그룹 내에서 시간순 정렬 (최신이 위)
      groups.forEach(group => {
        group.items.sort((a, b) => new Date(b.rawTime) - new Date(a.rawTime));
      });

      return groups;
    };

    // 모달 HTML 생성
    const totalPages = Math.ceil(lookupHistoryState.totalCount / lookupHistoryState.limit);

    let historyHtml = `
      <div style="max-height: 500px; overflow-y: auto;">
        <h3 style="margin-bottom: 16px; color: var(--accent-cyan);">
          📋 ${escapeHtml(nickname)}님의 조회 내역
          <span style="font-size: 12px; color: var(--text-secondary); font-weight: normal;">
            (총 ${lookupHistoryState.totalCount}건)
          </span>
        </h3>
    `;

    if (!data.history || data.history.length === 0) {
      historyHtml += '<p style="color: var(--text-secondary);">조회 내역이 없습니다.</p>';
    } else {
      const groups = groupByRegion(data.history);

      historyHtml += `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="border-bottom: 2px solid var(--accent-cyan);">
              <th style="text-align: left; padding: 8px; color: var(--accent-cyan); width: 45%;">지역</th>
              <th style="text-align: center; padding: 8px; color: var(--accent-cyan); width: 20%;">지번</th>
              <th style="text-align: right; padding: 8px; color: var(--accent-cyan); width: 35%;">조회일시</th>
            </tr>
          </thead>
          <tbody>
      `;

      groups.forEach((group, groupIdx) => {
        group.items.forEach((item, itemIdx) => {
          const isFirstInGroup = itemIdx === 0;
          const rowStyle = groupIdx % 2 === 0 ? 'background: var(--bg-tertiary);' : '';
          const borderStyle = isFirstInGroup && groupIdx > 0 ? 'border-top: 1px solid var(--border-color);' : '';

          historyHtml += `
            <tr style="${rowStyle} ${borderStyle}">
              ${isFirstInGroup ? `
                <td rowspan="${group.items.length}" style="padding: 8px; vertical-align: top; font-weight: 600; color: ${group.isPnu ? 'var(--text-primary)' : 'var(--accent-magenta)'};">
                  ${escapeHtml(group.region)}
                </td>
              ` : ''}
              <td style="padding: 6px 8px; text-align: center; color: var(--accent-cyan);">${escapeHtml(item.jibun)}</td>
              <td style="padding: 6px 8px; text-align: right; color: var(--text-secondary); font-size: 11px;">${item.time}</td>
            </tr>
          `;
        });
      });

      historyHtml += '</tbody></table>';
    }

    historyHtml += '</div>';

    // 기존 모달 사용 (loginHistoryModal 재활용)
    const modal = document.getElementById('loginHistoryModal');
    const content = document.getElementById('loginHistoryContent');
    const paginationEl = document.getElementById('loginHistoryPagination');

    if (modal && content) {
      document.querySelector('#loginHistoryModal .modal-header').textContent = '📋 조회 내역';
      content.innerHTML = historyHtml;

      // 페이지네이션 렌더링
      if (totalPages > 1) {
        paginationEl.innerHTML = `
          <button onclick="viewUserLookupHistory('${userId}', '${escapeHtml(nickname)}', ${page - 1})" ${page <= 1 ? 'disabled' : ''}>◀ 이전</button>
          <span class="page-info">${page} / ${totalPages}</span>
          <button onclick="viewUserLookupHistory('${userId}', '${escapeHtml(nickname)}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''}>다음 ▶</button>
        `;
      } else {
        paginationEl.innerHTML = '';
      }

      modal.classList.add('show');
    } else {
      // 모달이 없으면 alert 폴백
      alert(`${nickname}님의 최근 조회 ${data.history?.length || 0}건`);
    }

  } catch (error) {
    console.error('조회 내역 로드 실패:', error);
    alert('조회 내역을 불러올 수 없습니다: ' + error.message);
  }
}

// ============================================
// Session Stats (세션 통계)
// ============================================
async function loadSessionStats() {
  const loading = document.getElementById('sessionStatsLoading');
  loading.style.display = 'inline';

  try {
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        admin_token: token,
        action: 'get_session_stats'
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error || 'API 오류');
    }

    // 일별 활성 유저 렌더링
    renderDailyActiveUsers(data.dailyActiveUsers || []);

    // 유저별 세션 통계 렌더링
    renderUserSessionStats(data.userSessionStats || []);

    // 익스텐션 버전별 사용 현황 렌더링
    renderExtensionVersionStats(data.extensionVersionStats || []);

  } catch (error) {
    console.error('세션 통계 로드 실패:', error);
    document.getElementById('dailyActiveUsersContent').innerHTML = `
      <div class="empty-state">
        <div class="icon">❌</div>
        <div class="message">데이터를 불러올 수 없습니다</div>
        <div class="submessage">${escapeHtml(error.message)}</div>
      </div>
    `;
  } finally {
    loading.style.display = 'none';
  }
}

function renderDailyActiveUsers(days) {
  const container = document.getElementById('dailyActiveUsersContent');

  if (!days || days.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div class="message">세션 데이터가 없습니다</div>
      </div>
    `;
    return;
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">날짜</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">로그인 유저</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">비로그인 유저</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">총 세션</th>
        </tr>
      </thead>
      <tbody>
  `;

  days.forEach(day => {
    const dateStr = new Date(day.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 8px; font-weight: 600;">${dateStr}</td>
        <td style="padding: 8px; text-align: right; color: var(--accent-cyan);">${(day.logged_in_users || 0).toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; color: var(--text-secondary);">${(day.anonymous_users || 0).toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; color: var(--success);">${(day.total_sessions || 0).toLocaleString()}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderUserSessionStats(users) {
  const container = document.getElementById('userSessionStatsContent');

  if (!users || users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div class="message">유저 세션 데이터가 없습니다</div>
      </div>
    `;
    return;
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">유저</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">세션 수</th>
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">첫 세션</th>
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">마지막 세션</th>
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">주 사용 버전</th>
        </tr>
      </thead>
      <tbody>
  `;

  users.forEach(user => {
    const firstSession = user.first_session ? new Date(user.first_session).toLocaleDateString('ko-KR') : '-';
    const lastSession = user.last_session ? new Date(user.last_session).toLocaleDateString('ko-KR') : '-';
    const displayName = user.nickname || (user.user_id ? user.user_id.substring(0, 8) + '...' : '-');
    const profileImg = user.profile_image
      ? `<img src="${escapeHtml(user.profile_image)}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-right: 8px; vertical-align: middle;">`
      : `<div style="width: 32px; height: 32px; border-radius: 50%; background: var(--bg-tertiary); display: inline-flex; align-items: center; justify-content: center; margin-right: 8px; vertical-align: middle; font-size: 14px;">👤</div>`;

    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 8px;">
          <div style="display: flex; align-items: center;">
            ${profileImg}
            <div>
              <div style="font-weight: 600;">${escapeHtml(displayName)}</div>
              ${user.admin_memo ? `<div style="font-size: 10px; color: var(--warning);">${escapeHtml(user.admin_memo)}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="padding: 8px; text-align: right; color: var(--accent-cyan); font-weight: 600;">${(user.session_count || 0).toLocaleString()}</td>
        <td style="padding: 8px; color: var(--text-secondary);">${firstSession}</td>
        <td style="padding: 8px; color: var(--success);">${lastSession}</td>
        <td style="padding: 8px;"><span class="badge pro">${escapeHtml(user.most_used_version || '-')}</span></td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderExtensionVersionStats(versions) {
  const container = document.getElementById('extensionVersionStatsContent');

  if (!versions || versions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div class="message">버전 데이터가 없습니다</div>
      </div>
    `;
    return;
  }

  let html = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 1px solid var(--border-color);">
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">버전</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">세션 수</th>
          <th style="text-align: right; padding: 8px; color: var(--text-secondary);">사용자 수</th>
          <th style="text-align: left; padding: 8px; color: var(--text-secondary);">마지막 사용</th>
        </tr>
      </thead>
      <tbody>
  `;

  versions.forEach((ver, idx) => {
    const lastUsed = ver.last_used_at ? new Date(ver.last_used_at).toLocaleDateString('ko-KR') : '-';
    const isLatest = idx === 0;
    const badgeClass = isLatest ? 'active' : 'free';

    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 8px;">
          <span class="badge ${badgeClass}">${escapeHtml(ver.extension_version || 'unknown')}</span>
          ${isLatest ? '<span style="margin-left: 8px; color: var(--success); font-size: 10px;">LATEST</span>' : ''}
        </td>
        <td style="padding: 8px; text-align: right; color: var(--accent-magenta); font-weight: 600;">${(ver.session_count || 0).toLocaleString()}</td>
        <td style="padding: 8px; text-align: right; color: var(--accent-cyan);">${(ver.unique_users || 0).toLocaleString()}</td>
        <td style="padding: 8px; color: var(--text-secondary);">${lastUsed}</td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ============================================
// MOLIT 수집 현황 (수집 현황 탭)
// ============================================
let molitStatusData = [];
let currentMolitStatusFilter = 'all';

async function loadMolitStatus() {
  const container = document.getElementById('molitStatusContent');
  container.innerHTML = '<div class="loading">수집 현황을 불러오는 중...</div>';

  try {
    const result = await callAdminAPI('get_molit_status');
    molitStatusData = result.regions || [];

    // 통계 업데이트
    const now = new Date();
    const ttlCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60일 전

    const validCount = molitStatusData.filter(r => new Date(r.last_collected_at) >= ttlCutoff).length;
    const expiredCount = molitStatusData.filter(r => new Date(r.last_collected_at) < ttlCutoff).length;
    const emptyCount = molitStatusData.filter(r => r.total_records === 0).length;

    document.getElementById('molitStatRegions').textContent = molitStatusData.length;
    document.getElementById('molitStatValid').textContent = validCount;
    document.getElementById('molitStatExpired').textContent = expiredCount;
    document.getElementById('molitStatEmpty').textContent = emptyCount;

    renderMolitStatusTable();
  } catch (error) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">❌</div>
        <div class="message">수집 현황 로드 실패: ${error.message}</div>
      </div>
    `;
  }
}

function setMolitStatusFilter(filter) {
  currentMolitStatusFilter = filter;

  // 필터 버튼 활성화 상태 업데이트
  document.querySelectorAll('#tab-molit-status .filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  renderMolitStatusTable();
}

function renderMolitStatusTable() {
  const container = document.getElementById('molitStatusContent');
  const now = new Date();
  const ttlCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // 필터 적용
  let filtered = molitStatusData;
  if (currentMolitStatusFilter === 'valid') {
    filtered = molitStatusData.filter(r => new Date(r.last_collected_at) >= ttlCutoff);
  } else if (currentMolitStatusFilter === 'expired') {
    filtered = molitStatusData.filter(r => new Date(r.last_collected_at) < ttlCutoff);
  } else if (currentMolitStatusFilter === 'empty') {
    filtered = molitStatusData.filter(r => r.total_records === 0);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <div class="message">해당 조건의 지역이 없습니다</div>
      </div>
    `;
    return;
  }

  // 정렬: 마지막 수집일 내림차순
  filtered.sort((a, b) => new Date(b.last_collected_at) - new Date(a.last_collected_at));

  let html = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid var(--border-color);">
          <th style="text-align: left; padding: 12px; color: var(--text-secondary);">지역</th>
          <th style="text-align: center; padding: 12px; color: var(--text-secondary);">유형</th>
          <th style="text-align: right; padding: 12px; color: var(--text-secondary);">수집 건수</th>
          <th style="text-align: center; padding: 12px; color: var(--text-secondary);">마지막 수집</th>
          <th style="text-align: center; padding: 12px; color: var(--text-secondary);">상태</th>
          <th style="text-align: center; padding: 12px; color: var(--text-secondary);">액션</th>
        </tr>
      </thead>
      <tbody>
  `;

  filtered.forEach(region => {
    const lastCollected = new Date(region.last_collected_at);
    const isExpired = lastCollected < ttlCutoff;
    const isEmpty = region.total_records === 0;
    const daysAgo = Math.floor((now - lastCollected) / (24 * 60 * 60 * 1000));

    const regionName = region.region_name || getLawdCodeName(region.lawd_cd) || region.lawd_cd;
    const typeLabel = region.transaction_type === 'land' ? '🏞️ 토지' : '🏢 상가';
    const statusBadge = isEmpty
      ? '<span class="badge" style="background: #8b5cf6;">0건</span>'
      : isExpired
        ? '<span class="badge" style="background: var(--warning);">TTL 만료</span>'
        : '<span class="badge active">유효</span>';

    html += `
      <tr style="border-bottom: 1px solid var(--border-color);">
        <td style="padding: 10px 12px;">
          <strong>${escapeHtml(regionName)}</strong>
          <span style="color: var(--text-tertiary); font-size: 11px; margin-left: 8px;">${region.lawd_cd}</span>
        </td>
        <td style="padding: 10px 12px; text-align: center;">${typeLabel}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 600; color: ${isEmpty ? '#8b5cf6' : 'var(--accent-cyan)'};">
          ${region.total_records.toLocaleString()}건
        </td>
        <td style="padding: 10px 12px; text-align: center; color: var(--text-secondary);">
          ${lastCollected.toLocaleDateString('ko-KR')}
          <span style="font-size: 11px; color: ${isExpired ? 'var(--warning)' : 'var(--text-tertiary)'};">
            (${daysAgo}일 전)
          </span>
        </td>
        <td style="padding: 10px 12px; text-align: center;">${statusBadge}</td>
        <td style="padding: 10px 12px; text-align: center;">
          <button class="action-btn ${isExpired || isEmpty ? 'primary' : 'secondary'}"
                  onclick="forceCollectRegion('${region.lawd_cd}', '${region.transaction_type}', '${escapeHtml(regionName)}')"
                  style="padding: 4px 10px; font-size: 11px;">
            🔄 ${isExpired || isEmpty ? '강제수집' : '재수집'}
          </button>
        </td>
      </tr>
    `;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

// 수집 진행 중인 지역 추적
const activeCollections = new Map(); // lawdCd_type -> {startCount, intervalId}

async function forceCollectRegion(lawdCd, transactionType, regionName) {
  if (!confirm(`${regionName} (${transactionType === 'land' ? '토지' : '상가'})를 강제로 재수집하시겠습니까?\n\n⚠️ TTL 60일을 무시하고 즉시 수집을 시작합니다.`)) {
    return;
  }

  const collectionKey = `${lawdCd}_${transactionType}`;

  // 이미 수집 중이면 중복 실행 방지
  if (activeCollections.has(collectionKey)) {
    showError('이미 수집이 진행 중입니다.');
    return;
  }

  showLoading(true);
  showSuccess(`🔄 ${regionName} 수집 시작...`);

  // 현재 레코드 수 저장
  const { data: startStatus } = await supabase.rpc('get_region_collection_info', {
    p_lawd_cd: lawdCd
  });
  const startCount = startStatus?.find(s => s.transaction_type === transactionType)?.total_records || 0;

  // 버튼 상태 변경 및 진행 모니터링 시작
  const button = event?.target;
  if (button) {
    button.disabled = true;
    button.textContent = '⏳ 수집중...';
    button.style.backgroundColor = '#ffc107';
  }

  // 진행 상태 폴링 시작 (5초마다)
  const intervalId = setInterval(async () => {
    try {
      const { data: currentStatus } = await supabase.rpc('get_region_collection_info', {
        p_lawd_cd: lawdCd
      });
      const currentCount = currentStatus?.find(s => s.transaction_type === transactionType)?.total_records || 0;
      const newRecords = currentCount - startCount;

      if (newRecords > 0 && button) {
        button.textContent = `⏳ ${newRecords}건 수집됨...`;
      }
    } catch (e) {
      console.error('진행 상태 확인 오류:', e);
    }
  }, 5000);

  activeCollections.set(collectionKey, { startCount, intervalId });

  try {
    // molit-transactions 직접 호출 (force: true)
    const response = await fetch(`${SUPABASE_URL}/functions/v1/molit-transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        action: 'collect_region',
        lawd_cd: lawdCd,
        types: [transactionType],
        months: 12,  // 최근 12개월
        force: true  // TTL 무시
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'API 호출 실패');
    }

    const collected = result.collected || {};
    const landCount = collected.land || 0;
    const commercialCount = collected.commercial || 0;
    const autoMatched = collected.autoMatched || {};

    showSuccess(`✅ ${regionName} 수집 완료!\n토지: ${landCount}건, 상가: ${commercialCount}건\n자동매칭: ${autoMatched.matched || 0}건, 지분거래: ${autoMatched.share_matched || 0}건`);

    // 목록 새로고침
    setTimeout(() => loadMolitStatus(), 1000);

  } catch (error) {
    showError(`❌ 수집 실패: ${error.message}`);
  } finally {
    // 진행 상태 폴링 중지
    const collection = activeCollections.get(collectionKey);
    if (collection?.intervalId) {
      clearInterval(collection.intervalId);
    }
    activeCollections.delete(collectionKey);

    // 버튼 상태 복원
    if (button) {
      button.disabled = false;
      button.textContent = '🔄 재수집';
      button.style.backgroundColor = '';
    }

    showLoading(false);
  }
}

// 법정동코드 → 지역명 매핑 (자주 사용되는 지역)
function getLawdCodeName(lawdCd) {
  const names = {
    '11110': '서울 종로구', '11140': '서울 중구', '11170': '서울 용산구', '11200': '서울 성동구',
    '11215': '서울 광진구', '11230': '서울 동대문구', '11260': '서울 중랑구', '11290': '서울 성북구',
    '11305': '서울 강북구', '11320': '서울 도봉구', '11350': '서울 노원구', '11380': '서울 은평구',
    '11410': '서울 서대문구', '11440': '서울 마포구', '11470': '서울 양천구', '11500': '서울 강서구',
    '11530': '서울 구로구', '11545': '서울 금천구', '11560': '서울 영등포구', '11590': '서울 동작구',
    '11620': '서울 관악구', '11650': '서울 서초구', '11680': '서울 강남구', '11710': '서울 송파구',
    '11740': '서울 강동구',
    '41111': '수원 장안구', '41113': '수원 권선구', '41115': '수원 팔달구', '41117': '수원 영통구',
    '41131': '성남 수정구', '41133': '성남 중원구', '41135': '성남 분당구',
    '50110': '제주시', '50130': '서귀포시'
  };
  return names[lawdCd] || null;
}
