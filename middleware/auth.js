const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    if (!user || !user.id) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
  }
}

module.exports = { authenticateToken };
