const express = require('express');
const jwt = require('jsonwebtoken');
const Contact = require('../models/Contact');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to extract user from token
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Create a contact
router.post('/', authMiddleware, async (req, res) => {
  try {
    const contact = new Contact({ ...req.body, userId: req.userId });
    await contact.save();
    res.status(201).json(contact);
  } catch (err) {
    res.status(500).json({ message: 'Failed to save contact' });
  }
});

// Get all contacts for a user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(contacts);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch contacts' });
  }
});

// ✅ Delete a contact by ID
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const contact = await Contact.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId, // ensure the contact belongs to the logged-in user
    });

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete contact' });
  }
});

module.exports = router;

// Update a contact
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const contact = await Contact.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.json(contact);
  } catch (err) {
    res.status(500).json({ message: 'Failed to update contact' });
  }
});
