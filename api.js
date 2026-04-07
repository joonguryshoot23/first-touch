/* ===================================================
   First Touch — api.js (프론트엔드 ↔ 백엔드 연동)
   =================================================== */

const API_BASE = '/api';

/* ---------- 텍스트 이스케이프 (XSS 방지) ---------- */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Token 관리 ---------- */
function getToken() {
  return localStorage.getItem('ft_token');
}

function setToken(token) {
  localStorage.setItem('ft_token', token);
}

function removeToken() {
  localStorage.removeItem('ft_token');
  localStorage.removeItem('ft_user');
}

function getUser() {
  const raw = localStorage.getItem('ft_user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    removeToken();
    return null;
  }
}

function setUser(user) {
  localStorage.setItem('ft_user', JSON.stringify(user));
}

/* ---------- API 호출 헬퍼 ---------- */
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + endpoint, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || '요청에 실패했습니다.');
  }
  return data;
}

/* ---------- 회원가입 ---------- */
async function signup(name, email, phone, password) {
  const data = await apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, phone, password })
  });
  setToken(data.token);
  setUser(data.user);
  return data;
}

/* ---------- 로그인 ---------- */
async function login(email, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  setToken(data.token);
  setUser(data.user);
  return data;
}

/* ---------- 로그아웃 ---------- */
function logout() {
  removeToken();
  window.location.href = '/index.html';
}

/* ---------- 코치 등록 ---------- */
async function registerCoach(skills, region, bio) {
  return apiFetch('/coaches', {
    method: 'POST',
    body: JSON.stringify({ skills, region, bio })
  });
}

/* ---------- 구장 등록 ---------- */
async function registerVenue(venueData) {
  return apiFetch('/venues', {
    method: 'POST',
    body: JSON.stringify(venueData)
  });
}

/* ---------- 레슨 예약 ---------- */
async function createBooking(data) {
  return apiFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

async function getMyBookings() {
  return apiFetch('/bookings/my');
}

async function getCoachBookings() {
  return apiFetch('/bookings/coach');
}

async function respondToBooking(bookingId, action) {
  return apiFetch(`/bookings/${encodeURIComponent(bookingId)}/coach-respond`, {
    method: 'PATCH',
    body: JSON.stringify({ action })
  });
}

/* ---------- 알림 ---------- */
async function getNotifications() {
  return apiFetch('/notifications');
}

async function markAllNotificationsRead() {
  return apiFetch('/notifications/read-all', { method: 'PATCH' });
}

/* ---------- 네비게이션 UI 업데이트 ---------- */
function updateNavUI() {
  const user = getUser();
  const navActions = document.querySelector('.nav-actions');
  if (!navActions) return;

  if (user) {
    // Find and replace login/signup buttons
    const loginBtn = navActions.querySelector('a[href="login.html"]');
    const signupBtn = navActions.querySelector('a[href="login.html#signup"]');

    if (loginBtn) loginBtn.remove();
    if (signupBtn) signupBtn.remove();

    // Add admin tab in nav-links if admin (서버에서 검증하므로 UI만 표시)
    if (user.is_admin) {
      const navLinks = document.querySelector('.nav-links');
      if (navLinks && !navLinks.querySelector('a[href="admin.html"]')) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = 'admin.html';
        a.style.color = '#D97706';
        a.style.fontWeight = '600';
        a.textContent = '관리자';
        li.appendChild(a);
        navLinks.appendChild(li);
      }
    }

    // Check if user menu already exists
    if (!navActions.querySelector('.user-menu')) {
      // ── 유저 메뉴 (안전한 DOM 생성) ──
      const userMenu = document.createElement('div');
      userMenu.className = 'user-menu';

      const btn = document.createElement('button');
      btn.className = 'btn-user';

      const avatar = document.createElement('span');
      avatar.className = 'user-avatar-sm';
      avatar.textContent = user.name ? user.name.charAt(0) : '?';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'user-name-sm';
      nameSpan.textContent = user.name || '';

      btn.appendChild(avatar);
      btn.appendChild(nameSpan);

      const dropdown = document.createElement('div');
      dropdown.className = 'user-dropdown';

      const mypageLink = document.createElement('a');
      mypageLink.href = 'mypage.html';
      mypageLink.className = 'dropdown-item';
      mypageLink.textContent = '마이페이지';
      dropdown.appendChild(mypageLink);

      if (user.is_admin) {
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.className = 'dropdown-item';
        adminLink.textContent = '관리자 대시보드';
        dropdown.appendChild(adminLink);
      }

      const logoutLink = document.createElement('a');
      logoutLink.href = '#';
      logoutLink.className = 'dropdown-item';
      logoutLink.textContent = '로그아웃';
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
      });
      dropdown.appendChild(logoutLink);

      userMenu.appendChild(btn);
      userMenu.appendChild(dropdown);
      navActions.insertBefore(userMenu, navActions.firstChild);

      // ── 알림 벨 (안전한 DOM 생성) ──
      const bellWrap = document.createElement('div');
      bellWrap.className = 'notif-bell-wrap';

      const bellBtn = document.createElement('button');
      bellBtn.className = 'btn-notif-bell';
      bellBtn.title = '알림';
      bellBtn.textContent = '🔔 ';

      const badge = document.createElement('span');
      badge.className = 'notif-badge';
      badge.id = 'notif-badge';
      badge.style.display = 'none';
      badge.textContent = '0';
      bellBtn.appendChild(badge);

      const bellDropdown = document.createElement('div');
      bellDropdown.className = 'notif-dropdown';
      bellDropdown.id = 'notif-dropdown';

      const ddHeader = document.createElement('div');
      ddHeader.className = 'notif-dropdown-header';

      const ddTitle = document.createElement('span');
      ddTitle.textContent = '알림';
      ddHeader.appendChild(ddTitle);

      const readAllBtn = document.createElement('button');
      readAllBtn.className = 'notif-read-all';
      readAllBtn.textContent = '모두 읽음';
      readAllBtn.addEventListener('click', markAllRead);
      ddHeader.appendChild(readAllBtn);

      bellDropdown.appendChild(ddHeader);

      const notifList = document.createElement('div');
      notifList.className = 'notif-list';
      notifList.id = 'notif-list';

      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'empty-state';
      emptyMsg.style.padding = '24px';
      emptyMsg.style.fontSize = '0.8rem';
      emptyMsg.textContent = '알림이 없습니다.';
      notifList.appendChild(emptyMsg);

      bellDropdown.appendChild(notifList);
      bellWrap.appendChild(bellBtn);
      bellWrap.appendChild(bellDropdown);
      navActions.insertBefore(bellWrap, userMenu);

      // Toggle bell dropdown
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bellDropdown.classList.toggle('show');
        if (bellDropdown.classList.contains('show')) loadNotifications();
      });

      // Toggle user dropdown
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        bellDropdown.classList.remove('show');
      });
      document.addEventListener('click', () => {
        dropdown.classList.remove('show');
        bellDropdown.classList.remove('show');
      });

      // Load notification count
      loadNotifCount();
    }
  }
}

/* ---------- 알림 UI 헬퍼 ---------- */
async function loadNotifCount() {
  try {
    const { unread } = await getNotifications();
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (unread > 0) {
        badge.textContent = unread > 99 ? '99+' : unread;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch (e) { /* ignore */ }
}

async function loadNotifications() {
  try {
    const { notifications } = await getNotifications();
    const list = document.getElementById('notif-list');
    if (!list) return;

    list.innerHTML = '';

    if (notifications.length === 0) {
      const empty = document.createElement('div');
      empty.style.padding = '24px';
      empty.style.textAlign = 'center';
      empty.style.fontSize = '0.8rem';
      empty.style.color = '#9CA3AF';
      empty.textContent = '알림이 없습니다.';
      list.appendChild(empty);
      return;
    }

    notifications.slice(0, 20).forEach(n => {
      const item = document.createElement('div');
      item.className = 'notif-item' + (n.is_read ? '' : ' unread');

      const title = document.createElement('div');
      title.className = 'notif-title';
      title.textContent = n.title;

      const msg = document.createElement('div');
      msg.className = 'notif-msg';
      msg.textContent = n.message;

      const time = document.createElement('div');
      time.className = 'notif-time';
      time.textContent = timeAgo(n.created_at);

      item.appendChild(title);
      item.appendChild(msg);
      item.appendChild(time);
      list.appendChild(item);
    });
  } catch (e) { /* ignore */ }
}

async function markAllRead() {
  try {
    await markAllNotificationsRead();
    loadNotifCount();
    loadNotifications();
  } catch (e) { /* ignore */ }
}

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

// Run on every page load
document.addEventListener('DOMContentLoaded', updateNavUI);
