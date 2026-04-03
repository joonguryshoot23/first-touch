const express = require('express');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/* Helper: send notification */
function sendNotification(userId, type, title, message, bookingId) {
  db.prepare(
    'INSERT INTO notifications (user_id, type, title, message, booking_id) VALUES (?, ?, ?, ?, ?)'
  ).run(userId, type, title, message, bookingId || null);
}

/* GET /api/notifications — my notifications */
router.get('/', authenticateToken, (req, res) => {
  const notifications = db.prepare(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);

  const unread = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user.id).count;

  res.json({ notifications, unread });
});

/* PATCH /api/notifications/read-all — mark all as read */
router.patch('/read-all', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json({ message: '모두 읽음 처리되었습니다.' });
});

/* PATCH /api/notifications/:id/read — mark one as read */
router.patch('/:id/read', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: '읽음 처리되었습니다.' });
});

module.exports = router;
module.exports.sendNotification = sendNotification;
