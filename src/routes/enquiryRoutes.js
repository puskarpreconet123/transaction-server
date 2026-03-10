const express = require('express');
const router = express.Router();
const enquiryController = require('../controllers/enquiryController');
const bodyAuth = require('../middlewares/bodyAuthMiddleware');

// The prefix will be /api/add-money
router.post('/v6/trxn-status-enquiry', bodyAuth, enquiryController.trxnStatusEnquiry);

module.exports = router;
