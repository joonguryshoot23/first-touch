const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/venues — register a venue
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, address, region, venue_type, capacity, equipment, available_hours, hourly_rate, notes } = req.body;

    if (!name || !address || !region || !venue_type) {
      return res.status(400).json({ error: '구장명, 주소, 지역, 구장 타입을 입력해주세요.' });
    }

    // 문자열 길이 제한
    if (name.length > 100 || address.length > 200 || region.length > 100) {
      return res.status(400).json({ error: '입력값이 너무 깁니다.' });
    }

    const equipmentStr = Array.isArray(equipment) ? equipment.join(',') : (equipment || '');

    const result = db.prepare(`
      INSERT INTO venues (user_id, name, address, region, venue_type, capacity, equipment, available_hours, hourly_rate, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      req.user.id, name, address, region, venue_type,
      capacity || null, equipmentStr, available_hours || null,
      hourly_rate || null, notes || null
    );

    res.status(201).json({
      message: '구장 등록 신청이 완료되었습니다. 심사 후 2~3 영업일 내에 결과를 안내드립니다.',
      venue: { id: result.lastInsertRowid, status: 'pending' }
    });
  } catch (err) {
    console.error('Venue register error:', err.message);
    res.status(500).json({ error: '구장 등록 중 오류가 발생했습니다.' });
  }
});

// GET /api/venues — list approved venues
router.get('/', (req, res) => {
  try {
    const venues = db.prepare(`
      SELECT v.id, v.name, v.address, v.region, v.venue_type, v.capacity,
             v.equipment, v.available_hours, v.hourly_rate, v.created_at,
             u.name as owner_name
      FROM venues v
      JOIN users u ON v.user_id = u.id
      WHERE v.status = 'approved'
      ORDER BY v.created_at DESC
    `).all();

    res.json({ venues });
  } catch (err) {
    console.error('Venue list error:', err.message);
    res.status(500).json({ error: '구장 목록 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/venues/my — get my venue registrations
router.get('/my', authenticateToken, (req, res) => {
  try {
    const venues = db.prepare('SELECT * FROM venues WHERE user_id = ?').all(req.user.id);
    res.json({ venues });
  } catch (err) {
    console.error('My venues error:', err.message);
    res.status(500).json({ error: '구장 정보 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
