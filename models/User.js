const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String }, // ✅ NEW
  avatar: { type: String }, // ✅ NEW (URL to image)
});

module.exports = mongoose.model('User', UserSchema);
