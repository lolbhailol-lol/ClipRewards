const { Schema, model } = require('mongoose');

// One credit to a creator's wallet: the extra money a clip earned at one view check.
// It's on hold until availableAt (7 days later) so fake views can be caught first.
const earningSchema = new Schema(
  {
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    submissionId: { type: Schema.Types.ObjectId, ref: 'Submission', required: true, index: true },
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true },
    amountPaise: { type: Number, required: true }, // negative = reversal
    views: { type: Number, default: 0 }, // total views when this was credited
    availableAt: { type: Date, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = model('Earning', earningSchema);
