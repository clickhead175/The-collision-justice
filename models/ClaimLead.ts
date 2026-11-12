import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { ACCIDENT_TYPES, CLAIM_STATUSES, STATES } from '@/lib/brand';

const claimLeadSchema = new Schema({
  claimId: { type: String, required: true, unique: true, match: /^TCJ-\d{5}$/ },
  firstName: { type: String, required: true, trim: true, maxlength: 100 },
  lastName: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true, maxlength: 40 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 190 },
  zipCode: { type: String, required: true, match: /^\d{5}$/ },
  city: { type: String, required: true, trim: true, maxlength: 120 },
  state: { type: String, required: true, enum: STATES.map(([code]) => code) },
  accidentDate: { type: Date, required: true },
  accidentType: { type: String, required: true, enum: ACCIDENT_TYPES },
  injuriesReported: { type: String, required: true, enum: ['Yes', 'No'] },
  policeReportFiled: { type: String, required: true, enum: ['Yes', 'No', 'Unsure'] },
  atFaultStatus: { type: String, required: true, enum: ['Other Driver', 'Shared', 'Unsure'] },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  ipAddress: { type: String, trim: true, maxlength: 45 },
  geoLocation: { type: String, trim: true, maxlength: 300 },
  trustedFormCertUrl: { type: String, trim: true, maxlength: 2048 },
  trustedFormCertId: { type: String, trim: true, maxlength: 256 },
  trustedFormPingUrl: { type: String, trim: true, maxlength: 2048 },
  consentAgreed: { type: Boolean, required: true, validate: (value: boolean) => value === true },
  consentTimestamp: { type: Date, required: true },
  status: { type: String, required: true, enum: CLAIM_STATUSES, default: 'New Intake' },
  internalNotes: { type: String, default: '', maxlength: 10000 },
  createdAt: { type: Date, required: true, default: Date.now },
}, { strict: 'throw', versionKey: false });

claimLeadSchema.index({ status: 1, createdAt: -1 });
claimLeadSchema.index({ state: 1, accidentType: 1, createdAt: -1 });
claimLeadSchema.index({ email: 1, claimId: 1 });

export type ClaimLeadDocument = InferSchemaType<typeof claimLeadSchema>;
export const ClaimLead = mongoose.models.ClaimLead ?? mongoose.model('ClaimLead', claimLeadSchema);