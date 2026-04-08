const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/coaches — apply as coach
router.post('/', authenticateToken, (req, res) => {
  try {
    const { skills, region, bio } = req.body;

    if (!skills || !region) {
      return res.status(400).json({ error: '레슨 스킬과 활동 지역을 입력해주세요.' });
    }

    // skills 배열 검증
    const skillsArr = Array.isArray(skills) ? skills : [skills];
    if (skillsArr.some(s => typeof s !== 'string' || s.length > 100)) {
      return res.status(400).json({ error: '유효하지 않은 스킬입니다.' });
    }

    if (typeof region !== 'string' || region.length > 100) {
      return res.status(400).json({ error: '유효하지 않은 지역입니다.' });
    }

    const existing = db.prepare('SELECT id, status FROM coaches WHERE user_id = ?').get(req.user.id);
    if (existing) {
      if (existing.status === 'pending') {
        return res.status(409).json({ error: '이미 심사 중인 코치 등록 신청이 있습니다.' });
      }
      if (existing.status === 'approved') {
        return res.status(409).json({ error: '이미 승인된 코치입니다.' });
      }
    }

    const skillsStr = skillsArr.join(',');

    const result = db.prepare(
      'INSERT INTO coaches (user_id, skills, region, bio) VALUES (?, ?, ?, ?)'
    ).run(req.user.id, skillsStr, region, bio || null);

    res.status(201).json({
      message: '코치 등록 신청이 완료되었습니다. 심사 후 2~3 영업일 내에 결과를 안내드립니다.',
      coach: { id: result.lastInsertRowid, status: 'pending' }
    });
  } catch (err) {
    console.error('Coach register error:', err.message);
    res.status(500).json({ error: '코치 등록 중 오류가 발생했습니다.' });
  }
});

// GET /api/coaches — list approved coaches (legacy, kept for compatibility)
router.get('/', (req, res) => {
  try {
    const coaches = db.prepare(`
      SELECT c.id, c.skills, c.region, c.bio, c.created_at,
             c.trial_price, c.monthly_price, c.camp_price, c.lesson_duration,
             u.name, u.email
      FROM coaches c
      JOIN users u ON c.user_id = u.id
      WHERE c.status = 'approved'
      ORDER BY c.created_at DESC
    `).all();

    res.json({ coaches });
  } catch (err) {
    console.error('Coach list error:', err.message);
    res.status(500).json({ error: '코치 목록 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/coaches/my — get my coach application status
router.get('/my', authenticateToken, (req, res) => {
  try {
    const coach = db.prepare('SELECT * FROM coaches WHERE user_id = ?').get(req.user.id);
    if (!coach) {
      return res.json({ coach: null });
    }
    res.json({ coach });
  } catch (err) {
    console.error('My coach error:', err.message);
    res.status(500).json({ error: '코치 정보 조회 중 오류가 발생했습니다.' });
  }
});

/* ===== 공개 API: 코치 목록 (필터 지원) ===== */
router.get('/list', (req, res) => {
  try {
    const { region } = req.query;
    let sql = `
      SELECT c.id, c.skills, c.region, c.bio,
             c.trial_price, c.monthly_price, c.camp_price, c.lesson_duration,
             u.name
      FROM coaches c
      JOIN users u ON c.user_id = u.id
      WHERE c.status = 'approved'
    `;
    const params = [];
    if (region) {
      sql += ` AND c.region LIKE ?`;
      params.push(`%${region}%`);
    }
    sql += ` ORDER BY c.created_at DESC`;

    const coaches = db.prepare(sql).all(...params);
    res.json({ coaches });
  } catch (err) {
    console.error('Coach list error:', err.message);
    res.status(500).json({ error: '코치 목록 조회 중 오류가 발생했습니다.' });
  }
});

/* ===== 공개 API: 코치 상세 ===== */
router.get('/detail/:id', (req, res) => {
  try {
    const coachId = parseInt(req.params.id);
    if (!coachId || coachId <= 0) {
      return res.status(400).json({ error: '유효하지 않은 코치 ID입니다.' });
    }

    const coach = db.prepare(`
      SELECT c.id, c.skills, c.region, c.bio,
             c.trial_price, c.monthly_price, c.camp_price, c.lesson_duration,
             u.name, u.email
      FROM coaches c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ? AND c.status = 'approved'
    `).get(coachId);

    if (!coach) {
      return res.status(404).json({ error: '코치를 찾을 수 없습니다.' });
    }

    const schedules = db.prepare(`
      SELECT day_of_week, start_time, end_time, is_active
      FROM coach_schedules
      WHERE coach_id = ? AND is_active = 1
      ORDER BY day_of_week, start_time
    `).all(coachId);

    res.json({ coach, schedules });
  } catch (err) {
    console.error('Coach detail error:', err.message);
    res.status(500).json({ error: '코치 정보 조회 중 오류가 발생했습니다.' });
  }
});

/* ===== 공개 API: 가용 슬롯 조회 ===== */
router.get('/detail/:id/available-slots', (req, res) => {
  try {
    const coachId = parseInt(req.params.id);
    const { date } = req.query;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: '유효한 날짜를 입력해주세요. (YYYY-MM-DD)' });
    }

    const coach = db.prepare("SELECT lesson_duration FROM coaches WHERE id = ? AND status = 'approved'").get(coachId);
    if (!coach) {
      return res.status(404).json({ error: '코치를 찾을 수 없습니다.' });
    }

    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const schedules = db.prepare(`
      SELECT start_time, end_time FROM coach_schedules
      WHERE coach_id = ? AND day_of_week = ? AND is_active = 1
    `).all(coachId, dayOfWeek);

    if (schedules.length === 0) {
      return res.json({ date, slots: [] });
    }

    // Generate slots based on lesson_duration
    const duration = coach.lesson_duration || 60;
    const slots = [];
    schedules.forEach(sch => {
      const [startH, startM] = sch.start_time.split(':').map(Number);
      const [endH, endM] = sch.end_time.split(':').map(Number);
      const startMin = startH * 60 + startM;
      const endMin = endH * 60 + endM;

      for (let t = startMin; t + duration <= endMin; t += duration) {
        const h = String(Math.floor(t / 60)).padStart(2, '0');
        const m = String(t % 60).padStart(2, '0');
        slots.push(`${h}:${m}`);
      }
    });

    // Remove already booked slots
    const booked = db.prepare(`
      SELECT lesson_time FROM bookings
      WHERE coach_id = ? AND lesson_date = ? AND status IN ('confirmed', 'pending')
    `).all(coachId, date).map(b => b.lesson_time);

    const availableSlots = slots.filter(s => !booked.includes(s));

    res.json({ date, slots: availableSlots });
  } catch (err) {
    console.error('Available slots error:', err.message);
    res.status(500).json({ error: '가용 시간 조회 중 오류가 발생했습니다.' });
  }
});

/* ===== 코치 스케줄 관리: 조회 ===== */
router.get('/my/schedule', authenticateToken, (req, res) => {
  try {
    const coach = db.prepare("SELECT id FROM coaches WHERE user_id = ? AND status = 'approved'").get(req.user.id);
    if (!coach) {
      return res.status(403).json({ error: '승인된 코치만 스케줄을 관리할 수 있습니다.' });
    }

    const schedules = db.prepare(`
      SELECT id, day_of_week, start_time, end_time, is_active
      FROM coach_schedules WHERE coach_id = ?
      ORDER BY day_of_week, start_time
    `).all(coach.id);

    res.json({ schedules });
  } catch (err) {
    console.error('My schedule error:', err.message);
    res.status(500).json({ error: '스케줄 조회 중 오류가 발생했습니다.' });
  }
});

/* ===== 코치 스케줄 관리: 저장 ===== */
router.put('/my/schedule', authenticateToken, (req, res) => {
  try {
    const coach = db.prepare("SELECT id FROM coaches WHERE user_id = ? AND status = 'approved'").get(req.user.id);
    if (!coach) {
      return res.status(403).json({ error: '승인된 코치만 스케줄을 관리할 수 있습니다.' });
    }

    const { schedules } = req.body;
    if (!Array.isArray(schedules)) {
      return res.status(400).json({ error: '스케줄 데이터가 올바르지 않습니다.' });
    }

    // Validate each schedule
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    for (const s of schedules) {
      if (s.day_of_week < 0 || s.day_of_week > 6) {
        return res.status(400).json({ error: '요일 값이 올바르지 않습니다. (0=일, 6=토)' });
      }
      if (!timeRegex.test(s.start_time) || !timeRegex.test(s.end_time)) {
        return res.status(400).json({ error: '시간 형식이 올바르지 않습니다. (HH:MM)' });
      }
      if (s.start_time >= s.end_time) {
        return res.status(400).json({ error: '시작 시간은 종료 시간보다 빨라야 합니다.' });
      }
    }

    // Check for conflicting future bookings (warning only)
    const conflictingBookings = db.prepare(`
      SELECT COUNT(*) as count FROM bookings
      WHERE coach_id = ? AND status IN ('confirmed', 'pending')
      AND lesson_date >= date('now')
    `).get(coach.id);
    if (conflictingBookings.count > 0) {
      console.warn(`[Schedule] Coach ${coach.id} has ${conflictingBookings.count} future bookings while updating schedule`);
    }

    // Transaction: delete all → insert new
    const saveSchedules = db.transaction(() => {
      db.prepare('DELETE FROM coach_schedules WHERE coach_id = ?').run(coach.id);
      const insert = db.prepare(
        'INSERT INTO coach_schedules (coach_id, day_of_week, start_time, end_time, is_active) VALUES (?, ?, ?, ?, ?)'
      );
      for (const s of schedules) {
        insert.run(coach.id, s.day_of_week, s.start_time, s.end_time, s.is_active !== undefined ? s.is_active : 1);
      }
    });
    saveSchedules();

    res.json({ message: '스케줄이 저장되었습니다.' });
  } catch (err) {
    console.error('Save schedule error:', err.message);
    res.status(500).json({ error: '스케줄 저장 중 오류가 발생했습니다.' });
  }
});

/* ===== 코치 가격 수정 ===== */
router.patch('/my/prices', authenticateToken, (req, res) => {
  try {
    const coach = db.prepare("SELECT id FROM coaches WHERE user_id = ? AND status = 'approved'").get(req.user.id);
    if (!coach) {
      return res.status(403).json({ error: '승인된 코치만 가격을 수정할 수 있습니다.' });
    }

    const { trial_price, monthly_price, camp_price } = req.body;

    if (trial_price !== undefined && (typeof trial_price !== 'number' || trial_price <= 0)) {
      return res.status(400).json({ error: '유효하지 않은 가격입니다.' });
    }
    if (monthly_price !== undefined && (typeof monthly_price !== 'number' || monthly_price <= 0)) {
      return res.status(400).json({ error: '유효하지 않은 가격입니다.' });
    }
    if (camp_price !== undefined && (typeof camp_price !== 'number' || camp_price <= 0)) {
      return res.status(400).json({ error: '유효하지 않은 가격입니다.' });
    }

    db.prepare(`
      UPDATE coaches SET trial_price = COALESCE(?, trial_price),
                         monthly_price = COALESCE(?, monthly_price),
                         camp_price = COALESCE(?, camp_price)
      WHERE id = ?
    `).run(trial_price ?? null, monthly_price ?? null, camp_price ?? null, coach.id);

    res.json({ message: '가격이 수정되었습니다.' });
  } catch (err) {
    console.error('Update prices error:', err.message);
    res.status(500).json({ error: '가격 수정 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
