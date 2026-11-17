const { Schema, model } = require('mongoose');

const VERTICALS = ['genz', 'podcast', 'music', 'regional', 'other'];
const APPROVAL = ['pending', 'approved', 'rejected', 'info_requested'];

const brandSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    company: { type: String, required: true, trim: true },
    website: { type: String, trim: true, default: '' },
    gstin: { type: String, trim: true, uppercase: true, default: '' },
    contactName: { type: String, required: true, trim: true },
    contactPhone: { type: String, trim: true, default: '' },
    vertical: { type: String, enum: VERTICALS, default: 'other' },
    approvalStatus: { type: String, enum: APPROVAL, default: 'pending', index: true },
    // Note shown to the brand when rejected or when more info is requested.
    adminNote: { type: String, trim: true, default: '' },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = model('Brand', brandSchema);
module.exports.VERTICALS = VERTICALS;
module.exports.APPROVAL = APPROVAL;
