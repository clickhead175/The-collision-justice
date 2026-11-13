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
  claimantCity: { type: String, trim: true, maxlength: 120 },
  claimantState: { type: String, enum: STATES.map(([code]) => code) },
  locationSource: { type: String, enum: ['claimant_selected'] },
  accidentDate: { type: Date, required: true },
  accidentType: { type: String, required: true, enum: ACCIDENT_TYPES },
  injuriesReported: { type: String, required: true, enum: ['Yes', 'No'] },
  policeReportFiled: { type: String, required: true, enum: ['Yes', 'No', 'Unsure'] },
  atFaultStatus: { type: String, required: true, enum: ['Other Driver', 'Shared', 'Unsure'] },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  ipAddress: { type: String, trim: true, maxlength: 45 },
  geoLocation: { type: String, trim: true, maxlength: 300 },
  geoLocationSource: { type: String, enum: ['geolite2', 'vercel'] },
  geoCountry: { type: String, trim: true, maxlength: 120 },
  geoRegion: { type: String, trim: true, maxlength: 120 },
  geoCity: { type: String, trim: true, maxlength: 120 },
  geoPostalCode: { type: String, trim: true, maxlength: 20 },
  geoLatitude: { type: Number, min: -90, max: 90 },
  geoLongitude: { type: Number, min: -180, max: 180 },
  submitterAsn: { type: Number, min: 1 },
  submitterAsnOrganization: { type: String, trim: true, maxlength: 256 },
  submitterNetworkProvider: {
    type: String,
    enum: ['AT&T', 'Verizon', 'Xfinity', 'Spectrum', 'Comcast', 'Other / Unknown'],
  },
  referenceIp: { type: String, trim: true, maxlength: 45 },
  referenceIpGeoLocation: { type: String, trim: true, maxlength: 300 },
  referenceIpProvider: {
    type: String,
    enum: ['AT&T', 'Verizon', 'Xfinity', 'Spectrum', 'Comcast', 'Comcast/Xfinity', 'Other / Unknown'],
  },
  referenceIpOrganization: { type: String, trim: true, maxlength: 256 },
  referenceIpAsn: { type: Number, min: 1 },
  referenceIpSource: { type: String, enum: ['independently_verified_city_network'] },
  trustedFormCertUrl: { type: String, trim: true, maxlength: 2048 },
  trustedFormCertId: { type: String, trim: true, maxlength: 256 },
  trustedFormPingUrl: { type: String, trim: true, maxlength: 2048 },
  trustedFormVerificationStatus: {
    type: String,
    enum: ['missing_certificate', 'pending', 'valid', 'invalid'],
    required: true,
    default: 'missing_certificate',
  },
  trustedFormVerificationAttempts: { type: Number, min: 0, default: 0 },
  trustedFormVerificationLastAttemptAt: { type: Date },
  trustedFormVerificationNextAttemptAt: { type: Date },
  trustedFormVerificationError: { type: String, maxlength: 64 },
  consentAgreed: { type: Boolean, required: true, validate: (value: boolean) => value === true },
  consentTimestamp: { type: Date, required: true },
  status: { type: String, required: true, enum: CLAIM_STATUSES, default: 'New Intake' },
  internalNotes: { type: String, default: '', maxlength: 10000 },
  createdAt: { type: Date, required: true, default: Date.now },
}, { strict: 'throw', versionKey: false });

claimLeadSchema.index({ status: 1, createdAt: -1 });
claimLeadSchema.index({ state: 1, accidentType: 1, createdAt: -1 });
claimLeadSchema.index({ email: 1, claimId: 1 });
claimLeadSchema.index({ trustedFormVerificationStatus: 1, trustedFormVerificationNextAttemptAt: 1 });

export type ClaimLeadDocument = InferSchemaType<typeof claimLeadSchema>;
export const ClaimLead = mongoose.models.ClaimLead ?? mongoose.model('ClaimLead', claimLeadSchema);