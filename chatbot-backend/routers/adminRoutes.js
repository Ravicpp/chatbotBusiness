// routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const {
  getAllOrders,
  updateOrderStatus,
  updateOrderFeedback,
  adminEditOrder,
  hardDeleteOrder,
  restoreOrder
} = require('../controllers/adminController');

const { adminLogin } = require('../controllers/adminAuthController');
const protectAdmin = require('../middleware/protectAdmin'); // admin auth middleware

// Public: Admin login
router.post('/login', adminLogin);

// Protected admin APIs
router.get('/orders', protectAdmin, getAllOrders);
router.post('/order-status', protectAdmin, updateOrderStatus);
router.post('/order-feedback', protectAdmin, updateOrderFeedback);

// Admin full-edit an order (PATCH)
/**
 * PATCH /api/admin/orders/:userId/:orderId
 * Body: allowed fields (medicines, address, deliveryOption, paymentMethod, notes, status, date, time, doctorName, etc.)
 */
router.patch('/orders/:userId/:orderId', protectAdmin, adminEditOrder);

// Admin hard-delete (permanent)
router.delete('/orders/:userId/:orderId', protectAdmin, hardDeleteOrder);

// Admin restore soft-deleted order
router.post('/orders/:userId/:orderId/restore', protectAdmin, restoreOrder);

module.exports = router;

