// routes/appointmentRoutes.js
const express = require('express');
const router = express.Router();
const { createAppointment, getMyAppointments, editAppointment, cancelAppointment, hardDeleteAppointment, restoreAppointment } = require('../controllers/appointmentController');
const protect = require('../middleware/protectUser');
const protectAdmin = require('../middleware/protectAdmin');

router.post('/', protect, createAppointment);

// Get my appointments
router.get('/my', protect, getMyAppointments);

// Edit appointment
router.patch('/:id', protect, editAppointment);

// Cancel appointment (soft-delete)
router.delete('/:id', protect, cancelAppointment);

// Hard delete appointment (admin only)
router.delete('/:id/hard', protectAdmin, hardDeleteAppointment);

// Restore appointment (admin only)
router.post('/:id/restore', protectAdmin, restoreAppointment);

module.exports = router;
