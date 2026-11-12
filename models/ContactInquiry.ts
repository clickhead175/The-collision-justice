import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const contactInquirySchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 190 },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  subject: { type: String, required: true, trim: true, maxlength: 140 },
  message: { type: String, required: true, trim: true, maxlength: 4000 },
  createdAt: { type: Date, required: true, default: Date.now },
}, { strict: 'throw', versionKey: false });

contactInquirySchema.index({ createdAt: -1 });

export type ContactInquiryDocument = InferSchemaType<typeof contactInquirySchema>;
export const ContactInquiry = mongoose.models.ContactInquiry ?? mongoose.model('ContactInquiry', contactInquirySchema);