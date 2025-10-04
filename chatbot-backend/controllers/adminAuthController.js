// controllers/adminAuthController.js
const Admin = require('../models/adminModel');
const jwt = require('jsonwebtoken');

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Admin login
const adminLogin = async (req, res) => {
  const { username, password } = req.body;

  const admin = await Admin.findOne({ username });
  if (admin && (await admin.matchPassword(password))) {
    res.json({
      _id: admin._id,
      username: admin.username,
      token: generateToken(admin._id)
    });
  } else {
    res.status(401).json({ message: '❌ Invalid credentials' });
  }
};

module.exports = { adminLogin };
