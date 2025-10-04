// middleware/protect.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    const rawAuth = req.headers.authorization || req.headers['x-access-token'] || null;
    if (!rawAuth) return res.status(401).json({ message: '❌ No token, authorization denied' });

    // sanitize token (support "Bearer token" or raw token)
    let token = typeof rawAuth === 'string' && rawAuth.startsWith('Bearer ')
      ? rawAuth.split(' ')[1]
      : rawAuth;

    if (typeof token === 'string') {
      token = token.trim().replace(/^"(.*)"$/, '$1');
      if (token.toLowerCase().startsWith('bearer ')) token = token.split(' ')[1];
    }

    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      return res.status(401).json({ message: '❌ Invalid token format' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ message: '❌ Invalid token payload' });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(401).json({ message: '❌ User not found' });

    req.user = user;
    next();
  } catch (err) {
    console.error('protect error:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '❌ Session expired' });
    }
    res.status(401).json({ message: '❌ Invalid token' });
  }
};

module.exports = protect;
