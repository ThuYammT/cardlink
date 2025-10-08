const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const crypto = require('crypto');
const sgMail = require('@sendgrid/mail'); // ✅ SendGrid API
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// ===============================
// SIGN UP
// ===============================
router.post('/signup', async (req, res) => {
  const { email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===============================
// LOGIN
// ===============================
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ===============================
// GET /me - Return current user
// ===============================
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing token' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// ===============================
// PATCH /me - Update profile
// ===============================
router.patch('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing token' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, avatar } = req.body;
    if (name) user.name = name;
    if (avatar) user.avatar = avatar;

    await user.save();
    res.json({ message: 'Profile updated' });
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});

// ===============================
// FORGOT PASSWORD + RESET PASSWORD
// ===============================

/* === Step 1: Forgot Password (SendGrid HTTPS API) === */
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  console.log('🔹 Incoming forgot-password request for:', email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `cardlink://reset-password?token=${resetToken}`;
    console.log('🔗 Reset link:', resetUrl);

    // ✅ Configure SendGrid
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: user.email,
      from: {
        name: 'CardLink Support',
        email: process.env.EMAIL_USER, // must match verified sender in SendGrid
      },
      subject: 'CardLink Password Reset',
      text: `You requested a password reset.\n\nClick the link below to set a new password:\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    };

    console.log('📤 Sending email via SendGrid HTTPS API...');
    await sgMail.send(msg);
    console.log('✅ Email sent successfully to:', user.email);

    res.json({ message: 'Password reset link sent to your email.' });
  } catch (err) {
    console.error('❌ Error during forgot-password:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

/* === Step 2: Reset Password === */
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });
    if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: 'Password has been reset successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
