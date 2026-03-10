const Merchant = require('../models/Merchant');
const { errorResponse } = require('../utils/response');

/**
 * Middleware to authenticate merchant using api_token from request body
 * Required for the v6 status enquiry specification
 */
const bodyAuthMiddleware = async (req, res, next) => {
    try {
        const { api_token } = req.body;

        if (!api_token) {
            return errorResponse(res, 'api_token is required', 401);
        }

        const merchant = await Merchant.findOne({ api_token }).populate('mids');

        if (!merchant) {
            return errorResponse(res, 'Invalid api_token', 401);
        }

        if (merchant.status !== 'active') {
            return errorResponse(res, `Merchant account is ${merchant.status}`, 403);
        }

        req.merchant = merchant;
        next();
    } catch (error) {
        console.error('Body Auth Error:', error.message);
        return errorResponse(res, 'Authentication failed', 500);
    }
};

module.exports = bodyAuthMiddleware;
