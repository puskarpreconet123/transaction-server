const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const adminController = require('../controllers/adminController');
const adminAuth = require('../middlewares/adminAuthMiddleware');
const validate = require('../middlewares/validateRequest');

// Auth
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], validate, adminController.login);

// Protect routes
router.use(adminAuth);

/*
========================
MERCHANT MANAGEMENT
========================
*/

router.post('/merchants', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('webhook_url').optional().isURL().withMessage('Invalid webhook URL'),
], validate, adminController.createMerchant);

router.get('/merchants', adminController.getMerchants);
router.get('/merchants/:id', adminController.getMerchant);
router.patch('/merchants/:id/status', adminController.updateMerchantStatus);

// Assign MID
router.post('/merchants/:id/mids', adminController.assignMidsToMerchant);

/*
========================
MID MANAGEMENT
========================
*/

router.post('/mids', [
  body('mid_code').trim().notEmpty().withMessage('MID code is required'),
  body('provider')
    .isIn(['rupeeflow', 'razorpay', 'paytm', 'phonepe', 'dummy'])
    .withMessage('Invalid provider'),
  body('api_key').notEmpty().withMessage('API key is required'),
  body('api_secret').optional(),
  body('webhook_secret').optional(),
], validate, adminController.createMid);

router.get('/mids', adminController.getMids);
router.patch('/mids/:id/status', adminController.updateMidStatus);

/*
========================
MONITORING
========================
*/

router.get('/transactions', adminController.getAllTransactions);
router.get('/webhook-logs', adminController.getWebhookLogs);

module.exports = router;