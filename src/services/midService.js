const MID = require('../models/MID');

/**
 * Select an active MID from merchant's assigned MIDs
 * Uses round-robin selection; can be replaced with load-based strategy
 * @param {Array} merchantMids - Array of MID ObjectIds or populated MIDs
 * @returns {Object} Selected MID with sensitive fields
 */
const selectMid = async (merchantMids, preferredMidId = null) => {
  if (!merchantMids || merchantMids.length === 0) {
    throw new Error('Merchant has no assigned MIDs');
  }

  // Get MID IDs whether populated or not
  const midIds = merchantMids.map((m) => (m._id ? m._id : m).toString());

  // If a specific MID is requested, verify it's assigned to this merchant
  if (preferredMidId) {
    if (!midIds.includes(preferredMidId.toString())) {
      throw new Error('Requested MID is not assigned to this merchant');
    }
    const mid = await MID.findById(preferredMidId).select('+api_key +api_secret +webhook_secret');
    if (!mid || mid.status !== 'active') throw new Error('Requested MID is inactive or not found');
    return mid;
  }

  // Fetch all active MIDs with sensitive fields
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
