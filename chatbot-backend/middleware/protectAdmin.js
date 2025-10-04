// middleware/protectAdmin.js
const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

const protectAdmin = async (req, res, next) => {
  try {
    const rawAuth = req.headers.authorization || req.headers['x-access-token'] || null;
    // console.log('protectAdmin: raw authorization header ->', rawAuth);

    if (!rawAuth) {
      return res.status(401).json({ message: '❌ No token, authorization denied' });
    }

    let token = typeof rawAuth === 'string' && rawAuth.startsWith('Bearer ')
      ? rawAuth.split(' ')[1]
      : rawAuth;

    if (typeof token === 'string') {
      token = token.trim().replace(/^"(.*)"$/, '$1');
      if (token.toLowerCase().startsWith('bearer ')) token = token.split(' ')[1];
    }

    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      // console.warn('protectAdmin: token looks malformed after sanitization ->', token);
      return res.status(401).json({ message: '❌ Invalid token format' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) return res.status(401).json({ message: '❌ Admin not found' });

    req.admin = admin;
    next();
  } catch (err) {
    console.error('protectAdmin error:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '❌ Session expired' });
    }
    return res.status(401).json({ message: '❌ Invalid token' });
  }
};

module.exports = protectAdmin;
