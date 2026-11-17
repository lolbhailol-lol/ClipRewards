const { Schema, model } = require('mongoose');

const SUB_STATUS = ['pending', 'approved', 'rejected', 'removed'];

// A creator's clip (Reel / Short) submitted to a campaign. Views are re-read from the platform on a schedule.
const submissionSchema = new Schema(
  {
    campaignId: { type: Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    creatorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    socialAccountId: { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
    platform: { type: String, enum: ['instagram', 'youtube'], required: true },
    postId: { type: String, required: true }, // IG media id / YouTube video id
    mediaType: { type: String, default: '' },
    url: { type: String, required: true },
    title: { type: String, default: '' },
    thumbnailUrl: { type: String, default: '' },
    publishedAt: { type: Date, default: null },
    status: { type: String, enum: SUB_STATUS, default: 'pending', index: true },
    reviewNote: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    // Latest numbers from the platform
    views: { type: Number, default: 0 },
    likes: { type: Number, default: null },
    comments: { type: Number, default: null },
    shares: { type: Number, default: null },
    lastCheckedAt: { type: Date, default: null },
    checkError: { type: String, default: '' },
    // Money earned so far by this clip (paise). Grows as views grow, up to the per-clip cap.
    earnedPaise: { type: Number, default: 0 },
    // Simple fraud signal; flagged clips stop earning until an admin looks.
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: '' },
  },
  { timestamps: true }
);

// A post can be submitted once, ever (no double-dipping across campaigns).
submissionSchema.index({ platform: 1, postId: 1 }, { unique: true });

submissionSchema.methods.toPublic = function toPublic(campaign) {
  return {
    id: this._id.toString(),
    campaignId: this.campaignId.toString(),
    campaign: campaign ? { id: campaign._id.toString(), title: campaign.title, ratePer1kPaise: campaign.ratePer1kPaise } : undefined,
    platform: this.platform,
    url: this.url,
    title: this.title,
    thumbnailUrl: this.thumbnailUrl,
    publishedAt: this.publishedAt,
    status: this.status,
    reviewNote: this.reviewNote,
    views: this.views,
    likes: this.likes,
    comments: this.comments,
    shares: this.shares,
    earnedPaise: this.earnedPaise,
    flagged: this.flagged,
    lastCheckedAt: this.lastCheckedAt,
    createdAt: this.createdAt,
  };
};

module.exports = model('Submission', submissionSchema);
module.exports.SUB_STATUS = SUB_STATUS;
