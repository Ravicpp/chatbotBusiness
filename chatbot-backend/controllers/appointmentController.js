// controllers/appointmentController.js
const User = require('../models/User');
const sendMail = require('../utils/mailer');

// Predefined doctor list
const DOCTORS = ['Dr. Sharma', 'Dr. Verma', 'Dr. Gupta'];

const createAppointment = async (req, res) => {
  try {
    const { doctorName, date, time, age, gender, problem, patientName } = req.body;

    // Validate doctor
    if (!DOCTORS.includes(doctorName)) {
      return res.status(400).json({
        reply: `⚠️ Invalid doctor selected. Please choose from:\n${DOCTORS.map((d, i) => `${i+1}️⃣ ${d}`).join('\n')}`
      });
    }

    const user = req.user;
    if (!user) return res.status(401).json({ reply: '⚠️ Not authorized. Please login.' });

    // Check overlapping appointments
    const allUsersWithAppointments = await User.find({ 'orders.type': 'appointment' });
    const requestedTime = new Date(`${date}T${time}`);
    const overlapping = allUsersWithAppointments.some(u =>
      u.orders.some(o =>
        o.type === 'appointment' &&
        o.doctorName === doctorName &&
        o.date && o.time &&
        Math.abs(new Date(o.date + 'T' + o.time) - requestedTime) < 60 * 60 * 1000
      )
    );

    if (overlapping) {
      const suggestedTime = new Date(requestedTime.getTime() + 60 * 60 * 1000);
      return res.json({
        reply: `⚠️ Doctor busy at ${time}. Suggested next available: ⏰ ${suggestedTime.toTimeString().slice(0,5)}`
      });
    }

    const appt = {
      type: 'appointment',
      patientName: patientName || user.name, // Use provided patient name or default to user name
      doctorName,
      date,
      time,
      age,
      gender,
      problem,
      createdAt: new Date(),
      status: 'pending',
      deleted: false,
      history: []
    };

    user.orders.push(appt);
    await user.save();

    // Get saved appointment (last pushed)
    const savedAppt = user.orders[user.orders.length - 1];

    // Email notification to admin
    try {
      const adminText = `🩺 New Appointment
User: ${user.name}
Phone: ${user.phone}
Doctor: ${doctorName}
Date: ${date} ${time}
Age: ${age}
Gender: ${gender}
Problem: ${problem}`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `New Appointment - ${user.name}`, text: adminText });
      console.log('Admin appointment notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    // Email to user if available
    if (user.email) {
      try {
        const userEmailBody = `
Hi ${user.name}, ✅

Your appointment with 👨‍⚕️ ${doctorName} on 📅 ${date} at ⏰ ${time} is successfully booked.

🏥 Ranjan Medicine Services:
- 💊 Medicine Orders
- 🩺 Doctor Appointments
- 🏠 Home Delivery

Thank you for trusting us! 🙏

- Ranjan Medicine
        `;
        await sendMail({ to: user.email, subject: 'Appointment Confirmed', text: userEmailBody });
        console.log('User appointment confirmation sent');
      } catch (err) {
        console.error('User mail failed:', err?.message || err);
      }
    }

    const reply = user.language === 'hindi'
      ? `✅ Aapki appointment book ho gayi hai 👨‍⚕️ ${doctorName} ke saath.\n📅 ${date} ⏰ ${time}\n\n1️⃣ Main Menu`
      : `✅ Your appointment is booked with 👨‍⚕️ ${doctorName}.\n📅 ${date} ⏰ ${time}\n\n1️⃣ Main Menu`;

    res.json({ reply, appt: savedAppt });
  } catch (err) {
    console.error('❌ Create appointment error:', err);
    res.status(500).json({ reply: '❌ Error booking appointment.' });
  }
};

/**
 * Get authenticated user's appointments (exclude deleted by default)
 */
const getMyAppointments = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    // Filter orders: exclude deleted, or include if query param says so
    const includeDeleted = req.query.includeDeleted === 'true';
    const appointments = user.orders.filter(order => order.type === 'appointment' && (includeDeleted || !order.deleted));

    return res.status(200).json({ appointments });
  } catch (err) {
    console.error('❌ Get my appointments error:', err);
    return res.status(500).json({ message: '❌ Error fetching appointments.' });
  }
};

/**
 * Edit an appointment (user only, if pending and within edit window)
 */
const editAppointment = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    const { id } = req.params;
    const { doctorName, date, time, age, gender, problem, patientName } = req.body;

    // Find the appointment
    const apptIndex = user.orders.findIndex(o => o._id.toString() === id && o.type === 'appointment');
    if (apptIndex === -1) return res.status(404).json({ message: '❌ Appointment not found.' });

    const appt = user.orders[apptIndex];

    // Check permissions: user can edit their own, admin can edit any
    const isAdmin = req.user.role === 'admin';
    if (!isAdmin && appt.deleted) return res.status(400).json({ message: '❌ Cannot edit cancelled appointment.' });

    // Check edit window: only if pending and within EDIT_WINDOW_MINUTES
    const editWindowMinutes = parseInt(process.env.EDIT_WINDOW_MINUTES) || 60;
    const timeDiff = (new Date() - new Date(appt.createdAt)) / (1000 * 60);
    if (appt.status !== 'pending' || timeDiff > editWindowMinutes) {
      return res.status(400).json({ message: `❌ Appointment cannot be edited. Must be pending and within ${editWindowMinutes} minutes.` });
    }

    // Validate updates
    if (doctorName !== undefined && !DOCTORS.includes(doctorName)) {
      return res.status(400).json({ message: `❌ Invalid doctor. Choose from: ${DOCTORS.join(', ')}` });
    }

    if (date !== undefined) {
      const d = new Date(date);
      if (isNaN(d.getTime())) return res.status(400).json({ message: '❌ Invalid date.' });
    }

    if (time !== undefined) {
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(time)) return res.status(400).json({ message: '❌ Invalid time format (HH:MM).' });
    }

    if (age !== undefined) {
      const a = parseInt(age);
      if (isNaN(a) || a < 1 || a > 120) return res.status(400).json({ message: '❌ Age must be between 1-120.' });
    }

    if (gender !== undefined && !['male', 'female', 'other'].includes(String(gender).toLowerCase())) {
      return res.status(400).json({ message: '❌ Gender must be male, female, or other.' });
    }

    // Check overlapping if doctor, date, or time changed
    if ((doctorName !== undefined || date !== undefined || time !== undefined) && (doctorName && date && time)) {
      const allUsersWithAppointments = await User.find({ 'orders.type': 'appointment' });
      const requestedTime = new Date(`${date}T${time}`);
      const overlapping = allUsersWithAppointments.some(u =>
        u.orders.some(o =>
          o.type === 'appointment' &&
          o._id.toString() !== id && // exclude current
          o.doctorName === doctorName &&
          o.date && o.time &&
          Math.abs(new Date(o.date + 'T' + o.time) - requestedTime) < 60 * 60 * 1000
        )
      );
      if (overlapping) {
        return res.status(400).json({ message: '❌ Doctor busy at this time. Please choose another slot.' });
      }
    }

    // Capture before snapshot
    const before = {
      patientName: appt.patientName,
      doctorName: appt.doctorName,
      date: appt.date,
      time: appt.time,
      age: appt.age,
      gender: appt.gender,
      problem: appt.problem
    };

    // Apply changes
    if (patientName !== undefined) appt.patientName = String(patientName).trim() || user.name;
    if (doctorName !== undefined) appt.doctorName = doctorName;
    if (date !== undefined) appt.date = date;
    if (time !== undefined) appt.time = time;
    if (age !== undefined) appt.age = String(age);
    if (gender !== undefined) appt.gender = String(gender).toLowerCase();
    if (problem !== undefined) appt.problem = problem ? String(problem).trim() : '';

    // Append history
    appt.history.push({
      by: req.user._id,
      role: isAdmin ? 'admin' : 'user',
      action: 'edited',
      before,
      after: {
        patientName: appt.patientName,
        doctorName: appt.doctorName,
        date: appt.date,
        time: appt.time,
        age: appt.age,
        gender: appt.gender,
        problem: appt.problem
      }
    });

    await user.save();

    // Send emails
    try {
      const adminText = `📝 Appointment Edited
👤 User: ${user.name}
📞 Phone: ${user.phone}
🆔 Appointment ID: ${appt._id}
Before: ${JSON.stringify(before, null, 2)}
After: ${JSON.stringify(appt.history[appt.history.length - 1].after, null, 2)}
`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `📝 Appointment Edited - ${user.name}`, text: adminText });
      console.log('Admin appointment edited notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    if (user.email) {
      try {
        const userText = `
Hi ${user.name},

Your appointment has been updated.

Appointment ID: ${appt._id}
Changes: Please check your appointment details.

- Ranjan Medicine Team
`;
        await sendMail({ to: user.email, subject: 'Appointment Updated', text: userText });
        console.log('User appointment update mail sent');
      } catch (err) {
        console.error('User mail failed:', err?.message || err);
      }
    }

    return res.status(200).json({ message: '✅ Appointment updated successfully.', appointment: appt });
  } catch (err) {
    console.error('❌ Edit appointment error:', err);
    return res.status(500).json({ message: '❌ Error editing appointment.' });
  }
};

/**
 * Cancel an appointment (soft-delete)
 */
const cancelAppointment = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    const { id } = req.params;

    // Find the appointment
    const apptIndex = user.orders.findIndex(o => o._id.toString() === id && o.type === 'appointment');
    if (apptIndex === -1) return res.status(404).json({ message: '❌ Appointment not found.' });

    const appt = user.orders[apptIndex];

    if (appt.deleted) return res.status(400).json({ message: '❌ Appointment already cancelled.' });

    // Capture before
    const before = { status: appt.status, deleted: appt.deleted };

    // Soft-delete
    appt.status = 'cancelled';
    appt.deleted = true;
    appt.deletedAt = new Date();
    appt.deletedBy = req.user._id;

    // Append history
    appt.history.push({
      by: req.user._id,
      role: req.user.role === 'admin' ? 'admin' : 'user',
      action: 'cancelled',
      before,
      after: { status: appt.status, deleted: appt.deleted }
    });

    await user.save();

    // Send emails
    try {
      const adminText = `❌ Appointment Cancelled
👤 User: ${user.name}
📞 Phone: ${user.phone}
🆔 Appointment ID: ${appt._id}
`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `❌ Appointment Cancelled - ${user.name}`, text: adminText });
      console.log('Admin appointment cancelled notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    if (user.email) {
      try {
        const userText = `
Hi ${user.name},

Your appointment has been cancelled.

Appointment ID: ${appt._id}

- Ranjan Medicine Team
`;
        await sendMail({ to: user.email, subject: 'Appointment Cancelled', text: userText });
        console.log('User appointment cancelled mail sent');
      } catch (err) {
        console.error('User mail failed:', err?.message || err);
      }
    }

    return res.status(200).json({ message: '✅ Appointment cancelled successfully.', appointment: appt });
  } catch (err) {
    console.error('❌ Cancel appointment error:', err);
    return res.status(500).json({ message: '❌ Error cancelling appointment.' });
  }
};

/**
 * Hard delete an appointment (admin only)
 */
const hardDeleteAppointment = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    const { id } = req.params;

    // Find the appointment
    const apptIndex = user.orders.findIndex(o => o._id.toString() === id && o.type === 'appointment');
    if (apptIndex === -1) return res.status(404).json({ message: '❌ Appointment not found.' });

    const appt = user.orders[apptIndex];

    // Remove the appointment subdocument
    user.orders.splice(apptIndex, 1);

    await user.save();

    // Send admin email
    try {
      const adminText = `🗑️ Appointment Hard Deleted
👤 User: ${user.name}
📞 Phone: ${user.phone}
🆔 Appointment ID: ${id}
By Admin: ${req.user.name || req.user.email}
`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `🗑️ Appointment Hard Deleted - ${user.name}`, text: adminText });
      console.log('Admin appointment hard delete notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    return res.status(200).json({ message: '✅ Appointment permanently deleted.' });
  } catch (err) {
    console.error('❌ Hard delete appointment error:', err);
    return res.status(500).json({ message: '❌ Error deleting appointment.' });
  }
};

/**
 * Restore a cancelled appointment (admin only)
 */
const restoreAppointment = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: '❌ Not authorized' });

    const { id } = req.params;

    // Find the appointment
    const apptIndex = user.orders.findIndex(o => o._id.toString() === id && o.type === 'appointment');
    if (apptIndex === -1) return res.status(404).json({ message: '❌ Appointment not found.' });

    const appt = user.orders[apptIndex];

    if (!appt.deleted) return res.status(400).json({ message: '❌ Appointment not cancelled.' });

    // Capture before
    const before = { status: appt.status, deleted: appt.deleted };

    // Restore
    appt.status = 'pending';
    appt.deleted = false;
    appt.deletedAt = undefined;
    appt.deletedBy = undefined;

    // Append history
    appt.history.push({
      by: req.user._id,
      role: 'admin',
      action: 'restored',
      before,
      after: { status: appt.status, deleted: appt.deleted }
    });

    await user.save();

    // Send emails
    try {
      const adminText = `🔄 Appointment Restored
👤 User: ${user.name}
📞 Phone: ${user.phone}
🆔 Appointment ID: ${appt._id}
`;
      await sendMail({ to: process.env.ADMIN_EMAIL, subject: `🔄 Appointment Restored - ${user.name}`, text: adminText });
      console.log('Admin appointment restored notification sent');
    } catch (err) {
      console.error('Admin mail failed:', err?.message || err);
    }

    if (user.email) {
      try {
        const userText = `
Hi ${user.name},

Your cancelled appointment has been restored.

Appointment ID: ${appt._id}

- Ranjan Medicine Team
`;
        await sendMail({ to: user.email, subject: 'Appointment Restored', text: userText });
        console.log('User appointment restored mail sent');
      } catch (err) {
        console.error('User mail failed:', err?.message || err);
      }
    }

    return res.status(200).json({ message: '✅ Appointment restored successfully.', appointment: appt });
  } catch (err) {
    console.error('❌ Restore appointment error:', err);
    return res.status(500).json({ message: '❌ Error restoring appointment.' });
  }
};

module.exports = { createAppointment, getMyAppointments, editAppointment, cancelAppointment, hardDeleteAppointment, restoreAppointment };
