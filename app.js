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
const planPrices = { trial: 65000, monthly: 440000, camp: 260000 };
const planNames  = { trial: '체험 레슨 (60분)', monthly: '정기 패키지 8회', camp: '집중 캠프 4회' };
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
  let selectedVenue = null;
  let venuePrice    = 0;

  const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
  const DAYS   = ['일','월','화','수','목','금','토'];

  function renderCalendar() {
    calTitle.textContent = `${viewYear}년 ${MONTHS[viewMonth]}`;

    // Remove old day cells only (keep DOW headers — first 7 children)
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
          selectedVenue = null;
          venuePrice    = 0;
          renderCalendar();
          document.getElementById('time-section').classList.add('show');
          document.getElementById('venue-section').classList.remove('show');
          document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
          resetVenueUI();
          updateSummary();
          updateBookBtn();
        });
      }

      calGrid.appendChild(el);
    }
  }

  function resetVenueUI() {
    document.querySelectorAll('.venue-option').forEach(v => {
      v.classList.remove('selected');
      const r = v.querySelector('input'); if (r) r.checked = false;
    });
    selectedVenue = null;
    venuePrice    = 0;
  }

  /* Time slots */
  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      if (slot.classList.contains('full')) return;
      document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('selected'));
      slot.classList.add('selected');
      selectedTime = slot.dataset.time;
      document.getElementById('venue-section').classList.add('show');
      updateSummary();
      updateBookBtn();
    });
  });

  /* Venue selection */
  const venuePrices = { v1: 20000, v2: 30000, v3: 40000 };
  const venueNames  = { v1: '강남 풋살파크 A구장', v2: '역삼 스포츠센터 풋살장', v3: '잠실 드림 풋볼파크' };

  document.querySelectorAll('.venue-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.venue-option').forEach(v => v.classList.remove('selected'));
      opt.classList.add('selected');
      const radio = opt.querySelector('input[type=radio]');
      if (radio) {
        radio.checked = true;
        selectedVenue = radio.value;
        venuePrice    = venuePrices[selectedVenue] || 0;
      }
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
    const sumDate     = document.getElementById('summary-date');
    const sumDateRow  = document.getElementById('summary-date-row');
    const sumVenue    = document.getElementById('summary-venue');
    const sumVenueRow = document.getElementById('summary-venue-row');
    const sumTotal    = document.getElementById('summary-total');

    if (sumLesson) sumLesson.textContent = `${planNames[selectedPlan]} · ₩${planPrices[selectedPlan].toLocaleString()}`;

    if (selectedDate && selectedTime) {
      if (sumDate) sumDate.textContent = `${selectedDate.getMonth()+1}월 ${selectedDate.getDate()}일 (${DAYS[selectedDate.getDay()]}) ${selectedTime}`;
      if (sumDateRow) sumDateRow.style.display = '';
    } else {
      if (sumDateRow) sumDateRow.style.display = 'none';
    }

    if (selectedVenue) {
      if (sumVenue) sumVenue.textContent = `${venueNames[selectedVenue]} · +₩${venuePrice.toLocaleString()}`;
      if (sumVenueRow) sumVenueRow.style.display = '';
    } else {
      if (sumVenueRow) sumVenueRow.style.display = 'none';
    }

    const total = planPrices[selectedPlan] + venuePrice;
    if (sumTotal) sumTotal.textContent = `₩${total.toLocaleString()}`;
  }

  /* Book Button */
  function updateBookBtn() {
    const btn = document.getElementById('btn-book');
    if (!btn) return;

    if (!selectedDate) {
      btn.disabled = true; btn.textContent = '날짜를 선택해주세요'; btn.classList.remove('integrated'); return;
    }
    if (!selectedTime) {
      btn.disabled = true; btn.textContent = '시간을 선택해주세요'; btn.classList.remove('integrated'); return;
    }
    if (!selectedVenue) {
      btn.disabled = false; btn.textContent = '레슨 요청하기'; btn.classList.remove('integrated'); return;
    }
    const total = planPrices[selectedPlan] + venuePrice;
    btn.disabled = false;
    btn.innerHTML = `⚽ 레슨 + 구장 통합 결제 · ₩${total.toLocaleString()}`;
    btn.classList.add('integrated');
  }

  const bookBtn = document.getElementById('btn-book');
  if (bookBtn) {
    bookBtn.addEventListener('click', () => {
      if (bookBtn.disabled) return;
      const isIntegrated = selectedVenue !== null;
      const total = planPrices[selectedPlan] + venuePrice;
      if (isIntegrated) {
        alert(`✅ 예약이 완료되었습니다!\n\n레슨: ${planNames[selectedPlan]}\n일시: ${selectedDate.getMonth()+1}월 ${selectedDate.getDate()}일 ${selectedTime}\n구장: ${venueNames[selectedVenue]}\n합계: ₩${total.toLocaleString()}\n\n결제 페이지로 이동합니다.`);
      } else {
        alert(`✅ 레슨 요청이 완료되었습니다!\n\n레슨: ${planNames[selectedPlan]}\n일시: ${selectedDate.getMonth()+1}월 ${selectedDate.getDate()}일 ${selectedTime}\n\n코치 확인 후 매칭이 확정됩니다.`);
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
