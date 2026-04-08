require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const authRoutes = require('./routes/auth');
const coachRoutes = require('./routes/coaches');
const venueRoutes = require('./routes/venues');
const adminRoutes = require('./routes/admin');
const bookingRoutes = require('./routes/bookings');
const notificationRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// ── 보안 헤더 (X-Frame-Options, CSP 등 자동 적용) ──
app.use(helmet({
  contentSecurityPolicy: false // 정적 HTML에서 인라인 스크립트 허용
}));

// ── CORS: 허용 도메인 제한 ──
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [`http://localhost:${process.env.PORT || 3000}`];

app.use(cors({
  origin(origin, callback) {
    // 같은 서버 요청(origin 없음) 또는 허용 목록에 포함
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS 차단: 허용되지 않은 도메인입니다.'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// ── 로그인·회원가입 무차별 시도 차단 ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15분
  max: 20,                    // 15분에 최대 20회
  message: { error: '너무 많은 요청입니다. 15분 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ── 전체 API 요청 제한 ──
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,   // 1분
  max: 100,                   // 1분에 최대 100회
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(express.json({ limit: '1mb' }));

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname), { index: 'index.html' }));

// 루트 경로 → index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Rate limiting 적용
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/coaches', coachRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/notifications', notificationRoutes);

// 404 catch-all: serve 404.html for non-API routes
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: '요청하신 API를 찾을 수 없습니다.' });
  }
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

// ── 글로벌 에러 핸들러 (서버 크래시 방지) ──
app.use((err, req, res, next) => {
  console.error('서버 에러:', err.message);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ First Touch 서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
