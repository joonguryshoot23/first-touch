/* ===================================================
   First Touch — api.js (프론트엔드 ↔ 백엔드 연동)
   =================================================== */

const API_BASE = '/api';

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
  return raw ? JSON.parse(raw) : null;
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
  return apiFetch(`/bookings/${bookingId}/coach-respond`, {
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

    // Add admin tab in nav-links if admin
    if (user.is_admin) {
      const navLinks = document.querySelector('.nav-links');
      if (navLinks && !navLinks.querySelector('a[href="admin.html"]')) {
        const li = document.createElement('li');
        li.innerHTML = '<a href="admin.html" style="color:#D97706;font-weight:600;">관리자</a>';
        navLinks.appendChild(li);
      }
    }

    // Check if user menu already exists
    if (!navActions.querySelector('.user-menu')) {
      const userMenu = document.createElement('div');
      userMenu.className = 'user-menu';
      userMenu.innerHTML = `
        <button class="btn-user">
          <span class="user-avatar-sm">${user.name.charAt(0)}</span>
          <span class="user-name-sm">${user.name}</span>
        </button>
        <div class="user-dropdown">
          <a href="mypage.html" class="dropdown-item">마이페이지</a>
          ${user.is_admin ? '<a href="admin.html" class="dropdown-item">관리자 대시보드</a>' : ''}
          <a href="#" class="dropdown-item" onclick="logout(); return false;">로그아웃</a>
        </div>
      `;
      navActions.insertBefore(userMenu, navActions.firstChild);

      // Add notification bell before user menu
      const bellWrap = document.createElement('div');
      bellWrap.className = 'notif-bell-wrap';
      bellWrap.innerHTML = `
        <button class="btn-notif-bell" title="알림">🔔 <span class="notif-badge" id="notif-badge" style="display:none;">0</span></button>
        <div class="notif-dropdown" id="notif-dropdown">
          <div class="notif-dropdown-header">
            <span>알림</span>
            <button class="notif-read-all" onclick="markAllRead()">모두 읽음</button>
          </div>
          <div class="notif-list" id="notif-list"><div class="empty-state" style="padding:24px;font-size:0.8rem;">알림이 없습니다.</div></div>
        </div>
      `;
      navActions.insertBefore(bellWrap, userMenu);

      // Toggle bell dropdown
      const bellBtn = bellWrap.querySelector('.btn-notif-bell');
      const bellDropdown = bellWrap.querySelector('.notif-dropdown');
      bellBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        bellDropdown.classList.toggle('show');
        if (bellDropdown.classList.contains('show')) loadNotifications();
      });

      // Toggle user dropdown
      const btn = userMenu.querySelector('.btn-user');
      const dropdown = userMenu.querySelector('.user-dropdown');
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
    if (notifications.length === 0) {
      list.innerHTML = '<div style="padding:24px;text-align:center;font-size:0.8rem;color:#9CA3AF;">알림이 없습니다.</div>';
      return;
    }
    list.innerHTML = notifications.slice(0, 20).map(n => `
      <div class="notif-item ${n.is_read ? '' : 'unread'}">
        <div class="notif-title">${n.title}</div>
        <div class="notif-msg">${n.message}</div>
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
    `).join('');
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
