const razorpayProvider = require('./razorpayProvider');
const rupeeFlowProvider = require('./rupeeFlowProvider');

const PROVIDERS = {
  razorpay: razorpayProvider,
  rupeeflow: rupeeFlowProvider,
  dummy: razorpayProvider, // dummy uses same simulation
};

/**
 * Get provider adapter by name
 * @param {string} providerName
 * @returns {Object} Provider adapter
 */
const getProvider = (providerName) => {
  const provider = PROVIDERS[providerName.toLowerCase()];
  if (!provider) {
    throw new Error(`Unsupported payment provider: ${providerName}`);
  }
  return provider;
};

module.exports = { getProvider };
