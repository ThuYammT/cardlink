const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  firstName: String,
  lastName: String,
  nickname: String,             // ✅ new
  position: String,             // ✅ new
  phone: String,
  additionalPhones: String,   // ✅ upcoming for Step 2
  email: String,
  company: String,
  website: String,
  notes: String,
  isFavorite: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Contact', contactSchema);
