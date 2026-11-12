import mongoose, { Schema } from 'mongoose';

const rateLimitSchema = new Schema({
  key: { type: String, required: true },
  windowStart: { type: Number, required: true },
  count: { type: Number, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false, strict: 'throw' });

rateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit = mongoose.models.RateLimit ?? mongoose.model('RateLimit', rateLimitSchema);