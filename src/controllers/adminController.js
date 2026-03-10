const Admin = require('../models/Admin');
const Merchant = require('../models/Merchant');
const MID = require('../models/MID');
const Payment = require('../models/Payment');
const WebhookLog = require('../models/WebhookLog');

const { generateJWT } = require('../utils/generateToken');
const { successResponse, errorResponse } = require('../utils/response');
const { validationResult } = require('express-validator');

/*
==================================
ADMIN AUTH
==================================
*/

exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return errorResponse(res, 'Validation failed', 422, errors.array());

    const { email, password } = req.body;

    const admin = await Admin.findOne({ email }).select('+password');

    if (!admin || !(await admin.comparePassword(password))) {
      return errorResponse(res, 'Invalid email or password', 401);
    }

    if (!admin.isActive) {
      return errorResponse(res, 'Admin account is deactivated', 403);
    }

    const token = generateJWT({
      id: admin._id,
      role: admin.role,
    });

    return successResponse(
      res,
      {
        token,
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role,
        },
      },
      'Login successful'
    );
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

/*
==================================
MERCHANT MANAGEMENT
==================================
*/

exports.createMerchant = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return errorResponse(res, 'Validation failed', 422, errors.array());

    const { name, email, password, webhook_url } = req.body;

    const exists = await Merchant.findOne({ email });

    if (exists)
      return errorResponse(res, 'Merchant with this email already exists', 409);

    const merchant = new Merchant({
      name,
      email,
      password,
      webhook_url,
      created_by: req.admin._id,
    });

    merchant.generateApiToken();

    await merchant.save();

    return successResponse(
      res,
      {
        id: merchant._id,
        name: merchant.name,
        email: merchant.email,
        api_token: merchant.api_token,
        webhook_url: merchant.webhook_url,
        status: merchant.status,
      },
      'Merchant created successfully',
      201
    );
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

exports.getMerchants = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    const merchants = await Merchant.find(filter)
      .populate('mids', 'mid_code provider status')
      .select('-api_token')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Merchant.countDocuments(filter);

    return successResponse(res, {
      merchants,
      total,
      page,
      limit,
    });
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

exports.getMerchant = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.params.id)
      .populate('mids', 'mid_code provider status upi_id merchant_name');

    if (!merchant) return errorResponse(res, 'Merchant not found', 404);

    return successResponse(res, merchant);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

exports.updateMerchantStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status))
      return errorResponse(res, 'Invalid status value', 400);

    const merchant = await Merchant.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!merchant) return errorResponse(res, 'Merchant not found', 404);

    return successResponse(
      res,
      { id: merchant._id, status: merchant.status },
      'Merchant status updated'
    );
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

exports.assignMidsToMerchant = async (req, res) => {
  try {
    const { mid_ids } = req.body;

    if (!Array.isArray(mid_ids) || mid_ids.length === 0)
      return errorResponse(res, 'mid_ids must be a non-empty array', 400);

    const mids = await MID.find({
      _id: { $in: mid_ids },
      status: 'active',
    });

    if (mids.length !== mid_ids.length)
      return errorResponse(res, 'One or more MID IDs are invalid or inactive', 400);

    const merchant = await Merchant.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { mids: { $each: mid_ids } } },
      { new: true }
    ).populate('mids', 'mid_code provider status');

    if (!merchant) return errorResponse(res, 'Merchant not found', 404);

    return successResponse(res, merchant, 'MIDs assigned successfully');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

/*
==================================
MID MANAGEMENT
==================================
*/

exports.createMid = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return errorResponse(res, 'Validation failed', 422, errors.array());

    const {
      mid_code,
      provider,
      api_key,
      api_secret,
      webhook_secret,
      upi_id,
      merchant_name,
    } = req.body;

    const exists = await MID.findOne({
      mid_code: mid_code.toUpperCase(),
    });

    if (exists)
      return errorResponse(res, 'MID code already exists', 409);

    const mid = await MID.create({
      mid_code: mid_code.toUpperCase(),
      provider,
      api_key,
      api_secret,
      webhook_secret,
      upi_id,
      merchant_name,
      created_by: req.admin._id,
    });

    return successResponse(
      res,
      {
        id: mid._id,
        mid_code: mid.mid_code,
        provider: mid.provider,
        upi_id: mid.upi_id,
        merchant_name: mid.merchant_name,
        status: mid.status,
      },
      'MID created successfully',
      201
    );
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

exports.getMids = async (req, res) => {
  try {
    const mids = await MID.find()
      .select('-api_key -api_secret -webhook_secret')
      .sort({ createdAt: -1 });

    return successResponse(res, mids);
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

exports.updateMidStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status))
      return errorResponse(res, 'Status must be active or inactive', 400);

    const mid = await MID.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-api_key -api_secret -webhook_secret');

    if (!mid) return errorResponse(res, 'MID not found', 404);

    return successResponse(res, mid, 'MID status updated');
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

/*
==================================
TRANSACTION MONITORING
==================================
*/

exports.getAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const filter = {};

    if (req.query.status) filter.status = req.query.status;
    if (req.query.merchant_id) filter.merchant_id = req.query.merchant_id;

    if (req.query.from || req.query.to) {
      filter.createdAt = {};
      if (req.query.from) filter.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) filter.createdAt.$lte = new Date(req.query.to);
    }

    const payments = await Payment.find(filter)
      .populate('merchant_id', 'name email')
      .populate('mid_id', 'mid_code provider')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Payment.countDocuments(filter);

    const successCount = await Payment.countDocuments({
      ...filter,
      status: 'SUCCESS',
    });

    const successRate =
      total > 0 ? ((successCount / total) * 100).toFixed(2) : 0;

    return successResponse(res, {
      payments,
      total,
      page,
      limit,
      success_rate: `${successRate}%`,
    });
  } catch (err) {
    return errorResponse(res, err.message);
  }
};

/*
==================================
WEBHOOK LOGS
==================================
*/

exports.getWebhookLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;

    const filter = {};

    if (req.query.payment_id) filter.payment_id = req.query.payment_id;
    if (req.query.status) filter.status = req.query.status;

    const logs = await WebhookLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await WebhookLog.countDocuments(filter);

    return successResponse(res, {
      logs,
      total,
      page,
      limit,
    });
  } catch (err) {
    return errorResponse(res, err.message);
  }
};