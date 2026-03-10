const crypto = require('crypto');

const generatePaymentId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `PAY_${timestamp}_${random}`;
};

const generateMidCode = (index) => {
  const num = String(index).padStart(3, '0');
  return `MID_${num}`;
};

module.exports = { generatePaymentId, generateMidCode };
