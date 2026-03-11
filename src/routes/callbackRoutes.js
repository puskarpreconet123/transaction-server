
const express = require('express');
const router = express.Router();
const { rupeeFlowCallback } = require('../controllers/callbackController');

router.post('/callback', rupeeFlowCallback);

module.exports = router;