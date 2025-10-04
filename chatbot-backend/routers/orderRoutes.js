// routes/orderRoutes.js
const express = require('express');
const router = express.Router();

const { createOrder, getMyOrders, editOrder, cancelOrder, hardDeleteOrder, restoreOrder } = require('../controllers/orderController');
const protect = require('../middleware/protectUser');
const protectAdmin = require('../middleware/protectAdmin'); // already present in your project

// Create order (authenticated users only)
router.post('/', protect, createOrder);

// Get my orders
router.get('/my', protect, getMyOrders);

// Edit order
router.patch('/:id', protect, editOrder);

// Cancel order (soft-delete)
router.delete('/:id', protect, cancelOrder);

// Hard delete order (admin only)
router.delete('/:id/hard', protectAdmin, hardDeleteOrder);

// Restore order (admin only)
router.post('/:id/restore', protectAdmin, restoreOrder);

module.exports = router;
