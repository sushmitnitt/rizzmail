const express = require('express');
const router = express.Router();
const { getMessages, sendEmail } = require('../controllers/messageController');

router.get('/:phone', getMessages);
router.post('/send', sendEmail);

module.exports = function(io) {
  // If you use io inside routes, export it cleanly or keep it standard like this:
  return router;
};