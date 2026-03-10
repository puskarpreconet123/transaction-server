const Merchant = require('../models/Merchant');
const { errorResponse } = require('../utils/response');
const { verifyJWT } = require('../utils/generateToken');

const merchantAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authorization token required', 401);
    }

    const token = authHeader.split(' ')[1];
    let merchant;

    // 1. Try to verify as JWT (Session token from login)
    try {
      const decoded = verifyJWT(token);
      merchant = await Merchant.findById(decoded.id).populate('mids');
    } catch (jwtError) {
      // 2. If JWT fails, try as API Token (Static key)
      merchant = await Merchant.findOne({ api_token: token }).populate('mids');
    }

    if (!merchant) {
      return errorResponse(res, 'Invalid or expired token', 401);
    }

    if (merchant.status !== 'active') {
      return errorResponse(res, `Merchant account is ${merchant.status}`, 403);
    }

    req.merchant = merchant;
    next();
  } catch (error) {
    console.error('Merchant Auth Error:', error.message);
    return errorResponse(res, 'Authentication failed', 500);
  }
};

module.exports = merchantAuth;
