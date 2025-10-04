// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getAllUsers, getUserByPhone, getUserOrders, getOrdersByPhone, submitOrderFeedback } = require('../controllers/userController');
const protect = require('../middleware/protectUser');
const protectAdmin = require('../middleware/protectAdmin');

// Auth routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// User profile and orders
router.get('/orders', protect, getUserOrders); // GET /users/orders (authenticated)
router.get('/:phone/orders', getOrdersByPhone); // GET /users/:phone/orders (fallback for non-authenticated)
router.post('/feedback', protect, submitOrderFeedback); // POST /users/feedback (authenticated)

// Admin only: get all users
router.get('/', protectAdmin, getAllUsers);

// Get user by phone (admin or public?)
router.get('/:phone', getUserByPhone);

module.exports = router;
