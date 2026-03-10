const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const paymentController = require('../controllers/paymentController');
const merchantAuth = require('../middlewares/authMiddleware');
const validate = require('../middlewares/validateRequest');

/*
────────────────────────────────────
MERCHANT AUTH
────────────────────────────────────
*/

router.use(merchantAuth);

/*
────────────────────────────────────
CREATE PAYMENT
Merchant → Paynexa → RupeeFlow
────────────────────────────────────
*/

router.post(
  '/create',
  [
    body('amount')
      .isFloat({ min: 1, max: 100000 })
      .withMessage('Amount must be between 1 and 100000'),

    body('order_id')
      .trim()
      .notEmpty()
      .withMessage('order_id is required'),

    body('customer_name')
      .trim()
      .notEmpty()
      .withMessage('customer_name is required'),

    body('customer_email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid customer_email is required'),

    body('customer_mobile')
      .trim()
      .matches(/^[6-9]\d{9}$/)
      .withMessage('Valid 10-digit Indian mobile number required'),
  ],
  validate,
  paymentController.createPayment
);

/*
────────────────────────────────────
LIST PAYMENTS (Dashboard)
────────────────────────────────────
*/

router.get('/', paymentController.listPayments);

/*
────────────────────────────────────
GET PAYMENT STATUS
────────────────────────────────────
*/

router.get('/:payment_id', paymentController.getPaymentStatus);

/*
────────────────────────────────────
CONFIRM PAYMENT
(For manual verification if needed)
────────────────────────────────────
*/

router.post('/:payment_id/confirm', paymentController.confirmPayment);

/*
────────────────────────────────────
CANCEL PAYMENT
────────────────────────────────────
*/

router.post('/:payment_id/cancel', paymentController.cancelPayment);

module.exports = router;