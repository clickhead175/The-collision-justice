import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const adminSchema = new Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 190 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true, enum: ['superadmin', 'admin', 'viewer'], default: 'viewer' },
  isTwoFactorEnabled: { type: Boolean, required: true, default: false },
  twoFactorSecret: { type: String, select: false },
  pendingTwoFactorSecret: { type: String, select: false },
  sessionVersion: { type: Number, required: true, default: 0 },
  createdBy: { type: String, trim: true, maxlength: 190 },
  createdAt: { type: Date, required: true, default: Date.now },
}, { strict: 'throw', versionKey: false });

export type AdminDocument = InferSchemaType<typeof adminSchema>;
export const Admin = mongoose.models.Admin ?? mongoose.model('Admin', adminSchema);