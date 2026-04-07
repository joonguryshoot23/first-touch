const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/init');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// ── 입력 검증 헬퍼 ──
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  // 한국 전화번호: 01X-XXXX-XXXX (하이픈 있든 없든)
  return /^01[0-9]\d{7,8}$/.test(phone.replace(/-/g, ''));
}

function isStrongPassword(password) {
  // 8자 이상, 영문+숫자 포함
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
    }

    if (name.length > 50) {
      return res.status(400).json({ error: '이름은 50자 이내로 입력해주세요.' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: '올바른 이메일 형식을 입력해주세요.' });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({ error: '올바른 전화번호를 입력해주세요. (예: 010-1234-5678)' });
    }

    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: '비밀번호는 8자 이상, 영문과 숫자를 포함해야 합니다.' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: '이미 가입된 이메일입니다.' });
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (name, email, phone, password) VALUES (?, ?, ?, ?)'
    ).run(name.trim(), email.trim().toLowerCase(), phone.replace(/-/g, ''), hash);

    const token = jwt.sign(
      { id: result.lastInsertRowid, name: name.trim(), email: email.trim().toLowerCase() },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      token,
      user: { id: result.lastInsertRowid, name: name.trim(), email: email.trim().toLowerCase(), phone: phone.replace(/-/g, ''), is_admin: 0 }
    });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 잘못되었습니다.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '로그인 되었습니다.',
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, is_admin: user.is_admin }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// GET /api/auth/me — get current user info
router.get('/me', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email, phone, is_admin, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Auth/me error:', err.message);
    res.status(500).json({ error: '사용자 정보 조회 중 오류가 발생했습니다.' });
  }
});

module.exports = router;
