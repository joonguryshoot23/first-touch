const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('./notifications');

const router = express.Router();

/* ===== POST /api/bookings — 수강생이 레슨 예약 요청 ===== */
router.post('/', authenticateToken, (req, res) => {
  try {
    const { coach_id, plan_type, lesson_date, lesson_time, lesson_price, venue_price } = req.body;

    if (!coach_id || !plan_type || !lesson_date || !lesson_time) {
      return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
    }

    // plan_type 검증
    if (!['trial', 'monthly', 'camp'].includes(plan_type)) {
      return res.status(400).json({ error: '유효하지 않은 레슨 플랜입니다.' });
    }

    // 날짜 형식 검증 (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lesson_date)) {
      return res.status(400).json({ error: '올바른 날짜 형식을 입력해주세요.' });
    }

    // 과거 날짜 차단
    const today = new Date().toISOString().split('T')[0];
    if (lesson_date < today) {
      return res.status(400).json({ error: '과거 날짜에는 예약할 수 없습니다.' });
    }

    // 코치 존재 확인
    const coach = db.prepare("SELECT id, user_id, region FROM coaches WHERE id = ? AND status = 'approved'").get(coach_id);
    if (!coach) {
      return res.status(404).json({ error: '승인된 코치를 찾을 수 없습니다.' });
    }

    // 같은 코치·같은 날짜·같은 시간 중복 예약 차단
    const conflict = db.prepare(`
      SELECT COUNT(*) as count FROM bookings
      WHERE coach_id = ? AND lesson_date = ? AND lesson_time = ?
      AND status IN ('pending', 'coach_accepted', 'confirmed')
    `).get(coach_id, lesson_date, lesson_time);
    if (conflict.count > 0) {
      return res.status(409).json({ error: '해당 시간에 이미 예약이 있습니다. 다른 시간을 선택해주세요.' });
    }

    const total_price = (lesson_price || 0) + (venue_price || 0);

    const result = db.prepare(`
      INSERT INTO bookings (student_id, coach_id, plan_type, lesson_date, lesson_time, lesson_price, venue_price, total_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, coach_id, plan_type, lesson_date, lesson_time, lesson_price || 0, venue_price || 0, total_price);

    const bookingId = result.lastInsertRowid;

    // Get coach user_id for notification
    const student = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const planLabel = { trial: '체험 레슨', monthly: '정기 패키지 8회', camp: '집중 캠프 4회' }[plan_type] || plan_type;

    // Notify coach
    sendNotification(
      coach.user_id,
      'booking_request',
      '새로운 레슨 요청',
      `${student.name}님이 ${planLabel} 레슨을 요청했습니다. (${lesson_date} ${lesson_time})`,
      bookingId
    );

    // Notify all admins
    const admins = db.prepare('SELECT id FROM users WHERE is_admin = 1').all();
    admins.forEach(admin => {
      sendNotification(
        admin.id,
        'booking_new',
        '새로운 예약 접수',
        `${student.name}님 → 코치ID ${coach_id} | ${planLabel} | ${lesson_date} ${lesson_time} | ₩${total_price.toLocaleString()}`,
        bookingId
      );
    });

    res.status(201).json({
      message: '레슨 요청이 완료되었습니다. 코치 확인 후 안내드리겠습니다.',
      booking: { id: bookingId, status: 'pending' }
    });
  } catch (err) {
    console.error('Booking create error:', err.message);
    res.status(500).json({ error: '예약 요청 중 오류가 발생했습니다.' });
  }
});

/* ===== GET /api/bookings/my — 내 예약 목록 (수강생) ===== */
router.get('/my', authenticateToken, (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*,
             u_coach.name as coach_name,
             c.skills as coach_skills,
             v.name as venue_name, v.address as venue_address
      FROM bookings b
      JOIN coaches c ON b.coach_id = c.id
      JOIN users u_coach ON c.user_id = u_coach.id
      LEFT JOIN venues v ON b.venue_id = v.id
      WHERE b.student_id = ?
      ORDER BY b.created_at DESC
    `).all(req.user.id);

    res.json({ bookings });
  } catch (err) {
    console.error('My bookings error:', err.message);
    res.status(500).json({ error: '예약 목록 조회 중 오류가 발생했습니다.' });
  }
});

/* ===== GET /api/bookings/coach — 코치에게 들어온 예약 ===== */
router.get('/coach', authenticateToken, (req, res) => {
  try {
    const coach = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(req.user.id);
    if (!coach) return res.json({ bookings: [] });

    const bookings = db.prepare(`
      SELECT b.*,
             u_student.name as student_name, u_student.phone as student_phone,
             v.name as venue_name, v.address as venue_address
      FROM bookings b
      JOIN users u_student ON b.student_id = u_student.id
      LEFT JOIN venues v ON b.venue_id = v.id
      WHERE b.coach_id = ?
      ORDER BY b.created_at DESC
    `).all(coach.id);

    res.json({ bookings });
  } catch (err) {
    console.error('Coach bookings error:', err.message);
    res.status(500).json({ error: '예약 목록 조회 중 오류가 발생했습니다.' });
  }
});

/* ===== PATCH /api/bookings/:id/coach-respond — 코치가 수락/거절 ===== */
router.patch('/:id/coach-respond', authenticateToken, (req, res) => {
  try {
    const { action } = req.body; // 'accept' or 'reject'
    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: '유효하지 않은 응답입니다.' });
    }

    const coach = db.prepare('SELECT id FROM coaches WHERE user_id = ?').get(req.user.id);
    if (!coach) return res.status(403).json({ error: '코치 권한이 없습니다.' });

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ? AND coach_id = ?').get(req.params.id, coach.id);
    if (!booking) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (booking.status !== 'pending') return res.status(400).json({ error: '이미 처리된 예약입니다.' });

    const newStatus = action === 'accept' ? 'coach_accepted' : 'rejected';
    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(newStatus, req.params.id);

    const student = db.prepare('SELECT name FROM users WHERE id = ?').get(booking.student_id);
    const coachUser = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const planLabel = { trial: '체험 레슨', monthly: '정기 패키지 8회', camp: '집중 캠프 4회' }[booking.plan_type] || booking.plan_type;

    if (action === 'accept') {
      // Notify student
      sendNotification(
        booking.student_id,
        'coach_accepted',
        '코치가 레슨을 수락했습니다',
        `${coachUser.name} 코치가 ${planLabel} 요청을 수락했습니다. 구장 배정 후 최종 확정 안내드리겠습니다.`,
        booking.id
      );
      // Notify admins — venue assignment needed
      const admins = db.prepare('SELECT id FROM users WHERE is_admin = 1').all();
      admins.forEach(admin => {
        sendNotification(
          admin.id,
          'venue_assign_needed',
          '구장 배정 필요',
          `${coachUser.name} 코치가 ${student.name}님의 레슨을 수락했습니다. 구장 배정이 필요합니다. (${booking.lesson_date} ${booking.lesson_time})`,
          booking.id
        );
      });
    } else {
      // Notify student — rejected
      sendNotification(
        booking.student_id,
        'coach_rejected',
        '레슨 요청이 거절되었습니다',
        `${coachUser.name} 코치가 ${planLabel} 요청을 거절했습니다. 다른 코치를 찾아보세요.`,
        booking.id
      );
    }

    res.json({ message: action === 'accept' ? '수락했습니다.' : '거절했습니다.', status: newStatus });
  } catch (err) {
    console.error('Coach respond error:', err.message);
    res.status(500).json({ error: '예약 처리 중 오류가 발생했습니다.' });
  }
});

/* ===== PATCH /api/bookings/:id/assign-venue — 관리자가 구장 배정 ===== */
router.patch('/:id/assign-venue', authenticateToken, (req, res) => {
  try {
    const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (!admin || !admin.is_admin) return res.status(403).json({ error: '관리자 권한이 필요합니다.' });

    const { venue_id } = req.body;
    if (!venue_id) return res.status(400).json({ error: '구장을 선택해주세요.' });

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (booking.status !== 'coach_accepted') return res.status(400).json({ error: '코치 수락 상태인 예약만 구장 배정이 가능합니다.' });

    const venue = db.prepare("SELECT * FROM venues WHERE id = ? AND status = 'approved'").get(venue_id);
    if (!venue) return res.status(404).json({ error: '승인된 구장을 찾을 수 없습니다.' });

    db.prepare('UPDATE bookings SET venue_id = ?, status = ? WHERE id = ?').run(venue_id, 'confirmed', req.params.id);

    // Notify student — confirmed
    const coachInfo = db.prepare('SELECT u.name FROM coaches c JOIN users u ON c.user_id = u.id WHERE c.id = ?').get(booking.coach_id);
    const planLabel = { trial: '체험 레슨', monthly: '정기 패키지 8회', camp: '집중 캠프 4회' }[booking.plan_type] || booking.plan_type;

    sendNotification(
      booking.student_id,
      'booking_confirmed',
      '예약이 확정되었습니다!',
      `${planLabel} | ${coachInfo.name} 코치 | ${booking.lesson_date} ${booking.lesson_time}\n구장: ${venue.name} (${venue.address})\n합계: ₩${booking.total_price.toLocaleString()}`,
      booking.id
    );

    // Notify coach — confirmed with venue info
    const coach = db.prepare('SELECT user_id FROM coaches WHERE id = ?').get(booking.coach_id);
    const student = db.prepare('SELECT name FROM users WHERE id = ?').get(booking.student_id);
    sendNotification(
      coach.user_id,
      'booking_confirmed',
      '레슨 확정 — 구장 배정 완료',
      `${student.name}님 ${planLabel} | ${booking.lesson_date} ${booking.lesson_time}\n구장: ${venue.name} (${venue.address})`,
      booking.id
    );

    // Notify venue owner
    sendNotification(
      venue.user_id,
      'venue_booked',
      '구장 이용 예약',
      `${booking.lesson_date} ${booking.lesson_time}에 레슨이 배정되었습니다.\n코치: ${coachInfo.name} | 수강생: ${student.name}`,
      booking.id
    );

    res.json({ message: '구장이 배정되고 예약이 확정되었습니다.' });
  } catch (err) {
    console.error('Assign venue error:', err.message);
    res.status(500).json({ error: '구장 배정 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
