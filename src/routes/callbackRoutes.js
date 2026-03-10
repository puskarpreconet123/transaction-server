// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const { rupeeFlowCallback } = require('../controllers/callbackController');

router.post('/rupeeflow/callback', rupeeFlowCallback);

module.exports = router;