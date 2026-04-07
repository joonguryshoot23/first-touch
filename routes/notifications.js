const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/* Helper: send notification */
function sendNotification(userId, type, title, message, bookingId) {
  try {
    db.prepare(
      'INSERT INTO notifications (user_id, type, title, message, booking_id) VALUES (?, ?, ?, ?, ?)'
    ).run(userId, type, title, message, bookingId || null);
  } catch (err) {
    console.error('Notification send error:', err.message);
  }
}

/* GET /api/notifications — my notifications */
router.get('/', authenticateToken, (req, res) => {
  try {
    const notifications = db.prepare(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).all(req.user.id);

    const unread = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
    ).get(req.user.id).count;

    res.json({ notifications, unread });
  } catch (err) {
    console.error('Notifications get error:', err.message);
    res.status(500).json({ error: '알림 조회 중 오류가 발생했습니다.' });
  }
});

/* PATCH /api/notifications/read-all — mark all as read */
router.patch('/read-all', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
    res.json({ message: '모두 읽음 처리되었습니다.' });
  } catch (err) {
    console.error('Notifications read-all error:', err.message);
    res.status(500).json({ error: '알림 처리 중 오류가 발생했습니다.' });
  }
});

/* PATCH /api/notifications/:id/read — mark one as read */
router.patch('/:id/read', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ message: '읽음 처리되었습니다.' });
  } catch (err) {
    console.error('Notification read error:', err.message);
    res.status(500).json({ error: '알림 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
module.exports.sendNotification = sendNotification;
