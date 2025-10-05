// utils/mailer.js
const axios = require('axios');
const qs = require('querystring');
const nodemailer = require('nodemailer');

const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_FROM = process.env.MAILGUN_FROM || `Ranjan Medicine <no-reply@${MAILGUN_DOMAIN || 'example.com'}>`;

// SMTP fallback (optional)
const SMTP_HOST = process.env.EMAIL_HOST;
const SMTP_PORT = process.env.EMAIL_PORT;
const SMTP_USER = process.env.EMAIL_USER;
const SMTP_PASS = process.env.EMAIL_PASS;
const SMTP_FROM = process.env.SMTP_FROM || (SMTP_USER ? `Ranjan Medicine <${SMTP_USER}>` : MAILGUN_FROM);

let smtpTransporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  smtpTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

/**
 * sendMail({ to, subject, text, html })
 * - Primary: Mailgun HTTP API (preferred)
 * - Fallback: SMTP (nodemailer) if Mailgun fails or not configured
 */
const sendMail = async ({ to, subject, text, html }) => {
  if (!to) throw new Error('sendMail: "to" is required');

  // Try Mailgun first
  if (MAILGUN_API_KEY && MAILGUN_DOMAIN) {
    try {
      const url = `https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`;
      const auth = { username: 'api', password: MAILGUN_API_KEY };
      const data = {
        from: MAILGUN_FROM,
        to,
        subject: subject || '',
        text: text || undefined,
        html: html || undefined
      };

      const resp = await axios.post(url, qs.stringify(data), {
        auth,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });

      console.log('✅ Mailgun sent:', resp.data);
      return { provider: 'mailgun', result: resp.data };
    } catch (err) {
      console.error('⚠️ Mailgun error:', err.response?.data || err.message || err);
      // if no SMTP fallback, throw error so caller knows
      if (!smtpTransporter) throw err;
      // else continue to fallback
    }
  }

  // Fallback to SMTP if configured
  if (smtpTransporter) {
    try {
      const info = await smtpTransporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        text,
        html
      });
      console.log('✅ SMTP sent:', info.messageId);
      return { provider: 'smtp', result: info };
    } catch (err) {
      console.error('❌ SMTP send error:', err.response?.data || err.message || err);
      throw err;
    }
  }

  throw new Error('No mail provider configured. Set MAILGUN_API_KEY & MAILGUN_DOMAIN or SMTP env vars.');
};

module.exports = sendMail;
