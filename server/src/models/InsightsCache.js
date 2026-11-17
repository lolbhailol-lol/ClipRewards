const { Schema, model } = require('mongoose');

// Last dashboard result per account and range, to stay well inside API rate limits.
const insightsCacheSchema = new Schema({
  accountId: { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
  days: { type: Number, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, default: Date.now, index: { expires: 6 * 3600 } }, // dropped after 6h
});
insightsCacheSchema.index({ accountId: 1, days: 1 }, { unique: true });

module.exports = model('InsightsCache', insightsCacheSchema);
