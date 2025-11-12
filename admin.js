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
      throw new Error(result.error || 'API 호출 실패');
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
    const stats = await callAdminAPI('get_stats');
    updateStats(stats);

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
            <button class="action-btn danger" onclick='cancelSubscription("${user.subscription_id}", "${user.user_id}")'>❌ 취소</button>
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

async function cancelSubscription(subscriptionId, userId) {
  if (!confirm('이 구독을 취소하시겠습니까?\n\n구독이 즉시 취소되며, 남은 기간은 유지됩니다.')) {
    return;
  }

  try {
    await callAdminAPI('cancel_subscription', { subscriptionId });
    showSuccess('구독이 취소되었습니다.');

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
    const deletedUsers = result.deletedUsers || [];

    if (deletedUsers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <div class="message">탈퇴한 회원이 없습니다</div>
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
            <th>가입일</th>
            <th>마지막 로그인</th>
            <th>탈퇴/차단일</th>
            <th>사유</th>
            <th>관리</th>
          </tr>
        </thead>
        <tbody>
    `;

    deletedUsers.forEach(item => {
      const user = item.user;
      if (!user) return; // 사용자 정보가 없으면 스킵

      const displayName = user.nickname || user.username || user.kakao_id || '알 수 없음';
      const email = user.email || '-';
      const createdAt = user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-';
      const lastLogin = user.last_login ? new Date(user.last_login).toLocaleDateString('ko-KR') : '-';
      const blockedAt = item.blocked_at ? new Date(item.blocked_at).toLocaleDateString('ko-KR') : '-';
      const reason = item.reason || '-';

      html += `
        <tr>
          <td>
            <strong>${escapeHtml(displayName)}</strong>
            ${email !== '-' ? `<br><small>${escapeHtml(email)}</small>` : ''}
          </td>
          <td>${createdAt}</td>
          <td>${lastLogin}</td>
          <td>${blockedAt}</td>
          <td>${escapeHtml(reason)}</td>
          <td>
            <button class="action-btn success" onclick='restoreUser("${user.id}", "${escapeHtml(displayName)}")'>↩️ 복구</button>
            <button class="action-btn danger" onclick='permanentDeleteUser("${user.id}", "${escapeHtml(displayName)}")'>🗑️ 영구삭제</button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;

  } catch (error) {
    showError('탈퇴 회원 목록 로드 실패: ' + error.message);
  } finally {
    showLoading(false);
  }
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

    // 구독 기간 정보
    const startDate = user.start_date ? new Date(user.start_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : null;
    const endDate = user.end_date ? new Date(user.end_date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }) : null;
    const daysLeft = hasActiveSubscription && user.end_date ? Math.ceil((new Date(user.end_date) - new Date()) / (1000 * 60 * 60 * 24)) : null;

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
          ${hasActiveSubscription && startDate && endDate ? `<br><small style="color: #666; white-space: nowrap;">${startDate} ~ ${endDate}</small>` : ''}
          ${daysLeft !== null && daysLeft > 0 ? `<br><small style="color: ${daysLeft <= 7 ? '#f44336' : '#4caf50'};">D-${daysLeft}</small>` : ''}
        </td>
        <td><span class="badge ${status}">${getStatusText(status)}</span></td>
        <td>${createdAt}</td>
        <td style="white-space: nowrap;">
          <button class="action-btn secondary" onclick='viewUser(${JSON.stringify(user)})'>👁️ 상세</button>
          <button class="action-btn" onclick='openEditUserModal(${JSON.stringify(user)})'>✏️ 수정</button>
          ${subCount > 0
            ? `<button class="action-btn secondary" onclick='viewSubscriptionHistory("${user.user_id}", "${escapeHtml(displayName)}")'>📋 이력</button>`
            : ''
          }
          <button class="action-btn primary" onclick='openAddSubModal("${user.user_id}")'>${hasActiveSubscription ? '➕ 연장' : '➕ 구독'}</button>
          ${hasActiveSubscription
            ? `<button class="action-btn danger" onclick='cancelSubscription("${user.subscription_id}", "${user.user_id}")'>❌ 취소</button>`
            : ''
          }
          <button class="action-btn success" onclick='openMemoModal("${user.user_id}", "${escapeHtml(user.admin_memo || '')}")'>📝 메모</button>
          ${user.is_blocked
            ? `<button class="action-btn success" onclick='unblockUser("${user.user_id}")'>✅ 해제</button>`
            : `<button class="action-btn danger" onclick='openBlockModal("${user.user_id}")'>🚫 차단</button>`
          }
          <button class="action-btn danger" onclick='confirmDeleteUser("${user.user_id}", "${escapeHtml(displayName)}")'>🗑️ 탈퇴</button>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;

  // 통계 정보 추가
  const totalCount = filteredUsers.length;
  const activeCount = filteredUsers.filter(u => u.subscription_id && u.status === 'active' && u.end_date && new Date(u.end_date) > new Date()).length;
  const expiredCount = filteredUsers.filter(u => u.subscription_id && !(u.status === 'active' && u.end_date && new Date(u.end_date) > new Date())).length;
  const noneCount = filteredUsers.filter(u => !u.subscription_id || u.plan === 'free').length;

  html += `
    <div style="margin-top: 20px; padding: 16px; background: #f8f9fa; border-radius: 8px; display: flex; gap: 20px; justify-content: space-between;">
      <div><strong>📊 전체:</strong> ${totalCount}명</div>
      <div><strong style="color: #4caf50;">✅ 활성 구독:</strong> ${activeCount}명</div>
      <div><strong style="color: #ff9800;">⏰ 만료/취소:</strong> ${expiredCount}명</div>
      <div><strong style="color: #999;">📭 구독 없음:</strong> ${noneCount}명</div>
    </div>
  `;

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

function viewUser(user) {
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
      <div class="value">${new Date(user.created_at).toLocaleString('ko-KR')}</div>
    </div>
    <div class="user-detail-row">
      <div class="label">관리자 메모</div>
      <div class="value">${escapeHtml(user.admin_memo || '-')}</div>
    </div>
  `;

  container.innerHTML = html;
  openModal('userModal');
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
    // Convert days to months (rounded up)
    const months = Math.ceil(parseInt(days) / 30);

    await callAdminAPI('add_subscription', {
      userId: userId,
      plan: plan,
      months: months
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
  document.getElementById('memoText').value = currentMemo;
  openModal('memoModal');
}

async function handleUpdateMemo(e) {
  e.preventDefault();

  const userId = document.getElementById('memoUserId').value;
  const memo = document.getElementById('memoText').value.trim();

  try {
    await callAdminAPI('update_memo', {
      user_id: userId,
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

  try {
    await callAdminAPI('block_user', {
      user_id: userId,
      reason: reason
    });

    showSuccess('사용자가 차단되었습니다.');
    closeModal();
    await refreshData();
  } catch (error) {
    showError('차단 실패: ' + error.message);
  }
}

async function unblockUser(userId) {
  if (!confirm('이 사용자의 차단을 해제하시겠습니까?')) {
    return;
  }

  try {
    await callAdminAPI('unblock_user', {
      user_id: userId
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
    const result = await callAdminAPI('change_user_group', { userId, groupId });
    showSuccess(result.message || '사용자 그룹이 변경되었습니다.');
    loadUsers(); // 사용자 목록 새로고침
  } catch (error) {
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

  // 카카오 사용자면 username 비활성화
  const isKakao = user.auth_type === 'kakao';
  document.getElementById('editUsername').disabled = isKakao;
  document.getElementById('editPassword').disabled = isKakao;

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
    // 사용자 정보 업데이트
    if (username || nickname || email) {
      await callAdminAPI('update_user', {
        userId,
        username: username || undefined,
        nickname: nickname || undefined,
        email: email || undefined
      });
    }

    // 비밀번호 재설정 (입력된 경우만)
    if (newPassword) {
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
  // 배포 시각 설정 (DEPLOY_TIMESTAMP 플레이스홀더가 있으면 현재 시각으로 대체)
  const deployEl = document.getElementById('deployTime');
  if (deployEl && deployEl.textContent === 'DEPLOY_TIMESTAMP') {
    const now = new Date();
    const timeStr = now.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    deployEl.textContent = timeStr;
    deployEl.title = 'GitHub Pages 배포 시각 (최대 5분 소요)';
  }

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
