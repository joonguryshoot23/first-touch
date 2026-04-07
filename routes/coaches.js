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

// GET /api/coaches — list approved coaches
router.get('/', (req, res) => {
  try {
    const coaches = db.prepare(`
      SELECT c.id, c.skills, c.region, c.bio, c.created_at,
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

module.exports = router;
