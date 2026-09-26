const express = require('express');
const router = express.Router();
const Email = require('../models/Email');

// GET all emails for a specific address (supports route param)
router.get('/:emailAddress', async (req, res) => {
  try {
    const emailAddress = req.params.emailAddress.toLowerCase();
    const emails = await Email.find({ emailAddress }).sort({ date: -1 });
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching emails' });
  }
});

// Also support query param version: /api/email?address=...
router.get('/', async (req, res) => {
  try {
    const emailAddress = (req.query.address || '').toLowerCase();
    if (!emailAddress) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    const emails = await Email.find({ emailAddress }).sort({ date: -1 });
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching emails' });
  }
});

module.exports = router;