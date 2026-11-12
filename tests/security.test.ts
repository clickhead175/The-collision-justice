import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import {
  decryptAdminSecret,
  encryptAdminSecret,
  setAdminCookie,
  signAdminToken,
  signClaimPdfToken,
  verifyAdminToken,
  verifyClaimPdfToken,
} from '@/lib/auth';
import { ApiError } from '@/lib/api-error';
import { assertCanCreateAdminRole, assertCanManageAdmin } from '@/lib/admin-permissions';
import { csrfIsValid } from '@/lib/csrf';
import { createClaimSummaryPdf } from '@/lib/claim-pdf';
import { readJson } from '@/lib/request';
import { claimInputSchema, claimLookupSchema, lookupEmailPattern, lookupPhonePattern, normalizeLookupPhone } from '@/lib/validation';
import { extractTrustedFormCertId, getClaimRequestMetadata } from '@/lib/claim-request-metadata';
import { getDevAdminClaims, isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';
import { generate, generateSecret, verify } from 'otplib';

process.env.JWT_SECRET ||= randomBytes(48).toString('base64url');

const validClaim = {
  firstName: 'Ada', lastName: 'Lovelace', phone: '434-555-1234', email: 'ada@example.com',
  zipCode: '24501', city: 'Lynchburg', state: 'VA', accidentDate: '2025-04-08',
  accidentType: 'Rear-End', injuriesReported: 'Yes', policeReportFiled: 'Unsure',
  atFaultStatus: 'Other Driver', description: 'A vehicle struck the rear of my car at a stop.', consentAgreed: true,
};

test('claim schema accepts valid data and requires consent', () => {
  assert.equal(claimInputSchema.parse(validClaim).state, 'VA');
  assert.equal(claimInputSchema.safeParse({ ...validClaim, consentAgreed: false }).success, false);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, zipCode: '2450x' }).success, false);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, website: 'bot' }).success, false);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, trustedFormCertUrl: 'https://attacker.example/cert' }).success, false);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, trustedFormCertUrl: 'https://cert.trustedform.com/cert-123' }).success, true);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, trustedFormCertUrl: 'https://trustedform.com/cert-123' }).success, true);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, trustedFormPingUrl: 'https://ping.trustedform.com/ping-123' }).success, true);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, trustedFormPingUrl: 'https://attacker.example/ping' }).success, false);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, clientIp: '203.0.113.12' }).success, true);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, clientIp: 'localhost' }).success, false);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, jornayaLeadId: 'not-a-uuid' }).success, false);
});

test('claim request metadata validates IPs and falls back to submitted location', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.12, 10.0.0.1',
    'x-vercel-ip-city': 'New%20York',
    'x-vercel-ip-country-region': 'NY',
    'x-vercel-ip-postal-code': '10001',
  });
  assert.deepEqual(getClaimRequestMetadata(headers, { city: 'Lynchburg', state: 'VA', zipCode: '24501' }), {
    ipAddress: '203.0.113.12',
    geoLocation: 'New York, NY 10001',
  });
  assert.deepEqual(getClaimRequestMetadata(new Headers({ 'x-forwarded-for': 'invalid', 'x-real-ip': '198.51.100.7' }), { city: 'Lynchburg', state: 'VA', zipCode: '24501' }), {
    ipAddress: '198.51.100.7',
    geoLocation: 'Lynchburg, VA 24501',
  });
  assert.equal(getClaimRequestMetadata(new Headers({ 'cf-connecting-ip': '2001:db8::1' }), { city: 'Lynchburg', state: 'VA', zipCode: '24501' }).ipAddress, '2001:db8::1');
  assert.equal(getClaimRequestMetadata(new Headers(), { city: 'Lynchburg', state: 'VA', zipCode: '24501' }, '203.0.113.99').ipAddress, '203.0.113.99');
  assert.equal(getClaimRequestMetadata(new Headers(), { city: 'Lynchburg', state: 'VA', zipCode: '24501' }, 'not-an-ip').ipAddress, '');
  assert.equal(getClaimRequestMetadata(new Headers({ 'x-forwarded-for': '::1', 'x-real-ip': '127.0.0.1' }), { city: 'Lynchburg', state: 'VA', zipCode: '24501' }, '2001:4860:4860::8888').ipAddress, '2001:4860:4860::8888');
});

test('TrustedForm certificate ID is extracted only from certificate host or token value', () => {
  assert.equal(extractTrustedFormCertId('https://cert.trustedform.com/certificate-123', ''), 'certificate-123');
  assert.equal(extractTrustedFormCertId('https://trustedform.com/certificate-789', ''), 'certificate-789');
  assert.equal(extractTrustedFormCertId('https://cert.trustedform.com/certificate-123', 'different-token'), 'certificate-123');
  assert.equal(extractTrustedFormCertId('', 'certificate-456'), 'certificate-456');
  assert.equal(extractTrustedFormCertId('https://example.com/certificate-123', ''), '');
});

test('local preview claims do not present fabricated IP or TrustedForm values', () => {
  for (const claim of getDevAdminClaims()) {
    assert.equal(claim.ipAddress, undefined);
    assert.equal(claim.trustedFormCertUrl, undefined);
    assert.equal(claim.trustedFormCertId, undefined);
  }
});

test('claim lookup accepts a single Claim ID, email, or normalized phone number', () => {
  assert.equal(claimLookupSchema.safeParse({ claimId: 'TCJ-84920', email: 'ada@example.com' }).success, true);
  assert.equal(claimLookupSchema.parse({ claimId: 'tcj84920' }).claimId, 'TCJ-84920');
  assert.equal(claimLookupSchema.parse({ email: 'ADA@example.com' }).email, 'ada@example.com');
  assert.equal(claimLookupSchema.parse({ phone: '(434) 849-6895' }).phone, '(434) 849-6895');
  assert.equal(claimLookupSchema.parse({ phone: '+1 (434) 849-6895' }).phone, '+1 (434) 849-6895');
  assert.equal(claimLookupSchema.safeParse({}).success, false);
  assert.equal(claimLookupSchema.safeParse({ claimId: 'invalid' }).success, false);
  assert.equal(claimLookupSchema.safeParse({ phone: '434-849' }).success, false);
  assert.equal(normalizeLookupPhone('(434) 849-6895'), '4348496895');
  assert.equal(normalizeLookupPhone('+1 (434) 849-6895'), '4348496895');
  const emailPattern = lookupEmailPattern('ada.lovelace+claim@example.com');
  assert.equal(emailPattern.test('ADA.LOVELACE+CLAIM@EXAMPLE.COM'), true);
  assert.equal(emailPattern.test('xada.lovelace+claim@example.com'), false);
  const phonePattern = lookupPhonePattern('(434) 849-6895');
  assert.equal(phonePattern.test('(434) 849-6895'), true);
  assert.equal(phonePattern.test('+1 (434) 849-6895'), true);
  assert.equal(phonePattern.test('4348496895'), true);
  assert.equal(phonePattern.test('4348496896'), false);
});

test('JSON request bodies require JSON content type and are size-limited', async () => {
  const request = new Request('https://claims.example/api/claims', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"name":"Ada"}',
  });
  assert.deepEqual(await readJson(request), { name: 'Ada' });

  const oversized = new Request('https://claims.example/api/claims', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{"name":"Ada"}',
  });
  await assert.rejects(readJson(oversized, 8), (error: unknown) => error instanceof ApiError && error.status === 413);

  const wrongContentType = new Request('https://claims.example/api/claims', {
    method: 'POST',
    headers: { 'content-type': 'text/plain' },
    body: '{"name":"Ada"}',
  });
  await assert.rejects(readJson(wrongContentType), (error: unknown) => error instanceof ApiError && error.status === 415);
});

test('CSRF token must match and request origin must be same-origin', () => {
  const valid = new NextRequest('https://claims.example/api/claims', {
    method: 'POST',
    headers: { host: 'claims.example', origin: 'https://claims.example', cookie: 'csrf-token=token123', 'x-csrf-token': 'token123' },
  });
  const crossOrigin = new NextRequest('https://claims.example/api/claims', {
    method: 'POST',
    headers: { host: 'claims.example', origin: 'https://attacker.example', cookie: 'csrf-token=token123', 'x-csrf-token': 'token123' },
  });
  assert.equal(csrfIsValid(valid), true);
  assert.equal(csrfIsValid(crossOrigin), false);
});

test('claim PDF JWT is claim-specific and short-lived', async () => {
  const token = await signClaimPdfToken('TCJ-84920');
  assert.equal(await verifyClaimPdfToken(token, 'TCJ-84920'), true);
  assert.equal(await verifyClaimPdfToken(token, 'TCJ-00001'), false);
  const chunks = token.split('.');
  chunks[2] = `${chunks[2][0] === 'A' ? 'B' : 'A'}${chunks[2].slice(1)}`;
  assert.equal(await verifyClaimPdfToken(chunks.join('.'), 'TCJ-84920').catch(() => false), false);
});

test('admin session is encrypted, signed, and carries current RBAC claims', async () => {
  const token = await signAdminToken({
    id: 'admin-123', email: 'operator@example.com', role: 'superadmin', sessionVersion: 4,
  }, true);
  assert.equal(token.includes('operator@example.com'), false);
  assert.deepEqual(
    (({ sub, email, role, ver }) => ({ sub, email, role, ver }))(await verifyAdminToken(token)),
    { sub: 'admin-123', email: 'operator@example.com', role: 'superadmin', ver: 4 },
  );
  const chunks = token.split('.');
  chunks[2] = `${chunks[2][0] === 'A' ? 'B' : 'A'}${chunks[2].slice(1)}`;
  await assert.rejects(verifyAdminToken(chunks.join('.')));
});

test('production admin cookies are HttpOnly, Secure, and SameSite Strict', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  Reflect.set(process.env, 'NODE_ENV', 'production');
  try {
    const response = NextResponse.json({});
    setAdminCookie(response, 'test-session');
    const cookie = response.headers.get('set-cookie') || '';
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Strict/i);
  } finally {
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Reflect.set(process.env, 'NODE_ENV', previousNodeEnv);
  }
});

test('production cannot enable the local admin bypass', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousBypass = process.env.DEV_BYPASS_ADMIN_AUTH;
  const previousMongoUri = process.env.MONGODB_URI;
  Reflect.set(process.env, 'NODE_ENV', 'production');
  process.env.DEV_BYPASS_ADMIN_AUTH = 'true';
  process.env.MONGODB_URI = '';
  try {
    assert.equal(isDevAdminPreviewEnabled(), false);
  } finally {
    if (previousNodeEnv === undefined) Reflect.deleteProperty(process.env, 'NODE_ENV');
    else Reflect.set(process.env, 'NODE_ENV', previousNodeEnv);
    if (previousBypass === undefined) delete process.env.DEV_BYPASS_ADMIN_AUTH;
    else process.env.DEV_BYPASS_ADMIN_AUTH = previousBypass;
    if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousMongoUri;
  }
});

test('AES-GCM TOTP secrets round-trip and verify authenticator codes', async () => {
  const secret = generateSecret();
  const encrypted = encryptAdminSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptAdminSecret(encrypted), secret);
  const token = await generate({ secret });
  assert.equal((await verify({ secret: decryptAdminSecret(encrypted), token })).valid, true);
});

test('team management rules protect superadmins and limit admin actions to viewers', () => {
  assert.doesNotThrow(() => assertCanCreateAdminRole('admin', 'viewer'));
  assert.throws(() => assertCanCreateAdminRole('admin', 'admin'), (error: unknown) => error instanceof ApiError && error.status === 403);
  assert.throws(() => assertCanCreateAdminRole('viewer', 'viewer'), (error: unknown) => error instanceof ApiError && error.status === 403);
  assert.doesNotThrow(() => assertCanManageAdmin('admin', 'viewer', 'delete'));
  assert.throws(() => assertCanManageAdmin('admin', 'viewer', 'edit'), (error: unknown) => error instanceof ApiError && error.status === 403);
  assert.throws(() => assertCanManageAdmin('superadmin', 'superadmin', 'delete'), (error: unknown) => error instanceof ApiError && error.status === 403);
});

test('PDFKit returns a two-page branded claim and consent record in memory', async () => {
  const pdf = await createClaimSummaryPdf({
    claimId: 'TCJ-84920', firstName: 'Ada', lastName: 'Lovelace', phone: '434-555-1234',
    email: 'ada@example.com', zipCode: '24501', city: 'Lynchburg', state: 'VA',
    accidentDate: new Date('2025-04-08T12:00:00Z'), accidentType: 'Rear-End', injuriesReported: 'Yes',
    policeReportFiled: 'Unsure', atFaultStatus: 'Other Driver', description: 'A rear-end collision at a stop.',
    ipAddress: '203.0.113.12', geoLocation: 'Lynchburg, VA 24501',
    trustedFormCertUrl: 'https://trustedform.com/certificate-123', trustedFormCertId: '',
    trustedFormPingUrl: 'https://ping.trustedform.com/ping-123',
    consentAgreed: true, consentTimestamp: new Date('2025-04-08T13:00:00Z'), createdAt: new Date('2025-04-08T13:00:00Z'), status: 'New Intake',
  });
  const source = pdf.toString('latin1');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal((source.match(/\/Type\s*\/Page\b/g) || []).length, 2);
  assert.ok(source.includes('https://thecollisionjustice.com/check-claim?id=TCJ-84920'));
  assert.ok(source.includes('https://trustedform.com/certificate-123'));
  assert.ok(source.includes('certificate-123'));
  assert.equal(source.includes('Pending ActiveProspect script'), false);
  assert.equal(source.includes('Not captured'), false);
  assert.equal(source.includes('LeadiD token'), false);
  assert.ok(pdf.length > 1000);
});