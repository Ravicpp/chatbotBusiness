const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const connectDB = require('./config/db');

// Routers
const authRoutes = require('./routers/authRoutes');
const userRoutes = require('./routers/userRoutes');
const orderRoutes = require('./routers/orderRoutes');
const appointmentRoutes = require('./routers/appointmentRoutes');
const adminRoutes = require('./routers/adminRoutes');

connectDB();

const app = express();

// ----- CORS configuration -----
const allowedFrontends = [
  process.env.FRONTEND_URL,       // Vercel frontend URL
  'http://localhost:5173',        // local dev
  'http://localhost:3000'         // local dev
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Postman / server-side requests
    if (allowedFrontends.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: This origin is not allowed'), false);
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept','X-Requested-With']
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve uploads (static files)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);

// default root
app.get('/', (req, res) => res.send('🚀 Ranjan Medicine Chatbot Backend'));

// Global error handler
app.use((err, req, res, next) => {
  console.error('ERROR:', err?.message || err);
  if (err?.message?.startsWith('CORS policy')) {
    return res.status(403).json({ error: 'CORS blocked: ' + err.message });
  }
  res.status(500).json({ error: 'Server error', message: err?.message || err });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🌍 Server running on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
});
