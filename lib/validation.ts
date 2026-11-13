import { isIP } from 'node:net';
import { z } from 'zod';
import { ACCIDENT_TYPES, CLAIM_STATUSES, STATES } from '@/lib/brand';
import { extractTrustedFormCertId } from '@/lib/claim-request-metadata';

const emailSchema = z.email().max(190).transform((value) => value.trim().toLowerCase());
const phoneSchema = z.string().trim().min(10).max(40).regex(/^[0-9\s()+.\-]+$/);
const dateSchema = z.iso.date().refine((value) => value <= new Date().toISOString().slice(0, 10), 'Date cannot be in the future.');
const trustedFormCertUrlSchema = z.string().trim().max(2048)
  .refine((value) => Boolean(extractTrustedFormCertId(value, '')), 'A valid TrustedForm certificate URL is required.');
const trustedFormPingUrlSchema = z.string().trim().max(2048).refine((value) => {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['api.trustedform.com', 'ping.trustedform.com'].includes(url.hostname);
  } catch {
    return false;
  }
}, 'Invalid TrustedForm ping URL.');

export const trustedFormCertificateAttachSchema = z.strictObject({
  trustedFormCertUrl: trustedFormCertUrlSchema,
  trustedFormPingUrl: trustedFormPingUrlSchema.optional().default(''),
});

export const claimInputSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  phone: phoneSchema,
  email: emailSchema,
  zipCode: z.string().trim().regex(/^\d{5}$/),
  city: z.string().trim().min(1).max(120),
  cityIsManual: z.boolean().optional().default(false),
  state: z.enum(STATES.map(([code]) => code)),
  accidentDate: dateSchema,
  accidentType: z.enum(ACCIDENT_TYPES),
  injuriesReported: z.enum(['Yes', 'No']),
  policeReportFiled: z.enum(['Yes', 'No', 'Unsure']),
  atFaultStatus: z.enum(['Other Driver', 'Shared', 'Unsure']),
  description: z.string().trim().min(10).max(5000),
  trustedFormCertUrl: trustedFormCertUrlSchema,
  trustedFormPingUrl: trustedFormPingUrlSchema.optional().default(''),
  trustedFormCertId: z.string().trim().max(256).regex(/^[A-Za-z0-9_-]*$/).optional().default(''),
  xxTrustedFormToken: z.string().trim().max(2048).optional().default('').refine((value) => !value || /^[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+$/.test(value), 'Invalid TrustedForm token.'),
  clientIp: z.string().trim().max(45).optional().default('').refine((value) => !value || isIP(value), 'Invalid client IP address.'),
  consentAgreed: z.literal(true),
  website: z.string().max(0).optional(),
});

export const contactInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  phone: z.union([z.literal(''), phoneSchema]).optional().default(''),
  subject: z.string().trim().min(1).max(140),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(0).optional(),
});

export function normalizeLookupPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
}

export function lookupPhonePattern(value: string) {
  const digits = normalizeLookupPhone(value);
  return new RegExp(`^(?:\\+?1[\\s().-]*)?[\\s().-]*${digits.split('').join('[\\s().-]*')}$`);
}

export function lookupEmailPattern(value: string) {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
}

export const claimLookupSchema = z.strictObject({
  claimId: z.union([
    z.literal(''),
    z.string().trim().toUpperCase().regex(/^(?:TCJ-?)?\d{5}$/).transform((value) => `TCJ-${value.replace(/^TCJ-?/, '')}`),
  ]).optional().default(''),
  email: z.union([z.literal(''), emailSchema]).optional().default(''),
  phone: z.union([z.literal(''), phoneSchema]).optional().default('')
    .refine((value) => !value || normalizeLookupPhone(value).length === 10, 'Enter a valid 10-digit phone number.'),
}).refine((value) => Boolean(value.claimId || value.email || value.phone), {
  message: 'Enter a Claim ID, email address, or phone number.',
  path: ['claimId'],
});

export const adminLoginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(72).refine((value) => new TextEncoder().encode(value).byteLength <= 72),
  rememberMe: z.boolean().optional().default(false),
});

export const adminTotpCodeSchema = z.string().regex(/^\d{6}$/);
export const adminTeamCreateSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: z.string().min(12).max(72).refine((value) => new TextEncoder().encode(value).byteLength <= 72),
  role: z.enum(['admin', 'viewer']),
});
export const adminTeamUpdateSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  email: emailSchema.optional(),
  password: z.string().min(12).max(72).refine((value) => new TextEncoder().encode(value).byteLength <= 72).optional(),
  role: z.enum(['admin', 'viewer']).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined));
export const adminPasswordChangeSchema = z.strictObject({
  currentPassword: z.string().min(1).max(72).refine((value) => new TextEncoder().encode(value).byteLength <= 72),
  newPassword: z.string().min(12).max(72).refine((value) => new TextEncoder().encode(value).byteLength <= 72),
});
export const adminTwoFactorVerifySchema = z.strictObject({
  challenge: z.string().min(1).max(4096),
  code: adminTotpCodeSchema,
  rememberMe: z.boolean().optional().default(false),
});
export const adminTwoFactorDisableSchema = z.strictObject({
  currentPassword: z.string().min(1).max(72).refine((value) => new TextEncoder().encode(value).byteLength <= 72),
  code: adminTotpCodeSchema,
});

export const adminClaimUpdateSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  phone: phoneSchema.optional(),
  email: emailSchema.optional(),
  zipCode: z.string().trim().regex(/^\d{5}$/).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  state: z.enum(STATES.map(([code]) => code)).optional(),
  accidentDate: dateSchema.optional(),
  accidentType: z.enum(ACCIDENT_TYPES).optional(),
  injuriesReported: z.enum(['Yes', 'No']).optional(),
  policeReportFiled: z.enum(['Yes', 'No', 'Unsure']).optional(),
  atFaultStatus: z.enum(['Other Driver', 'Shared', 'Unsure']).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  status: z.enum(CLAIM_STATUSES).optional(),
  internalNotes: z.string().trim().max(10000).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined));

export const adminContactUpdateSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).optional(),
  email: emailSchema.optional(),
  phone: z.union([z.literal(''), phoneSchema]).optional(),
  subject: z.string().trim().min(1).max(140).optional(),
  message: z.string().trim().min(10).max(4000).optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined));