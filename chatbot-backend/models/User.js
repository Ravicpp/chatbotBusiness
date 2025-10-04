
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  type: { type: String, enum: ['medicine', 'appointment'], required: true },

  // medicine order fields
  medicines: [
    {
      name: String,
      quantity: String
    }
  ],
  address: String,
  deliveryOption: { type: String, enum: ['pickup', 'home delivery'] },
  paymentMethod: { type: String, enum: ['COD', 'UPI'] },
  totalPrice: { type: Number, default: 0 },
  notes: String,

  // appointment fields
  patientName: { type: String, default: '' }, // new optional patient name field
  doctorName: String,
  age: String,
  gender: String,
  problem: String,
  date: String,
  time: String,

  // common fields
  status: { type: String, default: 'pending' },
  feedback: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },

  // history and audit
  history: [
    {
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // user or admin id
      role: { type: String, enum: ['user', 'admin'], required: true },
      when: { type: Date, default: Date.now },
      action: { type: String, enum: ['created', 'edited', 'cancelled', 'restored', 'hard-deleted'], required: true },
      before: mongoose.Schema.Types.Mixed, // snapshot of previous state
      after: mongoose.Schema.Types.Mixed   // snapshot of new state
    }
  ],

  // soft-delete fields
  deleted: { type: Boolean, default: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } // user or admin id
});

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [3, 'Name must be at least 3 characters long'],
    validate: {
      validator: function(v) {
        return /^[a-zA-Z][a-zA-Z0-9\s]*$/.test(v);
      },
      message: 'Name must start with a letter and can contain letters, numbers, and spaces'
    }
  },
  phone: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: function(v) {
        return /^\d{10}$/.test(v);
      },
      message: 'Phone number must be exactly 10 digits'
    }
  },
  language: { type: String, enum: ['english', 'hindi'], default: 'english' },
  email: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true; // Allow empty
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Please provide a valid email address'
    }
  },
  orders: [orderSchema]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);

