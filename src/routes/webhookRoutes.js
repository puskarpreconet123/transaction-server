const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// Provider webhook endpoint - needs raw body for signature verification
router.post('/provider', webhookController.handleProviderWebhook);

// Simulate webhook for testing (dev/staging only)
router.post('/simulate', webhookController.simulateWebhook);

module.exports = router;
