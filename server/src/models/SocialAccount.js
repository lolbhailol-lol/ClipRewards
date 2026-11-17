const { Schema, model } = require('mongoose');

const PLATFORMS = ['instagram', 'youtube'];

// A creator's connected Instagram account or YouTube channel.
const socialAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    platform: { type: String, enum: PLATFORMS, required: true },
    externalId: { type: String, required: true }, // IG user id / YouTube channel id
    username: { type: String, default: '' },
    displayName: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    accountType: { type: String, default: '' }, // Instagram: Business / Media_Creator
    followers: { type: Number, default: null },
    mediaCount: { type: Number, default: null },
    // Instagram only: encrypted long-lived token. YouTube tokens are never stored.
    accessTokenEnc: { type: String, default: '', select: false },
    tokenExpiresAt: { type: Date, default: null },
    tokenRefreshedAt: { type: Date, default: null },
    permissions: [{ type: String }],
    status: { type: String, enum: ['active', 'expired'], default: 'active' },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One account per platform per user, and an account can belong to only one user.
socialAccountSchema.index({ userId: 1, platform: 1 }, { unique: true });
socialAccountSchema.index({ platform: 1, externalId: 1 }, { unique: true });

socialAccountSchema.methods.toPublic = function toPublic() {
  return {
    platform: this.platform,
    username: this.username,
    displayName: this.displayName,
    avatarUrl: this.avatarUrl,
    accountType: this.accountType,
    followers: this.followers,
    mediaCount: this.mediaCount,
    status: this.status,
    tokenExpiresAt: this.tokenExpiresAt,
    connectedAt: this.createdAt,
    lastSyncedAt: this.lastSyncedAt,
  };
};

module.exports = model('SocialAccount', socialAccountSchema);
module.exports.PLATFORMS = PLATFORMS;
