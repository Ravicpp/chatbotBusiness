// controllers/orderController.js
const User = require('../models/User');
const sendMail = require('../utils/mailer');

/**
 * Create a medicine order
 * - Preferred flow: protect middleware sets req.user
 * - Backward-compatible: if req.user not present, server will try to find user by phone from body
 */
const createOrder = async (req, res) => {
  try {
    // Accept either authenticated user (req.user) or phone in body (legacy)
    const authUser = req.user || null;
    const { phone, medicines, address, deliveryOption = 'pickup', paymentMethod = 'COD', notes } = req.body;

    // If no auth user and no phone provided -> require registration/login
    if (!authUser && !phone) {
      return res.status(401).json({ reply: '⚠️ Not authorized. Please login or provide phone.' });
    }

    // Resolve user: prefer req.user, otherwise lookup by phone
    let user;
    if (authUser) {
      user = await User.findById(authUser._id);
      if (!user) return res.status(401).json({ reply: '⚠️ User not found. Please login again.' });
    } else {
      user = await User.findOne({ phone });
      if (!user) return res.status(404).json({ reply: '⚠️ User not found. Please register first.' });
    }

    // Validate medicines array
    if (!Array.isArray(medicines) || medicines.length === 0) {
      return res.status(400).json({ reply: '⚠️ Please provide at least one medicine with quantity.' });
    }
    const invalidItem = medicines.find(m => !m || !m.name || !String(m.name).trim() || !m.quantity || Number(m.quantity) <= 0);
    if (invalidItem) {
      return res.status(400).json({ reply: '⚠️ Each medicine must have a valid name and quantity (>0).' });
    }

    // Validate delivery & address
    const deliveryOpt = String(deliveryOption).toLowerCase();
    if (deliveryOpt === 'home delivery' && (!address || !String(address).trim())) {
      return res.status(400).json({ reply: '⚠️ Address is required for home delivery.' });
    }

    // Normalize payment method
    const payment = String(paymentMethod || 'COD').toUpperCase();
    if (!['COD', 'UPI'].includes(payment)) {
      return res.status(400).json({ reply: '⚠️ Payment method must be COD or UPI.' });
    }

    // Create order object (subdocument)
    const order = {
      type: 'medicine',
      medicines: medicines.map(m => ({ name: String(m.name).trim(), quantity: String(m.quantity) })),
      address: deliveryOpt === 'home delivery' ? String(address).trim() : '',
      deliveryOption: deliveryOpt === 'home delivery' ? 'home delivery' : 'pickup',
      paymentMethod: payment,
      notes: notes ? String(notes).trim() : '',
      status: 'pending',
      createdAt: new Date(),
      history: order?.history || [] // ensure history exists if schema expects it
    };

    // Push and save
    user.orders.push(order);
    await user.save();

    // Get the saved order (last element)
    const savedOrder = user.orders[user.orders.length - 1];

    // send admin email (await + try/catch so it is attempted but won't break order creation)
    try {
      const adminText = `📦 New Medicine Order
👤 User: ${user.name}
📞 Phone: ${user.phone}
💊 Medicines:
${(savedOrder.medicines || []).map(m => `   • ${m.name} - ${m.quantity}`).join('\n')}
🚚 Delivery: ${savedOrder.deliveryOption}
🏠 Address: ${savedOrder.address || 'Pickup from shop'}
💳 Payment: ${savedOrder.paymentMethod}
📝 Notes: ${savedOrder.notes || 'None'}
`;
      await sendMail({
        to: process.env.ADMIN_EMAIL,
        subject: `📦 New Medicine Order - ${user.name}`,
        text: adminText
      });
      console.log('Admin order notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    // send user email if available (await + try/catch)
    if (user.email) {
      try {
        const medicinesTable = `
<table border="1" style="border-collapse: collapse; width: 100%; max-width: 400px;">
  <tr style="background-color: #f2f2f2;">
    <th style="padding: 8px; text-align: left;">Medicine</th>
    <th style="padding: 8px; text-align: left;">Quantity</th>
  </tr>
  ${(savedOrder.medicines || []).map(m => `<tr><td style="padding: 8px;">${m.name}</td><td style="padding: 8px;">${m.quantity}</td></tr>`).join('')}
</table>
        `;
        const framedMessage = `
<div style="border: 2px solid #007bff; padding: 10px; margin: 10px 0; background-color: #e7f3ff; border-radius: 5px;">
  <p style="margin: 0; font-weight: bold;">Trust my medicine and so the timeline it can be delivered in 30 min okay and waiting for confirmation.</p>
</div>
        `;
        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Order Confirmation</title>
</head>
<body>
  <h2>Hi ${user.name},</h2>
  <p>✅ Your medicine order has been received at Ranjan Medicine!</p>
  <h3>Order Details:</h3>
  ${medicinesTable}
  <p><strong>🚚 Delivery:</strong> ${savedOrder.deliveryOption}</p>
  <p><strong>🏠 Address:</strong> ${savedOrder.address || 'Pickup from shop'}</p>
  <p><strong>💳 Payment Method:</strong> ${savedOrder.paymentMethod}</p>
  <p><strong>📝 Notes:</strong> ${savedOrder.notes || 'Not provided'}</p>
  ${framedMessage}
  <p>Thank you for trusting Ranjan Medicine. We ensure timely delivery and genuine products.</p>
  <p>Stay healthy! 🌿</p>
  <p>- Ranjan Medicine Team</p>
</body>
</html>
        `;
        const emailText = `
Hi ${user.name},

✅ Your medicine order has been received at Ranjan Medicine!

Order Details:
${(savedOrder.medicines || []).map(m => `💊 ${m.name} - ${m.quantity}`).join('\n')}
🚚 Delivery: ${savedOrder.deliveryOption}
🏠 Address: ${savedOrder.address || 'Pickup from shop'}
💳 Payment Method: ${savedOrder.paymentMethod}
📝 Notes: ${savedOrder.notes || 'Not provided'}

Trust my medicine and so the timeline it can be delivered in 30 min okay and waiting for confirmation.

Thank you for trusting Ranjan Medicine. We ensure timely delivery and genuine products.  
Stay healthy! 🌿

- Ranjan Medicine Team
        `;
        await sendMail({
          to: user.email,
          subject: 'Your Medicine Order is Received ✅',
          text: emailText,
          html: emailHtml
        });
        console.log('User order confirmation sent');
      } catch (err) {
        console.error('User mail failed:', err?.message || err);
      }
    }

    // chatbot reply
    const reply = user.language === 'hindi'
      ? `✅ Aapka order receive ho gaya hai. Hum jald contact karenge.\n1️⃣ Main Menu`
      : `✅ Your order is received. We will contact you soon.\n1️⃣ Main Menu`;

    return res.status(201).json({ reply, order: savedOrder });

  } catch (err) {
    console.error('❌ Create order error:', err);
    return res.status(500).json({ reply: '❌ Error creating order.' });
  }
};

/**
 * Get authenticated user's orders (exclude deleted by default)
 */
const getMyOrders = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    // Filter orders: exclude deleted, or include if query param says so
    const includeDeleted = req.query.includeDeleted === 'true';
    const orders = user.orders.filter(order => order.type === 'medicine' && (includeDeleted || !order.deleted));

    return res.status(200).json({ orders });
  } catch (err) {
    console.error('❌ Get my orders error:', err);
    return res.status(500).json({ message: '❌ Error fetching orders.' });
  }
};

/**
 * Edit an order (user only, if pending and within edit window)
 */
const editOrder = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    const { id } = req.params;
    const { medicines, address, deliveryOption, paymentMethod, notes } = req.body;

    // Find the order
    const orderIndex = user.orders.findIndex(o => o._id.toString() === id && o.type === 'medicine');
    if (orderIndex === -1) return res.status(404).json({ message: '❌ Order not found.' });

    const order = user.orders[orderIndex];

    // Check permissions: user can edit their own, admin can edit any
    const isAdmin = req.user.role === 'admin'; // assuming req.user has role, or check admin email
    if (!isAdmin && order.deleted) return res.status(400).json({ message: '❌ Cannot edit cancelled order.' });

    // Check edit window: only if pending and within EDIT_WINDOW_MINUTES
    const editWindowMinutes = parseInt(process.env.EDIT_WINDOW_MINUTES) || 60; // default 60 min
    const timeDiff = (new Date() - new Date(order.createdAt)) / (1000 * 60);
    if (order.status !== 'pending' || timeDiff > editWindowMinutes) {
      return res.status(400).json({ message: `❌ Order cannot be edited. Must be pending and within ${editWindowMinutes} minutes.` });
    }

    // Validate updates
    if (medicines !== undefined) {
      if (!Array.isArray(medicines) || medicines.length === 0) {
        return res.status(400).json({ message: '❌ At least one medicine required.' });
      }
      const invalid = medicines.find(m => !m.name || !String(m.name).trim() || !m.quantity || Number(m.quantity) <= 0);
      if (invalid) return res.status(400).json({ message: '❌ Invalid medicine data.' });
    }

    if (deliveryOption !== undefined) {
      const opt = String(deliveryOption).toLowerCase();
      if (!['pickup', 'home delivery'].includes(opt)) return res.status(400).json({ message: '❌ Invalid delivery option.' });
      if (opt === 'home delivery' && (!address || !String(address).trim())) {
        return res.status(400).json({ message: '❌ Address required for home delivery.' });
      }
    }

    if (paymentMethod !== undefined) {
      const pay = String(paymentMethod).toUpperCase();
      if (!['COD', 'UPI'].includes(pay)) return res.status(400).json({ message: '❌ Invalid payment method.' });
    }

    // Capture before snapshot
    const before = {
      medicines: order.medicines,
      address: order.address,
      deliveryOption: order.deliveryOption,
      paymentMethod: order.paymentMethod,
      notes: order.notes
    };

    // Apply changes
    if (medicines !== undefined) order.medicines = medicines.map(m => ({ name: String(m.name).trim(), quantity: String(m.quantity) }));
    if (address !== undefined) order.address = String(address).trim();
    if (deliveryOption !== undefined) order.deliveryOption = String(deliveryOption).toLowerCase();
    if (paymentMethod !== undefined) order.paymentMethod = String(paymentMethod).toUpperCase();
    if (notes !== undefined) order.notes = notes ? String(notes).trim() : '';

    // Append history
    order.history.push({
      by: req.user._id,
      role: isAdmin ? 'admin' : 'user',
      action: 'edited',
      before,
      after: {
        medicines: order.medicines,
        address: order.address,
        deliveryOption: order.deliveryOption,
        paymentMethod: order.paymentMethod,
        notes: order.notes
      }
    });

    await user.save();

    // Send emails
    try {
      const adminText = `📝 Order Edited
👤 User: ${user.name}
📞 Phone: ${user.phone}
🆔 Order ID: ${order._id}
Before: ${JSON.stringify(before, null, 2)}
After: ${JSON.stringify(order.history[order.history.length - 1].after, null, 2)}
`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `📝 Order Edited - ${user.name}`, text: adminText });
      console.log('Admin order edited notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    if (user.email) {
      try {
        const userText = `
Hi ${user.name},

Your order has been updated.

Order ID: ${order._id}
Changes: Please check your order details.

- Ranjan Medicine Team
`;
        await sendMail({ to: user.email, subject: 'Order Updated', text: userText });
        console.log('User order update mail sent');
      } catch (err) {
        console.error('User mail failed:', err?.message || err);
      }
    }

    return res.status(200).json({ message: '✅ Order updated successfully.', order });
  } catch (err) {
    console.error('❌ Edit order error:', err);
    return res.status(500).json({ message: '❌ Error editing order.' });
  }
};

/**
 * Cancel an order (soft-delete)
 */
const cancelOrder = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    const { id } = req.params;

    // Find the order
    const orderIndex = user.orders.findIndex(o => o._id.toString() === id && o.type === 'medicine');
    if (orderIndex === -1) return res.status(404).json({ message: '❌ Order not found.' });

    const order = user.orders[orderIndex];

    if (order.deleted) return res.status(400).json({ message: '❌ Order already cancelled.' });

    // Capture before
    const before = { status: order.status, deleted: order.deleted };

    // Soft-delete
    order.status = 'cancelled';
    order.deleted = true;
    order.deletedAt = new Date();
    order.deletedBy = req.user._id;

    // Append history
    order.history.push({
      by: req.user._id,
      role: req.user.role === 'admin' ? 'admin' : 'user',
      action: 'cancelled',
      before,
      after: { status: order.status, deleted: order.deleted }
    });

    await user.save();

    // Send emails
    try {
      const adminText = `❌ Order Cancelled
👤 User: ${user.name}
📞 Phone: ${user.phone}
🆔 Order ID: ${order._id}
`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `❌ Order Cancelled - ${user.name}`, text: adminText });
      console.log('Admin order cancelled notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    if (user.email) {
      try {
        const userText = `
Hi ${user.name},

Your order has been cancelled.

Order ID: ${order._id}

- Ranjan Medicine Team
`;
        await sendMail({ to: user.email, subject: 'Order Cancelled', text: userText });
        console.log('User order cancelled mail sent');
      } catch (err) {
        console.error('User mail failed:', err?.message || err);
      }
    }

    return res.status(200).json({ message: '✅ Order cancelled successfully.', order });
  } catch (err) {
    console.error('❌ Cancel order error:', err);
    return res.status(500).json({ message: '❌ Error cancelling order.' });
  }
};

/**
 * Hard delete an order (admin only)
 */
const hardDeleteOrder = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    const { id } = req.params;

    // Find the order
    const orderIndex = user.orders.findIndex(o => o._id.toString() === id && o.type === 'medicine');
    if (orderIndex === -1) return res.status(404).json({ message: '❌ Order not found.' });

    const order = user.orders[orderIndex];

    // Remove the order subdocument
    user.orders.splice(orderIndex, 1);

    // Log admin action (append to a dummy history or just save)
    // Since order is deleted, we can log in a separate audit if needed, but for now, just save

    await user.save();

    // Send admin email
    try {
      const adminText = `🗑️ Order Hard Deleted
👤 User: ${user.name}
📞 Phone: ${user.phone}
🆔 Order ID: ${id}
By Admin: ${req.user.name || req.user.email}
`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `🗑️ Order Hard Deleted - ${user.name}`, text: adminText });
      console.log('Admin order hard delete notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    return res.status(200).json({ message: '✅ Order permanently deleted.' });
  } catch (err) {
    console.error('❌ Hard delete order error:', err);
    return res.status(500).json({ message: '❌ Error deleting order.' });
  }
};

/**
 * Restore a cancelled order (admin only)
 */
const restoreOrder = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    const { id } = req.params;

    // Find the order
    const orderIndex = user.orders.findIndex(o => o._id.toString() === id && o.type === 'medicine');
    if (orderIndex === -1) return res.status(404).json({ message: '❌ Order not found.' });

    const order = user.orders[orderIndex];

    if (!order.deleted) return res.status(400).json({ message: '❌ Order not cancelled.' });

    // Capture before
    const before = { status: order.status, deleted: order.deleted };

    // Restore
    order.status = 'pending';
    order.deleted = false;
    order.deletedAt = undefined;
    order.deletedBy = undefined;

    // Append history
    order.history.push({
      by: req.user._id,
      role: 'admin',
      action: 'restored',
      before,
      after: { status: order.status, deleted: order.deleted }
    });

    await user.save();

    // Send emails
    try {
      const adminText = `🔄 Order Restored
👤 User: ${user.name}
📞 Phone: ${user.phone}
🆔 Order ID: ${order._id}
`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `🔄 Order Restored - ${user.name}`, text: adminText });
      console.log('Admin order restored notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    if (user.email) {
      try {
        const userText = `
Hi ${user.name},

Your cancelled order has been restored.

Order ID: ${order._id}

- Ranjan Medicine Team
`;
        await sendMail({ to: user.email, subject: 'Order Restored', text: userText });
        console.log('User order restored mail sent');
      } catch (err) {
        console.error('User mail failed:', err?.message || err);
      }
    }

    return res.status(200).json({ message: '✅ Order restored successfully.', order });
  } catch (err) {
    console.error('❌ Restore order error:', err);
    return res.status(500).json({ message: '❌ Error restoring order.' });
  }
};

module.exports = { createOrder, getMyOrders, editOrder, cancelOrder, hardDeleteOrder, restoreOrder };
