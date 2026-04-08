const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();

function auditLog(userId, action, targetType, targetId, detail) {
  try {
    db.prepare('INSERT INTO audit_log (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)').run(userId, action, targetType, targetId, detail || null);
  } catch (e) { /* ignore */ }
}

// All admin routes require auth + admin
router.use(authenticateToken, requireAdmin);

// GET /api/admin/stats — dashboard overview
router.get('/stats', (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;

    const coachStats = db.prepare("SELECT status, COUNT(*) as count FROM coaches GROUP BY status").all();
    const coachMap = {};
    let totalCoaches = 0;
    coachStats.forEach(r => { coachMap[r.status] = r.count; totalCoaches += r.count; });

    const venueStats = db.prepare("SELECT status, COUNT(*) as count FROM venues GROUP BY status").all();
    const venueMap = {};
    let totalVenues = 0;
    venueStats.forEach(r => { venueMap[r.status] = r.count; totalVenues += r.count; });

    const bookingStats = db.prepare("SELECT status, COUNT(*) as count FROM bookings GROUP BY status").all();
    const bookingMap = {};
    let totalBookings = 0;
    bookingStats.forEach(r => { bookingMap[r.status] = r.count; totalBookings += r.count; });

    const noVenueBookings = db.prepare("SELECT COUNT(*) as count FROM bookings WHERE status = 'confirmed' AND venue_id IS NULL").get().count;

    res.json({
      users: { total: totalUsers },
      coaches: { total: totalCoaches, pending: coachMap.pending || 0, approved: coachMap.approved || 0, rejected: coachMap.rejected || 0 },
      venues: { total: totalVenues, pending: venueMap.pending || 0, approved: venueMap.approved || 0, rejected: venueMap.rejected || 0 },
      bookings: { total: totalBookings, pending: bookingMap.pending || 0, confirmed: bookingMap.confirmed || 0, no_venue: noVenueBookings, cancelled_by_coach: bookingMap.cancelled_by_coach || 0, cancelled_by_student: bookingMap.cancelled_by_student || 0 }
    });
  } catch (err) {
    console.error('Admin stats error:', err.message);
    res.status(500).json({ error: '통계 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/users — list all users
router.get('/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, name, email, phone, is_admin, created_at FROM users ORDER BY created_at DESC LIMIT 200').all();
    res.json({ users });
  } catch (err) {
    console.error('Admin users error:', err.message);
    res.status(500).json({ error: '사용자 목록 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/coaches — list all coach applications
router.get('/coaches', (req, res) => {
  try {
    const coaches = db.prepare(`
      SELECT c.*, u.name, u.email, u.phone
      FROM coaches c JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC LIMIT 200
    `).all();
    res.json({ coaches });
  } catch (err) {
    console.error('Admin coaches error:', err.message);
    res.status(500).json({ error: '코치 목록 조회 중 오류가 발생했습니다.' });
  }
});

// PATCH /api/admin/coaches/:id — approve or reject
router.patch('/coaches/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });

    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    }
    const result = db.prepare('UPDATE coaches SET status = ? WHERE id = ?').run(status, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '코치 신청을 찾을 수 없습니다.' });
    }
    auditLog(req.user.id, status === 'approved' ? 'coach_approve' : 'coach_reject', 'coach', id);
    res.json({ message: status === 'approved' ? '승인되었습니다.' : '거절되었습니다.' });
  } catch (err) {
    console.error('Admin coach update error:', err.message);
    res.status(500).json({ error: '코치 상태 변경 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/venues — list all venue applications
router.get('/venues', (req, res) => {
  try {
    const venues = db.prepare(`
      SELECT v.*, u.name as owner_name, u.email as owner_email, u.phone as owner_phone
      FROM venues v JOIN users u ON v.user_id = u.id
      ORDER BY v.created_at DESC LIMIT 200
    `).all();
    res.json({ venues });
  } catch (err) {
    console.error('Admin venues error:', err.message);
    res.status(500).json({ error: '구장 목록 조회 중 오류가 발생했습니다.' });
  }
});

// PATCH /api/admin/venues/:id — approve or reject
router.patch('/venues/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!id || id <= 0) return res.status(400).json({ error: '유효하지 않은 ID입니다.' });

    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    }
    const result = db.prepare('UPDATE venues SET status = ? WHERE id = ?').run(status, id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '구장 신청을 찾을 수 없습니다.' });
    }
    auditLog(req.user.id, status === 'approved' ? 'venue_approve' : 'venue_reject', 'venue', id);
    res.json({ message: status === 'approved' ? '승인되었습니다.' : '거절되었습니다.' });
  } catch (err) {
    console.error('Admin venue update error:', err.message);
    res.status(500).json({ error: '구장 상태 변경 중 오류가 발생했습니다.' });
  }
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    }
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.params.id);
    const result = db.prepare("UPDATE users SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    auditLog(req.user.id, 'user_delete', 'user', parseInt(req.params.id));
    res.json({ message: '삭제되었습니다.' });
  } catch (err) {
    console.error('Admin user delete error:', err.message);
    res.status(500).json({ error: '사용자 삭제 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/bookings — all bookings
router.get('/bookings', (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*,
             u_s.name as student_name, u_s.email as student_email, u_s.phone as student_phone,
             u_c.name as coach_name,
             c.skills as coach_skills, c.region as coach_region,
             v.name as venue_name, v.address as venue_address
      FROM bookings b
      JOIN users u_s ON b.student_id = u_s.id
      JOIN coaches c ON b.coach_id = c.id
      JOIN users u_c ON c.user_id = u_c.id
      LEFT JOIN venues v ON b.venue_id = v.id
      ORDER BY b.created_at DESC LIMIT 200
    `).all();
    res.json({ bookings });
  } catch (err) {
    console.error('Admin bookings error:', err.message);
    res.status(500).json({ error: '예약 목록 조회 중 오류가 발생했습니다.' });
  }
});

// GET /api/admin/venues-approved — for venue assignment dropdown
router.get('/venues-approved', (req, res) => {
  try {
    const venues = db.prepare("SELECT id, name, address, region FROM venues WHERE status = 'approved' ORDER BY name").all();
    res.json({ venues });
  } catch (err) {
    console.error('Admin venues-approved error:', err.message);
    res.status(500).json({ error: '승인 구장 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
