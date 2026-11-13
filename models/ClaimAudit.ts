import mongoose, { Schema } from 'mongoose';

export type ClaimAuditActorRole = 'superadmin' | 'admin' | 'system';

const claimAuditChangeSchema = new Schema({
  field: { type: String, required: true, maxlength: 64 },
  previousValue: { type: Schema.Types.Mixed, default: null },
  newValue: { type: Schema.Types.Mixed, default: null },
}, { _id: false, strict: 'throw' });

const claimAuditSchema = new Schema({
  claimId: { type: String, required: true, match: /^TCJ-\d{5}$/ },
  actorId: { type: String, required: true, maxlength: 128 },
  actorEmail: { type: String, required: true, maxlength: 190 },
  actorRole: { type: String, enum: ['superadmin', 'admin', 'system'], required: true },
  changedAt: { type: Date, required: true, default: Date.now },
  changes: { type: [claimAuditChangeSchema], required: true, validate: (value: unknown[]) => value.length > 0 },
}, { strict: 'throw', versionKey: false });

claimAuditSchema.index({ claimId: 1, changedAt: -1 });

export type ClaimAuditChange = {
  field: string;
  previousValue: unknown;
  newValue: unknown;
};

export type ClaimAuditRecord = {
  _id: string;
  claimId: string;
  actorId: string;
  actorEmail: string;
  actorRole: ClaimAuditActorRole;
  changedAt: Date;
  changes: ClaimAuditChange[];
};

export const ClaimAudit = mongoose.models.ClaimAudit ?? mongoose.model('ClaimAudit', claimAuditSchema);
