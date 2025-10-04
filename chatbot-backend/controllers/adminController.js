// controllers/adminController.js
const mongoose = require('mongoose');
const User = require('../models/User');
const sendMail = require('../utils/mailer');

/**
 * Helper: normalize medicine display from order subdoc
 */
function medsSummaryFromOrder(o) {
  if (!o) return { medicineName: '', quantity: '' };
  if (o.medicines && Array.isArray(o.medicines) && o.medicines.length > 0) {
    return {
      medicineName: o.medicines.map(m => m.name).join(', '),
      quantity: o.medicines.map(m => m.quantity).join(', ')
    };
  }
  // fallback to legacy fields
  return {
    medicineName: o.medicineName || '',
    quantity: o.quantity || ''
  };
}

/**
 * GET /api/admin/orders
 * Query params: page, limit, type, userPhone, startDate, endDate
 */
const getAllOrders = async (req, res) => {
  try {
    let { page = 1, limit = 20, type, status, userPhone, startDate, endDate } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);

    const users = await User.find(
      userPhone ? { phone: userPhone } : {}
    ).sort({ createdAt: -1 });

    let allOrders = [];
    users.forEach(u => {
      u.orders.forEach(o => {
        const meds = medsSummaryFromOrder(o);

        allOrders.push({
          userId: u._id,
          userName: u.name,
          userPhone: u.phone,
          userEmail: u.email,
          language: u.language,
          orderId: o._id,
          type: o.type === 'medicine' ? 'order' : o.type,
          status: o.status || 'pending',
          deleted: !!o.deleted,
          medicineName: meds.medicineName,
          quantity: meds.quantity,
          address: o.address || '',
          prescriptionPhotoUrl: o.prescriptionPhotoUrl || '',
          doctorName: o.doctorName || '',
          patientName: o.patientName || '',
          date: o.date || '',
          time: o.time || '',
          age: o.age || '',
          gender: o.gender || '',
          problem: o.problem || '',
          feedback: o.feedback || '',
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
          // raw order subdoc for admin operations
          _rawOrder: o
        });
      });
    });

    // Filter by type
    if (type && type !== 'all') {
      allOrders = allOrders.filter(o => o.type === type);
    }

    // Filter by status
    if (status && status !== 'all') {
      allOrders = allOrders.filter(o => o.status === status);
    }

    // Filter by date range
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : new Date('1970-01-01');
      const end = endDate ? new Date(endDate) : new Date();
      allOrders = allOrders.filter(o => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    }

    // Sort all orders by createdAt descending for consistent pagination
    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalOrders = allOrders.length;

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedOrders = allOrders.slice(startIndex, endIndex);

    res.json({
      totalOrders,
      page,
      limit,
      orders: paginatedOrders
    });
  } catch (err) {
    console.error("❌ Error fetching orders:", err);
    res.status(500).json({ message: 'Error fetching orders' });
  }
};

/**
 * POST /api/admin/order-status
 * Body: { userId, orderId, status }
 */
const ALLOWED_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'canceled', 'cancelled'];

const updateOrderStatus = async (req, res) => {
  try {
    // Log incoming body for diagnostics (trim/remove in production)
    console.log('updateOrderStatus called with body:', req.body);

    const { userId, orderId, status } = req.body || {};

    if (!userId || !orderId || !status) {
      return res.status(400).json({ message: 'userId, orderId and status are required' });
    }

    if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status.toLowerCase())) {
      return res.status(400).json({ message: `Invalid status. Allowed: ${ALLOWED_STATUSES.join(', ')}` });
    }

    // Find user and subdoc
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ord = user.orders.id(orderId);
    if (!ord) return res.status(404).json({ message: 'Order not found' });

    const before = ord.toObject ? ord.toObject() : JSON.parse(JSON.stringify(ord));

    // update status (normalize to lowercase)
    ord.status = status.toLowerCase();

    // Ensure history exists and push
    try {
      if (!Array.isArray(ord.history)) ord.history = [];
      ord.history.push({
        by: (req.admin && req.admin._id) ? req.admin._id : null,
        role: 'admin',
        when: new Date(),
        action: 'edited',
        before: { status: before.status },
        after: { status: ord.status }
      });
    } catch (hErr) {
      console.warn('Warning: failed to push history:', hErr && hErr.message);
    }

    // Save parent doc to persist subdoc change
    try {
      await user.save();
    } catch (saveErr) {
      console.error('Error saving user document in updateOrderStatus:', saveErr && (saveErr.stack || saveErr));
      return res.status(500).json({ message: 'Error saving order status update' });
    }

    // Send notification email in background (non-blocking)
    if (user.email) {
      (async () => {
        try {
          const meds = medsSummaryFromOrder(ord);
          let subject, text;
          if (ord.type === 'medicine') {
            subject = `Medicine Order Status Update - ${ord.status}`;
            text = `
Hi ${user.name},

Your medicine order status has been updated to: ${ord.status}

Order Details:
- Medicine: ${meds.medicineName}
- Quantity: ${meds.quantity}
- Address: ${ord.address || 'N/A'}

Thank you for choosing Ranjan Medicine!

- Team Ranjan Medicine
            `;
          } else {
            subject = `Appointment Status Update - ${ord.status}`;
            text = `
Hi ${user.name},

Your appointment status has been updated to: ${ord.status}

Appointment Details:
- Doctor: ${ord.doctorName || 'N/A'}
- Date: ${ord.date || 'N/A'}
- Time: ${ord.time || 'N/A'}

Thank you for choosing Ranjan Medicine!

- Team Ranjan Medicine
            `;
          }
          await sendMail({ to: user.email, subject, text });
        } catch (mailErr) {
          console.error('Status update email failed:', mailErr && mailErr.message);
        }
      })();
    }

    const updatedOrder = user.orders.id(orderId);
    return res.json({ message: '✅ Status updated successfully', order: updatedOrder });
  } catch (err) {
    if (err && err.name === 'CastError') {
      console.error('CastError in updateOrderStatus:', err);
      return res.status(400).json({ message: 'Invalid userId or orderId format' });
    }
    console.error('❌ Error updating order status:', err && (err.stack || err));
    return res.status(500).json({ message: 'Internal server error updating order status' });
  }
};

/**
 * POST /api/admin/order-feedback
 * Body: { userId, orderId, feedback }
 */
const updateOrderFeedback = async (req, res) => {
  try {
    const { userId, orderId, feedback } = req.body;
    if (!userId || !orderId) return res.status(400).json({ message: 'userId and orderId are required' });

    // find user and order
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ord = user.orders.id(orderId);
    if (!ord) return res.status(404).json({ message: 'Order not found' });

    const before = ord.toObject ? ord.toObject() : JSON.parse(JSON.stringify(ord));

    // set feedback on subdoc
    ord.feedback = feedback || '';

    // add history if exists
    try {
      if (!Array.isArray(ord.history)) ord.history = [];
      ord.history.push({
        by: req.admin?._id || null,
        role: 'admin',
        when: new Date(),
        action: 'feedback_updated',
        before: { feedback: before.feedback },
        after: { feedback: ord.feedback }
      });
    } catch (hErr) {
      console.warn('Warning: failed to push history for feedback:', hErr && hErr.message);
    }

    // save parent document
    await user.save();

    // return fresh subdoc
    const updatedOrder = user.orders.id(orderId);
    res.json({ message: '✅ Feedback saved', order: updatedOrder });
  } catch (err) {
    if (err && err.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid userId or orderId format' });
    }
    console.error('❌ Error updating feedback:', err && (err.stack || err));
    res.status(500).json({ message: 'Error updating feedback' });
  }
};

/**
 * PATCH /api/admin/orders/:userId/:orderId
 * Admin full-edit on an order (allowed fields)
 */
const adminEditOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    const payload = req.body || {}; // allowed fields

    if (!userId || !orderId) return res.status(400).json({ message: 'userId and orderId are required in params' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ord = user.orders.id(orderId);
    if (!ord) return res.status(404).json({ message: 'Order not found' });

    const allowed = ['medicines', 'address', 'deliveryOption', 'paymentMethod', 'notes', 'status', 'date', 'time', 'doctorName', 'patientName', 'age', 'gender', 'problem', 'prescriptionPhotoUrl'];
    const before = ord.toObject ? ord.toObject() : JSON.parse(JSON.stringify(ord));

    // apply allowed fields
    allowed.forEach(k => {
      if (Object.prototype.hasOwnProperty.call(payload, k)) {
        ord[k] = payload[k];
      }
    });

    // history
    try {
      if (!Array.isArray(ord.history)) ord.history = [];
      ord.history.push({
        by: req.admin?._id || null,
        role: 'admin',
        when: new Date(),
        action: 'edited_by_admin',
        before,
        after: ord.toObject ? ord.toObject() : JSON.parse(JSON.stringify(ord))
      });
    } catch (hErr) {
      console.warn('Warning: failed to push history for adminEditOrder:', hErr && hErr.message);
    }

    await user.save();

    // optional notify
    if (user.email) {
      const meds = medsSummaryFromOrder(ord);
      const subject = ord.type === 'medicine' ? 'Your order was edited by admin' : 'Your appointment was edited by admin';
      let text = `Hello ${user.name},\n\nAn admin has updated your ${ord.type === 'medicine' ? 'order' : 'appointment'} (ID: ${orderId}).\n\nUpdated details:\n`;

      if (ord.type === 'medicine') {
        text += `- Medicine: ${meds.medicineName}\n- Quantity: ${meds.quantity}\n- Address: ${ord.address || 'N/A'}\n`;
      } else {
        text += `- Doctor: ${ord.doctorName || 'N/A'}\n- Date: ${ord.date || 'N/A'}\n- Time: ${ord.time || 'N/A'}\n`;
      }
      text += `\nIf you have questions, please contact us.\n\n- Team Ranjan Medicine`;

      sendMail({ to: user.email, subject, text }).catch(e => console.error('Admin edit email failed:', e && e.message));
    }

    res.json({ message: '✅ Order edited by admin', order: ord });
  } catch (err) {
    console.error('❌ Error admin editing order:', err && (err.stack || err));
    res.status(500).json({ message: 'Error editing order' });
  }
};

/**
 * DELETE /api/admin/orders/:userId/:orderId
 * Admin hard-delete (permanent remove)
 */
const hardDeleteOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    if (!userId || !orderId) return res.status(400).json({ message: 'userId and orderId required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ord = user.orders.id(orderId);
    if (!ord) return res.status(404).json({ message: 'Order not found' });

    user.orders.pull(orderId);
    await user.save();

    if (user.email) {
      const meds = medsSummaryFromOrder(ord);
      const subject = ord.type === 'medicine' ? 'Your order was permanently deleted by admin' : 'Your appointment was permanently deleted by admin';
      const text = `Hello ${user.name},\n\nAn admin has permanently deleted your ${ord.type === 'medicine' ? 'order' : 'appointment'} (ID: ${orderId}).\nIf you believe this was a mistake, contact us.\n\n- Team Ranjan Medicine`;
      sendMail({ to: user.email, subject, text }).catch(e => console.error('Hard delete email failed:', e && e.message));
    }

    res.json({ message: '✅ Order permanently deleted' });
  } catch (err) {
    console.error('❌ Error hard deleting order:', err && (err.stack || err));
    res.status(500).json({ message: 'Error deleting order' });
  }
};

/**
 * POST /api/admin/orders/:userId/:orderId/restore
 * Admin restore a soft-deleted order
 */
const restoreOrder = async (req, res) => {
  try {
    const { userId, orderId } = req.params;
    if (!userId || !orderId) return res.status(400).json({ message: 'userId and orderId required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ord = user.orders.id(orderId);
    if (!ord) return res.status(404).json({ message: 'Order not found' });

    const before = ord.toObject ? ord.toObject() : JSON.parse(JSON.stringify(ord));
    ord.deleted = false;
    if (ord.status === 'canceled' || ord.status === 'cancelled') ord.status = 'pending';

    try {
      if (!Array.isArray(ord.history)) ord.history = [];
      ord.history.push({
        by: req.admin?._id || null,
        role: 'admin',
        when: new Date(),
        action: 'restored',
        before,
        after: ord.toObject ? ord.toObject() : JSON.parse(JSON.stringify(ord))
      });
    } catch (hErr) {
      console.warn('Warning: failed to push history for restore:', hErr && hErr.message);
    }

    await user.save();

    if (user.email) {
      sendMail({
        to: user.email,
        subject: 'Your order has been restored',
        text: `Hello ${user.name},\n\nAn admin has restored your order (ID: ${orderId}). It is now set to pending. If you did not request this, contact us.\n\n- Team Ranjan Medicine`
      }).catch(e => console.error('Restore email failed:', e && e.message));
    }

    res.json({ message: '✅ Order restored', order: ord });
  } catch (err) {
    console.error('❌ Error restoring order:', err && (err.stack || err));
    res.status(500).json({ message: 'Error restoring order' });
  }
};

module.exports = {
  getAllOrders,
  updateOrderStatus,
  updateOrderFeedback,
  adminEditOrder,
  hardDeleteOrder,
  restoreOrder
};
