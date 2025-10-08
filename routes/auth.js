const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// Sign Up
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

// Log In
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

// ✅ GET /me - Return current logged-in user
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'Missing token' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user); // ✅ return full user info (email, name, avatar)
  } catch (err) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
});


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
// Forgot Password + Reset Password
// ===============================
const crypto = require("crypto");
const nodemailer = require("nodemailer");

/* === Step 1: Forgot Password (with debug logs) === */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  console.log("🔹 Incoming forgot-password request for:", email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(404).json({ message: "User not found" });
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // valid for 1 hour
    await user.save();
    console.log("✅ Token generated and saved for user:", user.email);

    // Reset URL
    const resetUrl = `https://cardlink.onrender.com/reset-password/${resetToken}`;
    console.log("🔗 Reset link:", resetUrl);

    // Setup email transport
    console.log("📨 Setting up Nodemailer transporter...");
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    console.log("📤 Attempting to send email...");
    await transporter.sendMail({
      from: `"CardLink Support" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "CardLink Password Reset",
      text: `You requested a password reset.\n\nClick the link below to set a new password:\n${resetUrl}\n\nIf you did not request this, please ignore this email.`,
    });

    console.log("✅ Email sent successfully to:", user.email);
    res.json({ message: "Password reset link sent to your email." });
  } catch (err) {
    console.error("❌ Error during forgot-password:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* === Step 2: Reset Password === */
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }, // ensure still valid
    });
    if (!user) return res.status(400).json({ message: "Invalid or expired token" });

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});



module.exports = router;
