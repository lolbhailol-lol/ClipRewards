const { Schema, model } = require('mongoose');

/**
 * A data deletion request from Meta (someone removed our app in Instagram settings and asked
 * for their data to be deleted). The code lets them check the status at /data-deletion?code=…
 */
const deletionRequestSchema = new Schema(
  {
    code: { type: String, required: true, unique: true },
    platform: { type: String, default: 'instagram' },
    externalId: { type: String, default: '' },
    status: { type: String, enum: ['completed'], default: 'completed' },
  },
  { timestamps: true }
);

module.exports = model('DeletionRequest', deletionRequestSchema);
