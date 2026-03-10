const Merchant = require('../models/Merchant');
const Payment = require('../models/Payment');
const { generateJWT } = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/response');
const { validationResult } = require('express-validator');

/*
──────────────────────────────────────────────
AUTH
──────────────────────────────────────────────
*/

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', 422, errors.array());
    }

    const { email, password } = req.body;

    const merchant = await Merchant.findOne({ email })
      .select('+password')
      .lean(false);

    if (!merchant || !(await merchant.comparePassword(password))) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    if (merchant.status !== 'active') {
      return errorResponse(res, `Account is ${merchant.status}`, 403);
    }

    const token = generateJWT({
      id: merchant._id,
      type: 'merchant',
    });

    return successResponse(res, {
      token,
      merchant: {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        api_token: merchant.api_token,
      },
    }, 'Login successful');

  } catch (err) {
    console.error('Merchant login error:', err);
    return errorResponse(res, 'Login failed');
  }
};


/*
──────────────────────────────────────────────
API TOKEN MANAGEMENT
──────────────────────────────────────────────
*/

exports.generateToken = async (req, res) => {
  try {
    const merchant = req.merchant;

    const newToken = merchant.generateApiToken();
    await merchant.save();

    return successResponse(res, {
      api_token: newToken,
    }, 'API token generated');

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to generate token');
  }
};

exports.regenerateToken = async (req, res) => {
  try {
    const merchant = req.merchant;

    const newToken = merchant.generateApiToken();
    await merchant.save();

    return successResponse(res, {
      api_token: newToken,
    }, 'API token regenerated. Previous token invalidated');

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to regenerate token');
  }
};


/*
──────────────────────────────────────────────
PROFILE
──────────────────────────────────────────────
*/

exports.getProfile = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('mids', 'mid_code provider status upi_id merchant_name')
      .lean();

    if (!merchant) {
      return errorResponse(res, 'Merchant not found', 404);
    }

    return successResponse(res, {
      id: merchant._id,
      name: merchant.name,
      email: merchant.email,
      api_token: merchant.api_token,
      webhook_url: merchant.webhook_url,
      status: merchant.status,
      mids: merchant.mids || [],
    });

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch profile');
  }
};


exports.updateWebhookUrl = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, 'Validation failed', 422, errors.array());
    }

    const { webhook_url } = req.body;

    await Merchant.updateOne(
      { _id: req.merchant._id },
      { webhook_url }
    );

    return successResponse(res, {
      webhook_url,
    }, 'Webhook URL updated');

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to update webhook');
  }
};


exports.getAssignedMids = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.merchant._id)
      .populate('mids', 'mid_code provider status upi_id merchant_name')
      .lean();

    return successResponse(res, merchant.mids || []);

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch MIDs');
  }
};


/*
──────────────────────────────────────────────
TRANSACTIONS
──────────────────────────────────────────────
*/

exports.getTransactions = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const { status, order_id } = req.query;

    const filter = {
      merchant_id: req.merchant._id,
    };

    if (status) filter.status = status;
    if (order_id) filter.order_id = order_id;

    const payments = await Payment.find(filter)
      .select('-provider_response -customer_email -customer_mobile')
      .populate('mid_id', 'mid_code provider')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Payment.countDocuments(filter);

    return successResponse(res, {
      payments,
      total,
      page,
      limit,
    });

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch transactions');
  }
};


exports.getTransaction = async (req, res) => {
  try {

    const payment = await Payment.findOne({
      payment_id: req.params.payment_id,
      merchant_id: req.merchant._id,
    })
      .populate('mid_id', 'mid_code provider')
      .lean();

    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    return successResponse(res, payment);

  } catch (err) {
    console.error(err);
    return errorResponse(res, 'Failed to fetch transaction');
  }
};