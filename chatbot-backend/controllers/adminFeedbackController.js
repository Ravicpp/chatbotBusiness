// controllers/adminFeedbackController.js
const User = require('../models/User');

/**
 * POST /api/admin/order-feedback
 * Body: { userId, orderId, feedback }
 */
const updateOrderFeedback = async (req, res) => {
  try {
    const { userId, orderId, feedback } = req.body;

    if (!userId || !orderId || feedback === undefined) {
      return res.status(400).json({ message: 'userId, orderId and feedback are required' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const ord = user.orders.id(orderId);
    if (!ord) return res.status(404).json({ message: 'Order not found' });

    ord.feedback = feedback;
    await user.save();

    res.json({ message: '✅ Feedback updated successfully', order: ord });
  } catch (err) {
    console.error("❌ Error updating feedback:", err);
    res.status(500).json({ message: 'Error updating feedback' });
  }
};

module.exports = { updateOrderFeedback };
