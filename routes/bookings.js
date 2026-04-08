const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');
const { sendNotification } = require('./notifications');

const router = express.Router();

/* ===== POST /api/bookings — 즉시 확정 예약 ===== */
router.post('/', authenticateToken, (req, res) => {
  try {
    const { coach_id, plan_type, lesson_date, lesson_time } = req.body;

    if (!coach_id || !plan_type || !lesson_date || !lesson_time) {
      return res.status(400).json({ error: '필수 항목을 모두 입력해주세요.' });
    }

    if (!['trial', 'monthly', 'camp'].includes(plan_type)) {
      return res.status(400).json({ error: '유효하지 않은 레슨 플랜입니다.' });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(lesson_date)) {
      return res.status(400).json({ error: '올바른 날짜 형식을 입력해주세요.' });
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(lesson_time)) {
      return res.status(400).json({ error: '올바른 시간 형식을 입력해주세요. (HH:MM)' });
    }

    const today = new Date().toISOString().split('T')[0];
    if (lesson_date < today) {
      return res.status(400).json({ error: '과거 날짜에는 예약할 수 없습니다.' });
    }

    // 코치 존재 + 가격 확인
    const coach = db.prepare(`
      SELECT c.id, c.user_id, c.region, c.trial_price, c.monthly_price, c.camp_price
      FROM coaches c WHERE c.id = ? AND c.status = 'approved'
    `).get(coach_id);
    if (!coach) {
      return res.status(404).json({ error: '승인된 코치를 찾을 수 없습니다.' });
    }

    // 스케줄 유효성 검증
    const dayOfWeek = new Date(lesson_date + 'T00:00:00').getDay();
    const scheduleMatch = db.prepare(`
      SELECT id FROM coach_schedules
      WHERE coach_id = ? AND day_of_week = ? AND is_active = 1
      AND start_time <= ? AND end_time > ?
    `).get(coach_id, dayOfWeek, lesson_time, lesson_time);

    if (!scheduleMatch) {
      return res.status(400).json({ error: '해당 시간에 코치 스케줄이 없습니다.' });
    }

    // 트랜잭션으로 중복 확인 + INSERT 원자적 실행
    const bookTransaction = db.transaction(() => {
      // 중복 예약 확인
      const conflict = db.prepare(`
        SELECT COUNT(*) as count FROM bookings
        WHERE coach_id = ? AND lesson_date = ? AND lesson_time = ?
        AND status IN ('confirmed', 'pending')
      `).get(coach_id, lesson_date, lesson_time);

      if (conflict.count > 0) {
        throw new Error('DUPLICATE');
      }

      // 가격 결정
      const priceMap = {
        trial: coach.trial_price || 65000,
        monthly: coach.monthly_price || 440000,
        camp: coach.camp_price || 260000
      };
      const total_price = priceMap[plan_type];

      // 구장 자동 배정
      const student = db.prepare('SELECT preferred_region FROM users WHERE id = ?').get(req.user.id);
      let venue = null;

      // 1차: 수강생 선호지역과 코치 지역 교집합
      if (student?.preferred_region) {
        venue = db.prepare(`
          SELECT id, name, address FROM venues v
          WHERE v.status = 'approved' AND v.region LIKE ?
          AND v.id NOT IN (SELECT b2.venue_id FROM bookings b2 WHERE b2.lesson_date = ? AND b2.lesson_time = ? AND b2.status IN ('confirmed','pending') AND b2.venue_id IS NOT NULL)
          ORDER BY RANDOM() LIMIT 1
        `).get(`%${student.preferred_region}%`, lesson_date, lesson_time);
      }

      // 2차: 코치 활동 지역 내 구장
      if (!venue) {
        venue = db.prepare(`
          SELECT id, name, address FROM venues v
          WHERE v.status = 'approved' AND v.region LIKE ?
          AND v.id NOT IN (SELECT b2.venue_id FROM bookings b2 WHERE b2.lesson_date = ? AND b2.lesson_time = ? AND b2.status IN ('confirmed','pending') AND b2.venue_id IS NOT NULL)
          ORDER BY RANDOM() LIMIT 1
        `).get(`%${coach.region.split(' ')[0]}%`, lesson_date, lesson_time);
      }

      // 3차: 아무 승인된 구장
      if (!venue) {
        venue = db.prepare(`
          SELECT id, name, address FROM venues v
          WHERE v.status = 'approved'
          AND v.id NOT IN (SELECT b2.venue_id FROM bookings b2 WHERE b2.lesson_date = ? AND b2.lesson_time = ? AND b2.status IN ('confirmed','pending') AND b2.venue_id IS NOT NULL)
          ORDER BY RANDOM() LIMIT 1
        `).get(lesson_date, lesson_time);
      }

      const venue_id = venue ? venue.id : null;

      const result = db.prepare(`
        INSERT INTO bookings (student_id, coach_id, venue_id, plan_type, lesson_date, lesson_time,
                              lesson_price, venue_price, total_price, status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'confirmed', CURRENT_TIMESTAMP)
      `).run(req.user.id, coach_id, venue_id, plan_type, lesson_date, lesson_time, total_price, total_price);

      return { bookingId: result.lastInsertRowid, venue, total_price };
    });

    let bookResult;
    try {
      bookResult = bookTransaction();
    } catch (txErr) {
      if (txErr.message === 'DUPLICATE') {
        return res.status(409).json({ error: '해당 시간에 이미 예약이 있습니다. 다른 시간을 선택해주세요.' });
      }
      throw txErr;
    }

    const { bookingId, venue, total_price } = bookResult;
    const studentInfo = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const planLabel = { trial: '체험 레슨', monthly: '정기 패키지 8회', camp: '집중 캠프 4회' }[plan_type] || plan_type;
    const venueInfo = venue ? `\n구장: ${venue.name} (${venue.address})` : '';

    // 수강생 알림
    sendNotification(
      req.user.id,
      'booking_instant_confirmed',
      '예약이 확정되었습니다!',
      `${planLabel} | ${lesson_date} ${lesson_time}\n합계: ₩${total_price.toLocaleString()}${venueInfo}`,
      bookingId
    );

    // 코치 알림
    sendNotification(
      coach.user_id,
      'booking_instant_confirmed',
      '새로운 레슨이 확정되었습니다',
      `${studentInfo.name}님 ${planLabel} | ${lesson_date} ${lesson_time}${venueInfo}`,
      bookingId
    );

    // 구장 미배정이면 관리자 알림
    if (!venue) {
      const admins = db.prepare('SELECT id FROM users WHERE is_admin = 1').all();
      admins.forEach(admin => {
        sendNotification(
          admin.id,
          'venue_needs_admin',
          '구장 수동 배정 필요',
          `${studentInfo.name}님 → 코치ID ${coach_id} | ${planLabel} | ${lesson_date} ${lesson_time} — 자동 배정 실패`,
          bookingId
        );
      });
    }

    // 구장 오너 알림
    if (venue) {
      const venueOwner = db.prepare('SELECT user_id FROM venues WHERE id = ?').get(venue.id);
      if (venueOwner) {
        sendNotification(
          venueOwner.user_id,
          'venue_auto_assigned',
          '구장 이용 예약',
          `${lesson_date} ${lesson_time}에 레슨이 배정되었습니다.`,
          bookingId
        );
      }
    }

    res.status(201).json({
      message: '예약이 확정되었습니다!',
      booking: {
        id: bookingId,
        status: 'confirmed',
        venue_name: venue?.name || null,
        venue_address: venue?.address || null
      }
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

/* ===== POST /api/bookings/:id/cancel — 예약 취소 ===== */
router.post('/:id/cancel', authenticateToken, (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });
    if (booking.status !== 'confirmed') return res.status(400).json({ error: '확정된 예약만 취소할 수 있습니다.' });

    const coach = db.prepare('SELECT id, user_id FROM coaches WHERE id = ?').get(booking.coach_id);
    const isCoach = coach && coach.user_id === req.user.id;
    const isStudent = booking.student_id === req.user.id;

    if (!isCoach && !isStudent) {
      return res.status(403).json({ error: '본인의 예약만 취소할 수 있습니다.' });
    }

    const cancelTransaction = db.transaction(() => {
      if (isCoach) {
        db.prepare("UPDATE bookings SET status = 'cancelled_by_coach', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

        // 페널티 추가
        db.prepare('INSERT INTO coach_penalties (coach_id, booking_id, reason) VALUES (?, ?, ?)').run(
          coach.id, booking.id, '코치 취소'
        );

        // 3회 이상이면 코치 숨김
        const penaltyCount = db.prepare("SELECT COUNT(*) as count FROM coach_penalties WHERE coach_id = ? AND created_at > datetime('now', '-6 months')").get(coach.id).count;
        if (penaltyCount >= 3) {
          db.prepare("UPDATE coaches SET status = 'hidden' WHERE id = ?").run(coach.id);
        }

        // 수강생 알림
        const coachUser = db.prepare('SELECT name FROM users WHERE id = ?').get(coach.user_id);
        sendNotification(
          booking.student_id,
          'booking_cancelled',
          '레슨이 취소되었습니다',
          `${coachUser.name} 코치가 ${booking.lesson_date} ${booking.lesson_time} 레슨을 취소했습니다.`,
          booking.id
        );
      } else {
        db.prepare("UPDATE bookings SET status = 'cancelled_by_student', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);

        // 코치 알림
        const student = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
        sendNotification(
          coach.user_id,
          'booking_cancelled',
          '수강생이 레슨을 취소했습니다',
          `${student.name}님이 ${booking.lesson_date} ${booking.lesson_time} 레슨을 취소했습니다.`,
          booking.id
        );
      }
    });
    cancelTransaction();

    res.json({ message: '예약이 취소되었습니다.' });
  } catch (err) {
    console.error('Cancel booking error:', err.message);
    res.status(500).json({ error: '예약 취소 중 오류가 발생했습니다.' });
  }
});

/* ===== PATCH /api/bookings/:id/assign-venue — 관리자가 구장 수동 배정/변경 ===== */
router.patch('/:id/assign-venue', authenticateToken, (req, res) => {
  try {
    const admin = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.id);
    if (!admin || !admin.is_admin) return res.status(403).json({ error: '관리자 권한이 필요합니다.' });

    const { venue_id } = req.body;
    if (!venue_id) return res.status(400).json({ error: '구장을 선택해주세요.' });

    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    if (!booking) return res.status(404).json({ error: '예약을 찾을 수 없습니다.' });

    const venue = db.prepare("SELECT * FROM venues WHERE id = ? AND status = 'approved'").get(venue_id);
    if (!venue) return res.status(404).json({ error: '승인된 구장을 찾을 수 없습니다.' });

    db.prepare('UPDATE bookings SET venue_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(venue_id, req.params.id);

    // 수강생 알림
    sendNotification(
      booking.student_id,
      'venue_auto_assigned',
      '구장이 배정되었습니다',
      `${booking.lesson_date} ${booking.lesson_time} 레슨 구장: ${venue.name} (${venue.address})`,
      booking.id
    );

    // 코치 알림
    const coach = db.prepare('SELECT user_id FROM coaches WHERE id = ?').get(booking.coach_id);
    if (coach) {
      sendNotification(
        coach.user_id,
        'venue_auto_assigned',
        '구장 배정 완료',
        `${booking.lesson_date} ${booking.lesson_time} 레슨 구장: ${venue.name} (${venue.address})`,
        booking.id
      );
    }

    res.json({ message: '구장이 배정되었습니다.' });
  } catch (err) {
    console.error('Assign venue error:', err.message);
    res.status(500).json({ error: '구장 배정 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
