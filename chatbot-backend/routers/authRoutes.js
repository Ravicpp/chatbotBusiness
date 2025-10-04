// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/userController');

// POST /auth/register  -> register (creates user if new) and returns token
router.post('/register', registerUser);

// POST /auth/login     -> login by phone (returns token)
router.post('/login', loginUser);

module.exports = router;
