// controllers/userController.js
const User = require('../models/User');
const sendMail = require('../utils/mailer');
const jwt = require('jsonwebtoken');

const createToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Register or login user (keeps backward compatibility)
// - If new user -> create, email admin & user, return token
// - If existing user -> return welcome back + token (so frontend can use the same endpoint)
const registerUser = async (req, res) => {
  try {
    const { name, phone, language, email } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        reply: '⚠️ Name and phone are required.'
      });
    }

    // Validation for name: min 3 characters, starts with a-z or A-Z
    const nameRegex = /^[a-zA-Z][a-zA-Z0-9\s]{2,}$/;
    if (!nameRegex.test(name.trim())) {
      return res.status(400).json({
        reply: '⚠️ Name must be at least 3 characters long and start with a letter.'
      });
    }

    // Validation for phone: exactly 10 digits
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        reply: '⚠️ Phone number must be exactly 10 digits.'
      });
    }

    // Validation for email: basic email format
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          reply: '⚠️ Please provide a valid email address.'
        });
      }
    }

    // Check for existing user by phone
    let user = await User.findOne({ phone });

    if (user) {
      return res.status(400).json({
        reply: '⚠️ Phone number is already registered. Please use a different phone number.'
      });
    }

    // Check for existing user by email if provided
    if (email) {
      const existingEmailUser = await User.findOne({ email });
      if (existingEmailUser) {
        return res.status(400).json({
          reply: '⚠️ Email address is already registered. Please use a different email address.'
        });
      }
    }

    // Create new user
    user = new User({
      name,
      phone,
      language: language || 'english',
      email: email || ''
    });
    await user.save();

    // ✅ Notify Admin
    const adminText = `🆕 New User Registered
👤 Name: ${name}
📞 Phone: ${phone}
🌐 Language: ${language || 'not set'}
📧 Email: ${email || 'not provided'}
`;
    sendMail({
      to: process.env.ADMIN_EMAIL,
      subject: `🆕 New User Registered - ${name}`,
      text: adminText
    }).catch(err => console.error("Admin mail failed:", err.message));

    // ✅ Send Confirmation Email to User
    if (email) {
      const userMailHTML = `
        <div style="font-family: Arial, sans-serif; line-height:1.6; color:#333;">
          <h2 style="color:#2c3e50;">Hello ${name}, 👋</h2>
          <p>🎉 Thank you for registering with <strong>Ranjan Medicine</strong>. Your registration is <b>successful</b> ✅.</p>
          <p>We are happy to serve you and care for your health 💙.</p>
          <p style="margin-top:20px;">👉 Next Steps: You can now order medicines, book appointments, or check your past orders easily.</p>
          <p style="margin-top:25px;">Warm Regards,<br><b>Team Ranjan Medicine</b></p>
          <hr/>
          <p style="font-size:12px; color:#777;">This is an automated confirmation email. For support, contact us anytime 📞.</p>
        </div>
      `;

      sendMail({
        to: email,
        subject: "✅ Registration Successful - Ranjan Medicine",
        html: userMailHTML
      }).catch(err => console.error("User mail failed:", err.message));
    }

    // prepare reply
    const reply =
      language === 'hindi'
        ? `👋 Namaste ${name}! Aap register ho gaye hain ✅\n\n👉 Kripya option chunen:\n1️⃣ Dawa order karein\n2️⃣ Doctor appointment book karein\n3️⃣ 📦 Meri orders dekhein\n4️⃣ 📞 Contact Us`
        : `👋 Hello ${name}! You are registered successfully ✅\n\n👉 Please choose an option:\n1️⃣ Order Medicine\n2️⃣ Book Appointment\n3️⃣ 📦 My Orders\n4️⃣ 📞 Contact Us`;

    const token = createToken(user);
    return res.status(201).json({ reply, user, token });
  } catch (err) {
    console.error("❌ User register error:", err);
    res.status(500).json({ reply: '❌ Server error. Please try again later.' });
  }
};

// Login existing user by phone (simple phone-only login)
const loginUser = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ reply: '⚠️ Phone is required.' });

    const user = await User.findOne({ phone });
    if (!user) return res.status(404).json({ reply: '⚠️ User not found. Please register.' });

    const token = createToken(user);
    const reply =
      user.language === 'hindi'
        ? `👋 Swagat hai wapas ${user.name}!`
        : `👋 Welcome back ${user.name}!`;

    return res.json({ reply, user, token });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ reply: '❌ Server error. Please try again later.' });
  }
};

// Fetch all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error("❌ Fetch users error:", err);
    res.status(500).json({ reply: '❌ Error fetching users.' });
  }
};

// Fetch by phone
const getUserByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ reply: '⚠️ User not found.' });
    }

    const reply =
      user.language === 'hindi'
        ? '📋 Ye aapka data hai:'
        : '📋 Here is your data:';

    res.json({ reply, user });
  } catch (err) {
    console.error("❌ Fetch user error:", err);
    res.status(500).json({ reply: '❌ Error fetching user.' });
  }
};

// Get authenticated user's orders
const getUserOrders = async (req, res) => {
  try {
    const user = req.user;
    return res.json({ orders: user.orders || [] });
  } catch (err) {
    console.error('Fetch user orders error:', err);
    return res.status(500).json({ message: '❌ Error fetching orders.' });
  }
};

// Get orders by phone (fallback for non-authenticated)
const getOrdersByPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({ message: '⚠️ User not found.' });
    }

    return res.json({ orders: user.orders || [] });
  } catch (err) {
    console.error('Fetch orders by phone error:', err);
    return res.status(500).json({ message: '❌ Error fetching orders.' });
  }
};

// Submit feedback for an order
const submitOrderFeedback = async (req, res) => {
  try {
    const { orderId, feedback } = req.body;
    const user = req.user;

    if (!orderId || feedback === undefined) {
      return res.status(400).json({ message: 'orderId and feedback are required' });
    }

    const order = user.orders.id(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.feedback = feedback;
    await user.save();

    res.json({ message: '✅ Feedback submitted successfully', order });
  } catch (err) {
    console.error("❌ Error submitting feedback:", err);
    res.status(500).json({ message: 'Error submitting feedback' });
  }
};

module.exports = { registerUser, loginUser, getAllUsers, getUserByPhone, getUserOrders, getOrdersByPhone, submitOrderFeedback };
