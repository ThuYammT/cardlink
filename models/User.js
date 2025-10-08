const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  avatar: { type: String },
  // 🔽 Add these two lines for password-reset support
  resetToken: { type: String },
  resetTokenExpiry: { type: Date },
});

module.exports = mongoose.model('User', UserSchema);
