// server.js
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const connectDB = require('./config/db');

// Routers
const authRoutes = require('./routers/authRoutes'); // auth (register / login) - if you have it
const userRoutes = require('./routers/userRoutes'); // user endpoints (profile, etc.)
const orderRoutes = require('./routers/orderRoutes');
const appointmentRoutes = require('./routers/appointmentRoutes');
const adminRoutes = require('./routers/adminRoutes'); // updated admin routes

// Connect Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve uploads (static files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
// Keep mounting order meaningful: auth/user first, admin later
app.use('/api/auth', authRoutes);    // optional: keep if you have a separate auth router
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);  // admin login + protected admin APIs

// default root
app.get('/', (req, res) => res.send('🚀 Ranjan Medicine Chatbot Backend'));

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🌍 Server running on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
});


