// routes/auth.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sgMail = require("@sendgrid/mail");
const User = require("../models/User");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

/* =====================================================
   🔹 SIGN UP
===================================================== */
router.post("/signup", async (req, res) => {
  const { email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.status(201).json({ token });
  } catch (err) {
    console.error("❌ Signup error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   🔹 LOGIN
===================================================== */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "7d",
    });
    res.json({ token });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   🔹 GET /me
===================================================== */
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("❌ /me error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

/* =====================================================
   🔹 PATCH /me — update name/avatar/email
===================================================== */
router.patch("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { name, avatar, email, currentPassword } = req.body;

    if (email && email !== user.email) {
      if (!currentPassword)
        return res
          .status(400)
          .json({ message: "Password required to change email" });

      const valid = await bcrypt.compare(currentPassword, user.password);
      if (!valid)
        return res.status(400).json({ message: "Incorrect password" });

      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ message: "Email already in use" });

      user.email = email;
    }

    if (name) user.name = name;
    if (avatar) user.avatar = avatar;

    await user.save();
    res.json({ message: "Profile updated" });
  } catch (err) {
    console.error("❌ Update error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

/* =====================================================
   🔹 PATCH /update-account — email/phone/password
===================================================== */
router.patch("/update-account", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "Missing token" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { email, phone, currentPassword, newPassword } = req.body;

    // 🔐 Require password verification for sensitive changes
    if ((email && email !== user.email) || newPassword) {
      if (!currentPassword)
        return res.status(400).json({ message: "Please enter your current password" });

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch)
        return res.status(400).json({ message: "Incorrect current password" });
    }

    // ✅ Password change
    if (newPassword) {
      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;
      await user.save();

      return res.json({
        message: "Password updated successfully. Please log in again.",
        forceLogout: true,
      });
    }

    // ✅ Email change
    if (email && email !== user.email) {
      const existing = await User.findOne({ email });
      if (existing)
        return res.status(400).json({ message: "Email already in use" });

      user.email = email;
      await user.save();

      return res.json({
        message: "Email updated successfully. Please log in again.",
        forceLogout: true,
      });
    }

    // ✅ Phone update
    if (phone) user.phone = phone;

    await user.save();
    res.json({ message: "Account updated successfully" });
  } catch (err) {
    console.error("❌ Account update error:", err);
    res.status(401).json({ message: "Invalid or expired token" });
  }
});

/* =====================================================
   🔹 FORGOT PASSWORD / RESET PASSWORD
===================================================== */
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  console.log("🔹 Incoming forgot-password for:", email);

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1h
    await user.save();

    // ✅ Make Gmail-friendly clickable link
    const resetUrl = `https://cardlink.onrender.com/open-reset?token=${resetToken}`;
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const msg = {
      to: user.email,
      from: {
        name: "CardLink Support",
        email: process.env.EMAIL_USER,
      },
      subject: "CardLink Password Reset",
      html: `
        <div style="font-family: Arial, sans-serif; color: #111;">
          <h2 style="color:#213BBB;">CardLink Password Reset</h2>
          <p>You requested a password reset.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;
              padding:12px 20px;background-color:#213BBB;
              color:white;font-weight:bold;text-decoration:none;
              border-radius:6px;">Open in CardLink App</a>
          </p>
          <p>If the button doesn't work, copy this link:</p>
          <p><a href="${resetUrl}" style="color:#213BBB;">${resetUrl}</a></p>
        </div>
      `,
    };

    await sgMail.send(msg);
    console.log("✅ Reset email sent to:", user.email);
    res.json({ message: "Password reset link sent to your email." });
  } catch (err) {
    console.error("❌ Forgot-password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   🔹 RESET PASSWORD
===================================================== */
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });
    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error("❌ Reset-password error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =====================================================
   🔹 Deep Link Redirect (NEW)
===================================================== */
router.get("/open-reset", (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send("Missing token");
  const deepLink = `cardlink://reset-password?token=${token}`;
  res.redirect(deepLink);
});

module.exports = router;
