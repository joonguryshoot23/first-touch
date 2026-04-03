/* ===================================================
   퍼스트 터치 — app.js
   =================================================== */

/* ---------- Category Filter (index.html) ---------- */
const catBtns = document.querySelectorAll('.cat-btn');
const coachCards = document.querySelectorAll('.coach-card');

catBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    catBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const cat = btn.dataset.cat;
    let visible = 0;
    coachCards.forEach(card => {
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

/* ---------- Plan selection ---------- */
const planOptions = document.querySelectorAll('.plan-option');
const planPrices     = { trial: 65000, monthly: 440000, camp: 260000 };
const planLesson     = { trial: 50000, monthly: 320000, camp: 200000 };
const planVenue      = { trial: 15000, monthly: 120000, camp: 60000 };
const planNames      = { trial: '체험 레슨 (60분)', monthly: '정기 패키지 8회', camp: '집중 캠프 4회' };
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

/* ---------- Calendar ---------- */
const calGrid   = document.getElementById('cal-grid');
const calTitle  = document.getElementById('cal-title');
const calPrev   = document.getElementById('cal-prev');
const calNext   = document.getElementById('cal-next');

if (calGrid) {
  const today = new Date();
  let viewYear  = today.getFullYear();
  let viewMonth = today.getMonth();

  let selectedDate  = null;
  let selectedTime  = null;

  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const DAYS   = ['일','월','화','수','목','금','토'];

  function renderCalendar() {
    calTitle.textContent = `${viewYear}년 ${MONTHS[viewMonth]}`;

    const children = Array.from(calGrid.children);
    children.slice(7).forEach(c => c.remove());

    const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());

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

      el.className = 'cal-day' + (isPast ? ' past' : ' available') + (isToday ? ' today' : '') + (isSel ? ' selected' : '');
      el.textContent = d;

      if (!isPast) {
        el.addEventListener('click', () => {
          selectedDate  = new Date(viewYear, viewMonth, d);
          selectedTime  = null;
          renderCalendar();
          document.getElementById('time-section').classList.add('show');
          document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
          // Hide venue section until time is selected
          const venueSection = document.getElementById('venue-section');
          if (venueSection) venueSection.classList.remove('show');
          updateSummary();
          updateBookBtn();
        });
      }

      calGrid.appendChild(el);
    }
  }

  /* Time slots */
  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      if (slot.classList.contains('full')) return;
      document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      selectedTime = slot.dataset.time;
      // Show venue assigned info
      const venueSection = document.getElementById('venue-section');
      if (venueSection) venueSection.classList.add('show');
      updateSummary();
      updateBookBtn();
    });
  });

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

    if (sumLesson) sumLesson.textContent = `₩${planLesson[selectedPlan].toLocaleString()}`;
    if (sumVenueFee) sumVenueFee.textContent = `₩${planVenue[selectedPlan].toLocaleString()}`;

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
    btn.innerHTML = `⚽ 레슨 예약하기 · ₩${total.toLocaleString()} (구장·기구 포함)`;
  }

  const bookBtn = document.getElementById('btn-book');
  if (bookBtn) {
    bookBtn.addEventListener('click', async () => {
      if (bookBtn.disabled) return;

      // Check login
      if (typeof getToken === 'function' && !getToken()) {
        alert('레슨을 예약하려면 먼저 로그인해주세요.');
        window.location.href = '/login.html';
        return;
      }

      const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth()+1).padStart(2,'0')}-${String(selectedDate.getDate()).padStart(2,'0')}`;

      bookBtn.disabled = true;
      bookBtn.textContent = '예약 중...';

      try {
        if (typeof createBooking === 'function') {
          await createBooking({
            coach_id: 1, // TODO: dynamic coach ID
            plan_type: selectedPlan,
            lesson_date: dateStr,
            lesson_time: selectedTime,
            lesson_price: planLesson[selectedPlan],
            venue_price: planVenue[selectedPlan]
          });
        }
        alert(`✅ 레슨 요청이 완료되었습니다!\n\n레슨: ${planNames[selectedPlan]}\n레슨비: ₩${planLesson[selectedPlan].toLocaleString()}\n구장·기구: ₩${planVenue[selectedPlan].toLocaleString()}\n합계: ₩${planPrices[selectedPlan].toLocaleString()}\n일시: ${dateStr} ${selectedTime}\n\n코치 확인 후 구장 배정과 함께 최종 확정 안내드립니다.`);
        window.location.href = '/mypage.html#bookings';
      } catch (err) {
        alert('예약 실패: ' + err.message);
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
