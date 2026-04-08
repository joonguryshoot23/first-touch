/* ===================================================
   퍼스트 터치 — app.js
   =================================================== */

/* ---------- 스킬 아이콘 매핑 ---------- */
const SKILL_ICONS = {
  '슈팅': '🎯', '드리블': '⚡', '수비': '🛡️', '골키퍼': '🧤',
  '패싱': '🔁', '전술': '🔁', '피지컬': '💪', '유소년': '👦'
};

const AVATAR_COLORS = [
  'linear-gradient(135deg,#00C853,#B9F6CA)',
  'linear-gradient(135deg,#FF6B35,#F7C59F)',
  'linear-gradient(135deg,#7B2FBE,#C77DFF)',
  'linear-gradient(135deg,#FF4D8D,#FFB3C9)',
  'linear-gradient(135deg,#0077B6,#90E0EF)',
  'linear-gradient(135deg,#F9A825,#FFE082)',
];

/* ========== INDEX.HTML: 코치 목록 동적 로딩 ========== */
const coachesGrid = document.getElementById('coaches-grid');

if (coachesGrid) {
  loadCoachList();

  // 검색 버튼
  const searchBtn = document.getElementById('search-btn');
  const regionFilter = document.getElementById('region-filter');
  if (searchBtn) {
    searchBtn.addEventListener('click', () => loadCoachList(regionFilter?.value));
  }
  if (regionFilter) {
    regionFilter.addEventListener('change', () => loadCoachList(regionFilter.value));
  }
}

async function loadCoachList(region) {
  const grid = document.getElementById('coaches-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1;padding:48px;text-align:center;color:#9CA3AF;">코치 목록을 불러오는 중...</div>';

  try {
    const { coaches } = await getCoachList(region);
    const countEl = document.getElementById('listing-count');

    if (coaches.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;padding:48px;text-align:center;color:#9CA3AF;">등록된 코치가 없습니다.</div>';
      if (countEl) countEl.innerHTML = '총 <strong>0명</strong>의 코치';
      return;
    }

    if (countEl) countEl.innerHTML = `총 <strong>${coaches.length}명</strong>의 코치가 활동 중입니다`;

    grid.innerHTML = coaches.map((c, i) => {
      const skills = c.skills.split(',').map(s => s.trim());
      const skillTags = skills.map(s => {
        const icon = SKILL_ICONS[s] || '⚽';
        return `<span class="tag">${icon} ${escapeHtml(s)}</span>`;
      }).join('');
      const avatar = c.name.charAt(0);
      const bg = AVATAR_COLORS[i % AVATAR_COLORS.length];
      const price = c.trial_price || 65000;

      return `
        <div class="coach-card" data-cats="${skills.join(' ')}" onclick="location.href='coach.html?id=${c.id}'">
          <div class="coach-card-img">
            <div class="coach-avatar" style="background:${bg};">${escapeHtml(avatar)}</div>
            <span class="coach-badge">VERIFIED</span>
          </div>
          <div class="coach-card-body">
            <div class="coach-name">${escapeHtml(c.name)}</div>
            <div class="coach-location">📍 ${escapeHtml(c.region)}</div>
            <div class="coach-specialty">${skillTags}</div>
            <div class="coach-intro">${c.bio ? '"' + escapeHtml(c.bio) + '"' : ''}</div>
            <div class="coach-price-row">
              <div class="coach-price">
                <span class="price-total">₩${price.toLocaleString()}</span> <small>/ ${c.lesson_duration || 60}분</small>
              </div>
              <button class="btn-sm" onclick="event.stopPropagation(); location.href='coach.html?id=${c.id}'">프로필 보기</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:48px;text-align:center;color:#DC2626;">코치 목록을 불러올 수 없습니다.</div>';
  }
}

/* ---------- Category Filter (index.html) ---------- */
const catBtns = document.querySelectorAll('.cat-btn');
catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const cat = btn.dataset.cat;
    const cards = document.querySelectorAll('.coach-card');
    let visible = 0;
    cards.forEach(card => {
      if (cat === 'all') {
        card.style.display = '';
        visible++;
      } else {
        const cats = (card.dataset.cats || '').split(' ');
        const show = cats.includes(cat);
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      }
    });

    const countEl = document.getElementById('listing-count');
    if (countEl) {
      const catName = btn.textContent.trim();
      countEl.innerHTML = `총 <strong>${visible}명</strong>의 코치 ${cat === 'all' ? '가 활동 중입니다' : `(${catName})가 있습니다`}`;
    }
  });
});

/* ---------- Community board tabs ---------- */
const commTabs = document.querySelectorAll('.comm-tab');
const postItems = document.querySelectorAll('.post-item');

commTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    commTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const board = tab.dataset.board;
    let count = 0;
    postItems.forEach(post => {
      const show = board === 'all' || post.dataset.board === board;
      post.style.display = show ? '' : 'none';
      if (show) count++;
    });
    const countEl = document.getElementById('comm-count');
    if (countEl) countEl.innerHTML = `<strong>${count}개</strong>의 게시글`;
  });
});

/* ---------- How it works tabs (index.html) ---------- */
document.querySelectorAll('.how-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.how-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.how-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('how-' + btn.dataset.who + '-panel');
    if (panel) panel.classList.add('active');
  });
});

/* ---------- Detail Page Tabs (coach.html) ---------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
  });
});

/* ========== COACH.HTML: 동적 코치 프로필 + 예약 ========== */
const calGrid   = document.getElementById('cal-grid');
const calTitle  = document.getElementById('cal-title');
const calPrev   = document.getElementById('cal-prev');
const calNext   = document.getElementById('cal-next');

// URL 파라미터에서 코치 ID 가져오기
const urlParams = new URLSearchParams(window.location.search);
const coachId = urlParams.get('id') ? parseInt(urlParams.get('id')) : null;

// 코치 데이터 (API로 로드)
let coachData = null;
let coachSchedules = [];

/* Plan selection */
const planOptions = document.querySelectorAll('.plan-option');
let planPrices  = { trial: 65000, monthly: 440000, camp: 260000 };
let planNames   = { trial: '체험 레슨 (60분)', monthly: '정기 패키지 8회', camp: '집중 캠프 4회' };
let selectedPlan = 'trial';

planOptions.forEach(opt => {
  opt.addEventListener('click', () => {
    planOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    const radio = opt.querySelector('input[type=radio]');
    if (radio) { radio.checked = true; selectedPlan = radio.value; }
    updateSummary();
    updateBookBtn();
  });
});

/* ---------- 코치 상세 로딩 ---------- */
if (coachId && document.querySelector('.coach-profile-header')) {
  loadCoachDetail();
}

async function loadCoachDetail() {
  try {
    const { coach, schedules } = await getCoachDetail(coachId);
    coachData = coach;
    coachSchedules = schedules;

    // 프로필 헤더 업데이트
    const avatar = document.querySelector('.coach-avatar-lg');
    if (avatar) avatar.textContent = coach.name.charAt(0);

    const h1 = document.querySelector('.coach-info h1');
    if (h1) h1.textContent = coach.name;

    const subtitle = document.querySelector('.coach-info .subtitle');
    if (subtitle) {
      const skills = coach.skills.split(',').map(s => s.trim()).join(' · ');
      subtitle.textContent = `⚽ ${skills} 전문 코치  |  📍 ${coach.region}`;
    }

    // 스킬 태그
    const tagsEl = document.querySelector('.coach-tags');
    if (tagsEl) {
      tagsEl.innerHTML = coach.skills.split(',').map(s => {
        const skill = s.trim();
        const icon = SKILL_ICONS[skill] || '⚽';
        return `<span class="tag">${icon} ${escapeHtml(skill)}</span>`;
      }).join('');
    }

    // 제목 업데이트
    document.title = `${coach.name} 코치 프로필 — First Touch`;

    // breadcrumb
    const breadcrumb = document.querySelector('.detail-hero')?.previousElementSibling;
    if (breadcrumb) {
      const span = breadcrumb.querySelector('span[style*="text-secondary"]');
      if (span) span.textContent = `${coach.name} 코치`;
    }

    // 가격 업데이트
    planPrices = {
      trial: coach.trial_price || 65000,
      monthly: coach.monthly_price || 440000,
      camp: coach.camp_price || 260000
    };

    // 가격 UI 업데이트
    const priceDisplay = document.querySelector('.price-display');
    if (priceDisplay) priceDisplay.innerHTML = `₩${planPrices.trial.toLocaleString()} <small>/ ${coach.lesson_duration || 60}분부터</small>`;

    const priceSplit = document.querySelector('.price-split-info');
    if (priceSplit) priceSplit.textContent = `체험 레슨 ₩${planPrices.trial.toLocaleString()} (구장·기구 포함)`;

    // 플랜 옵션 가격 업데이트
    const trialOpt = document.getElementById('plan-trial');
    const monthlyOpt = document.getElementById('plan-monthly');
    const campOpt = document.getElementById('plan-camp');
    if (trialOpt) {
      const price = trialOpt.querySelector('.plan-option-price');
      if (price) price.textContent = `₩${planPrices.trial.toLocaleString()}`;
    }
    if (monthlyOpt) {
      const price = monthlyOpt.querySelector('.plan-option-price');
      if (price) price.textContent = `₩${planPrices.monthly.toLocaleString()}`;
    }
    if (campOpt) {
      const price = campOpt.querySelector('.plan-option-price');
      if (price) price.textContent = `₩${planPrices.camp.toLocaleString()}`;
    }

    updateSummary();
    updateBookBtn();
  } catch (err) {
    console.error('Failed to load coach:', err);
    const header = document.querySelector('.coach-profile-header');
    if (header) header.innerHTML = '<div style="padding:20px;color:#DC2626;">코치 정보를 불러올 수 없습니다.</div>';
  }
}

/* ---------- Calendar ---------- */
if (calGrid) {
  const today = new Date();
  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();

  let selectedDate  = null;
  let selectedTime  = null;

  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const DAYS   = ['일','월','화','수','목','금','토'];

  // 코치 스케줄에서 활성 요일 가져오기
  function getActiveDays() {
    return coachSchedules.map(s => s.day_of_week);
  }

  function renderCalendar() {
    calTitle.textContent = `${viewYear}년 ${MONTHS[viewMonth]}`;

    const children = Array.from(calGrid.children);
    children.slice(7).forEach(c => c.remove());

    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const activeDays = getActiveDays();

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'cal-day empty';
      calGrid.appendChild(el);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const el   = document.createElement('div');
      const date = new Date(viewYear, viewMonth, d);
      const isPast   = date < todayMidnight;
      const isToday  = date.getTime() === todayMidnight.getTime();
      const isSel    = selectedDate && date.getTime() === selectedDate.getTime();
      const dayOfWeek = date.getDay();
      const hasSchedule = activeDays.length === 0 || activeDays.includes(dayOfWeek);
      const isAvailable = !isPast && hasSchedule;

      el.className = 'cal-day' + (isPast || !hasSchedule ? ' past' : ' available') + (isToday ? ' today' : '') + (isSel ? ' selected' : '');
      el.textContent = d;

      if (isAvailable) {
        el.addEventListener('click', () => {
          selectedDate  = new Date(viewYear, viewMonth, d);
          selectedTime  = null;
          renderCalendar();
          loadTimeSlots();
          const venueSection = document.getElementById('venue-section');
          if (venueSection) venueSection.classList.remove('show');
          updateSummary();
          updateBookBtn();
        });
      }

      calGrid.appendChild(el);
    }
  }

  /* 시간 슬롯 동적 로딩 */
  async function loadTimeSlots() {
    const timeSection = document.getElementById('time-section');
    if (!timeSection) return;
    timeSection.classList.add('show');

    const timeGrid = timeSection.querySelector('.time-grid');
    if (!timeGrid) return;
    timeGrid.innerHTML = '<div style="padding:12px;text-align:center;color:#9CA3AF;font-size:0.82rem;">시간 조회 중...</div>';

    if (!coachId || !selectedDate) return;

    const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;

    try {
      const { slots } = await getAvailableSlots(coachId, dateStr);

      if (slots.length === 0) {
        timeGrid.innerHTML = '<div style="padding:12px;text-align:center;color:#9CA3AF;font-size:0.82rem;">예약 가능한 시간이 없습니다.</div>';
        return;
      }

      timeGrid.innerHTML = slots.map(s => `<div class="time-slot" data-time="${s}">${s}</div>`).join('');

      // 시간 슬롯 클릭 이벤트
      timeGrid.querySelectorAll('.time-slot').forEach(slot => {
        slot.addEventListener('click', () => {
          if (slot.classList.contains('full')) return;
          timeGrid.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
          slot.classList.add('selected');
          selectedTime = slot.dataset.time;
          const venueSection = document.getElementById('venue-section');
          if (venueSection) venueSection.classList.add('show');
          updateSummary();
          updateBookBtn();
        });
      });
    } catch (err) {
      timeGrid.innerHTML = '<div style="padding:12px;text-align:center;color:#DC2626;font-size:0.82rem;">시간 조회 실패</div>';
    }
  }

  /* Summary */
  function updateSummary() {
    const summary = document.getElementById('booking-summary');
    if (!summary) return;
    summary.classList.add('show');

    const sumLesson   = document.getElementById('summary-lesson');
    const sumVenueFee = document.getElementById('summary-venue-fee');
    const sumDate     = document.getElementById('summary-date');
    const sumDateRow  = document.getElementById('summary-date-row');
    const sumTotal    = document.getElementById('summary-total');

    if (sumLesson) sumLesson.textContent = `₩${planPrices[selectedPlan].toLocaleString()}`;
    if (sumVenueFee) sumVenueFee.textContent = '포함';

    if (selectedDate && selectedTime) {
      if (sumDate) sumDate.textContent = `${selectedDate.getMonth()+1}월 ${selectedDate.getDate()}일 (${DAYS[selectedDate.getDay()]}) ${selectedTime}`;
      if (sumDateRow) sumDateRow.style.display = '';
    } else {
      if (sumDateRow) sumDateRow.style.display = 'none';
    }

    const total = planPrices[selectedPlan];
    if (sumTotal) sumTotal.textContent = `₩${total.toLocaleString()}`;
  }

  /* Book Button */
  function updateBookBtn() {
    const btn = document.getElementById('btn-book');
    if (!btn) return;

    if (!selectedDate) {
      btn.disabled = true; btn.textContent = '날짜를 선택해주세요'; return;
    }
    if (!selectedTime) {
      btn.disabled = true; btn.textContent = '시간을 선택해주세요'; return;
    }
    const total = planPrices[selectedPlan];
    btn.disabled = false;
    btn.innerHTML = `⚽ 레슨 예약하기 · ₩${total.toLocaleString()}`;
  }

  const bookBtn = document.getElementById('btn-book');
  if (bookBtn) {
    bookBtn.addEventListener('click', async () => {
      if (bookBtn.disabled) return;

      if (typeof getToken === 'function' && !getToken()) {
        alert('레슨을 예약하려면 먼저 로그인해주세요.');
        window.location.href = '/login.html';
        return;
      }

      if (!coachId) {
        alert('코치 정보를 불러올 수 없습니다.');
        return;
      }

      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;

      bookBtn.disabled = true;
      bookBtn.textContent = '예약 중...';

      try {
        if (typeof createBooking === 'function') {
          const result = await createBooking({
            coach_id: coachId,
            plan_type: selectedPlan,
            lesson_date: dateStr,
            lesson_time: selectedTime
          });

          const venueMsg = result.booking.venue_name
            ? `\n구장: ${result.booking.venue_name}`
            : '\n구장은 곧 배정됩니다.';

          alert(`✅ 예약이 확정되었습니다!\n\n레슨: ${planNames[selectedPlan]}\n합계: ₩${planPrices[selectedPlan].toLocaleString()}\n일시: ${dateStr} ${selectedTime}${venueMsg}`);
          window.location.href = '/mypage.html#bookings';
        }
      } catch (err) {
        if (err.message.includes('이미 예약')) {
          alert('이미 예약된 시간입니다. 다른 시간을 선택해주세요.');
        } else {
          alert('예약 실패: ' + err.message);
        }
        updateBookBtn();
      }
    });
  }

  calPrev.addEventListener('click', () => {
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCalendar();
  });
  calNext.addEventListener('click', () => {
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCalendar();
  });

  renderCalendar();
  updateSummary();
  updateBookBtn();
}
