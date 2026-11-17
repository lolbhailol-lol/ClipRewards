const { Schema, model } = require('mongoose');
const { VERTICALS } = require('./Brand');

const STATUSES = ['draft', 'pending', 'live', 'paused', 'ended'];
const PLATFORMS = ['instagram', 'youtube'];

// Money is stored in paise (integers) to avoid rounding errors.
const campaignSchema = new Schema(
  {
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    brief: { type: String, trim: true, default: '' },
    rules: [{ type: String, trim: true }],
    vertical: { type: String, enum: VERTICALS, default: 'other' },
    type: { type: String, enum: ['clipping', 'ugc'], default: 'clipping' },
    platforms: [{ type: String, enum: PLATFORMS }],
    ratePer1kPaise: { type: Number, required: true, min: 100 },
    budgetPaise: { type: Number, required: true, min: 0 },
    spentPaise: { type: Number, default: 0, min: 0 },
    perClipCapPaise: { type: Number, default: 0 }, // 0 = no cap
    assetsUrl: { type: String, trim: true, default: '' },
    coverUrl: { type: String, trim: true, default: '' },
    gallery: [{ type: String, trim: true }], // inspiration / reference images
    deliverables: [{ type: String, trim: true }], // what each clip must include
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, required: true },
    status: { type: String, enum: STATUSES, default: 'draft', index: true },
  },
  { timestamps: true }
);

/** Shape shown to the public and to creators (no internal fields). */
campaignSchema.methods.toPublic = function toPublic(brand, extra = {}) {
  const left = Math.max(0, this.budgetPaise - this.spentPaise);
  return {
    id: this._id.toString(),
    title: this.title,
    brief: this.brief,
    rules: this.rules,
    vertical: this.vertical,
    type: this.type,
    platforms: this.platforms,
    ratePer1kPaise: this.ratePer1kPaise,
    budgetPaise: this.budgetPaise,
    budgetLeftPaise: left,
    budgetLeftPct: this.budgetPaise ? Math.round((left / this.budgetPaise) * 100) : 0,
    perClipCapPaise: this.perClipCapPaise,
    // Footage links are only shown to creators who joined.
    assetsUrl: extra.joined ? this.assetsUrl : '',
    hasAssets: Boolean(this.assetsUrl),
    coverUrl: this.coverUrl,
    gallery: this.gallery,
    deliverables: this.deliverables,
    startsAt: this.startsAt,
    endsAt: this.endsAt,
    status: this.status,
    createdAt: this.createdAt,
    brand: brand ? { id: brand._id.toString(), name: brand.company } : null,
    ...extra,
  };
};

module.exports = model('Campaign', campaignSchema);
module.exports.STATUSES = STATUSES;
module.exports.PLATFORMS = PLATFORMS;
