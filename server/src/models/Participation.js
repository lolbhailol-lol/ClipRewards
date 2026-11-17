const { Schema, model } = require('mongoose');

// A creator who joined a campaign. Submissions (clips) will hang off this later.
const participationSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true }
);

participationSchema.index({ campaignId: 1, creatorId: 1 }, { unique: true });

module.exports = model('Participation', participationSchema);
