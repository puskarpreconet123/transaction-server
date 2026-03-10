const MID = require('../models/MID');

/**
 * Select an active MID from merchant's assigned MIDs
 * Uses round-robin selection; can be replaced with load-based strategy
 * @param {Array} merchantMids - Array of MID ObjectIds or populated MIDs
 * @returns {Object} Selected MID with sensitive fields
 */
const selectMid = async (merchantMids) => {
  if (!merchantMids || merchantMids.length === 0) {
    throw new Error('Merchant has no assigned MIDs');
  }

  // Get MID IDs whether populated or not
  const midIds = merchantMids.map((m) => (m._id ? m._id : m));

  // Fetch active MIDs with sensitive fields
  const activeMids = await MID.find({
    _id: { $in: midIds },
    status: 'active',
  }).select('+api_key +api_secret +webhook_secret');

  if (activeMids.length === 0) {
    throw new Error('No active MIDs available for this merchant');
  }

  // Simple round-robin: pick randomly for now
  const selected = activeMids[Math.floor(Math.random() * activeMids.length)];
  return selected;
};

module.exports = { selectMid };
