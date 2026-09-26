const express = require('express');
const router = express.Router();
const { handleIncomingCall } = require('../controllers/ivrController');

router.all('/incoming-call', handleIncomingCall);

module.exports = router;