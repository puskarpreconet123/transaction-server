const { verifyJWT } = require('../utils/generateToken');
const Admin = require('../models/Admin');
const { errorResponse } = require('../utils/response');

const adminAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authorization token required', 401);
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyJWT(token);

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return errorResponse(res, 'Admin not found', 401);
    }

    if (!admin.isActive) {
      return errorResponse(res, 'Admin account is deactivated', 403);
    }

    req.admin = admin;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired', 401);
    }
    return errorResponse(res, 'Authentication failed', 500);
  }
};

module.exports = adminAuth;
