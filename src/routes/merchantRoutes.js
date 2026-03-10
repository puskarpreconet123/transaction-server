const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const merchantController = require('../controllers/merchantController');
const merchantAuth = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validateRequest');

/*
==================================
MERCHANT AUTH
==================================
*/

// Login (JWT based)
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  validate,
  merchantController.login
);

/*
==================================
PROTECTED ROUTES
Requires API Token
==================================
*/

router.use(merchantAuth);

/*
==================================
PROFILE
==================================
*/

router.get('/profile', merchantController.getProfile);

router.patch(
  '/webhook-url',
  [
    body('webhook_url')
      .optional()
      .isURL()
      .withMessage('Invalid webhook URL'),
  ],
  validate,
  merchantController.updateWebhookUrl
);

/*
==================================
API TOKEN MANAGEMENT
==================================
*/

// Generate first API token
router.post('/token/generate', merchantController.generateToken);

// Regenerate token (invalidate old)
router.post('/token/regenerate', merchantController.regenerateToken);

/*
==================================
MID ACCESS
==================================
*/

// Get assigned MIDs
router.get('/mids', merchantController.getAssignedMids);

/*
==================================
TRANSACTIONS
==================================
*/

// Transaction list
router.get('/transactions', merchantController.getTransactions);

// Single transaction
router.get('/transactions/:payment_id', merchantController.getTransaction);

module.exports = router;