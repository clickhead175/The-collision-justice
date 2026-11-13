import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
import { createClaimLocationMetadata, formatClaimantLocation, getClaimantLocation, hasVerifiedReferenceIp } from '@/lib/claim-location';
import { readJson } from '@/lib/request';
import { claimInputSchema, claimLookupSchema, lookupEmailPattern, lookupPhonePattern, normalizeLookupPhone } from '@/lib/validation';
import { extractTrustedFormCertId, getClaimRequestMetadata } from '@/lib/claim-request-metadata';
import { isValidClaimCity, isValidManualCityName } from '@/lib/us-cities.server';
import {
  isPublicGeoIpAddress,
  isValidGeoIpAddress,
  lookupGeoLite2Location,
  lookupGeoLite2Network,
  openGeoLite2Database,
} from '@/lib/geolite2.server';
import type { AsnResponse, CityResponse } from 'maxmind';
import { getDevAdminClaims, isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';
import { ClaimLead } from '@/models/ClaimLead';
import { generate, generateSecret, verify } from 'otplib';

process.env.JWT_SECRET ||= randomBytes(48).toString('base64url');

const validClaim = {
  firstName: 'Ada', lastName: 'Lovelace', phone: '434-555-1234', email: 'ada@example.com',
  zipCode: '24501', city: 'Lynchburg', state: 'VA', accidentDate: '2025-04-08',
  accidentType: 'Rear-End', injuriesReported: 'Yes', policeReportFiled: 'Unsure',
  atFaultStatus: 'Other Driver', description: 'A vehicle struck the rear of my car at a stop.',
  trustedFormCertUrl: 'https://cert.trustedform.com/certificate-123', consentAgreed: true,
};

test('claim schema accepts valid data and requires consent', () => {
  assert.equal(claimInputSchema.parse(validClaim).state, 'VA');
  assert.equal(claimInputSchema.safeParse({ ...validClaim, state: 'ZZ' }).success, false);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, trustedFormCertUrl: '' }).success, false);
  assert.equal(claimInputSchema.safeParse({ ...validClaim, trustedFormCertUrl: 'https://cert.trustedform.com/%2F' }).success, false);
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

test('claim request metadata uses GeoLite2 instead of client-submitted location headers', async () => {
  const headers = new Headers({
    'x-vercel-forwarded-for': '8.8.4.4, 10.0.0.1',
    'x-vercel-ip-city': 'Untrusted%20City',
    'x-vercel-ip-country-region': 'ZZ',
    'x-vercel-ip-postal-code': '00000',
  });
  const metadata = await getClaimRequestMetadata(headers);
  assert.equal(metadata.ipAddress, '8.8.4.4');
  assert.equal(metadata.geoLocation, 'Westfield, Massachusetts, United States, 01085');
  assert.equal(metadata.geoLocationSource, 'geolite2');
  assert.equal(metadata.geoCity, 'Westfield');
  assert.equal(metadata.geoRegion, 'Massachusetts');
  assert.equal(metadata.geoCountry, 'United States');
  assert.equal(metadata.geoPostalCode, '01085');
  assert.equal(metadata.geoLatitude, 42.1293);
  assert.equal(metadata.geoLongitude, -72.7522);
  assert.equal('claimantCity' in metadata, false);
  assert.equal('claimantState' in metadata, false);

  const missingIp = await getClaimRequestMetadata(new Headers({
    'x-vercel-ip-city': 'Untrusted%20City',
    'x-forwarded-for': '8.8.4.4',
  }));
  assert.equal(missingIp.ipAddress, '');
  assert.equal(missingIp.geoLocation, '');
  assert.equal('geoLocationSource' in missingIp, false);

  const untrustedIpHeaders = await getClaimRequestMetadata(new Headers({
    'x-real-ip': '8.8.4.4',
    'cf-connecting-ip': '8.8.4.4',
    'x-forwarded-for': '8.8.4.4',
  }));
  assert.equal(untrustedIpHeaders.ipAddress, '');
  assert.equal(untrustedIpHeaders.geoLocation, '');

  const privateIp = await getClaimRequestMetadata(new Headers({ 'x-vercel-forwarded-for': '127.0.0.1' }));
  assert.equal(privateIp.ipAddress, '127.0.0.1');
  assert.equal(privateIp.geoLocation, '');
  assert.equal('geoLocationSource' in privateIp, false);
});

test('GeoLite2 City lookup returns database fields for a public IPv4 address', async () => {
  assert.deepEqual(await lookupGeoLite2Location('8.8.4.4'), {
    country: 'United States',
    region: 'Massachusetts',
    city: 'Westfield',
    postalCode: '01085',
    latitude: 42.1293,
    longitude: -72.7522,
  });
});

test('GeoLite2 City lookup supports public IPv6 and IPv4-mapped IPv6', async () => {
  const ipv6Location = await lookupGeoLite2Location('2001:4860:4860::8888');
  assert.equal(ipv6Location?.country, 'United States');
  assert.equal(ipv6Location?.latitude, 37.751);
  assert.deepEqual(await lookupGeoLite2Location('::ffff:8.8.4.4'), await lookupGeoLite2Location('8.8.4.4'));
  assert.deepEqual(await lookupGeoLite2Location('::ffff:808:404'), await lookupGeoLite2Location('8.8.4.4'));
});

test('GeoLite2 ASN lookup returns the installed database ASN and organization', async () => {
  const expectedNetwork = {
    asn: 15169,
    organization: 'Google LLC',
    provider: 'Other / Unknown',
  };
  assert.deepEqual(await lookupGeoLite2Network('8.8.4.4'), expectedNetwork);
  assert.deepEqual(await lookupGeoLite2Network('2001:4860:4860::8888'), expectedNetwork);
});

test('GeoLite2 lookups reject invalid, private, loopback, and reserved IP addresses', async () => {
  for (const ip of ['invalid-ip', '10.0.0.1', '127.0.0.1', '192.0.2.1', '203.0.113.1', '::1', 'fc00::1', '::ffff:10.0.0.1']) {
    assert.equal(await lookupGeoLite2Location(ip), null, ip);
    assert.equal(await lookupGeoLite2Network(ip), null, ip);
  }
  assert.equal(isValidGeoIpAddress('8.8.8.8'), true);
  assert.equal(isValidGeoIpAddress('invalid-ip'), false);
  assert.equal(isPublicGeoIpAddress('8.8.8.8'), true);
  assert.equal(isPublicGeoIpAddress('2001:4860:4860::8888'), true);
  assert.equal(isPublicGeoIpAddress('10.0.0.1'), false);
  assert.equal(isPublicGeoIpAddress('127.0.0.1'), false);
  assert.equal(isPublicGeoIpAddress('192.0.2.1'), false);
  assert.equal(isPublicGeoIpAddress('invalid-ip'), false);
});

test('missing GeoLite2 City and ASN database files fail safely', async () => {
  const missingPath = path.join(tmpdir(), `missing-geolite2-${randomBytes(8).toString('hex')}.mmdb`);
  assert.equal(await openGeoLite2Database<CityResponse>(missingPath, 'GeoLite2-City'), null);
  assert.equal(await openGeoLite2Database<AsnResponse>(missingPath, 'GeoLite2-ASN'), null);
});

test('claimant cities must belong to the selected state unless valid manual entry is used', async () => {
  assert.equal(await isValidClaimCity('CA', 'Los Angeles city', false), true);
  assert.equal(await isValidClaimCity('TX', 'Los Angeles city', false), false);
  assert.equal(await isValidClaimCity('ZZ', 'Los Angeles city', false), false);
  assert.equal(await isValidClaimCity('CA', 'Santa Barbara', true), true);
  assert.equal(await isValidClaimCity('CA', 'Santa Barbara\ninvalid', true), false);
  assert.equal(await isValidClaimCity('CA', 'x'.repeat(121), true), false);
  assert.equal(isValidManualCityName("O'Fallon"), true);
  assert.equal(isValidManualCityName('Wrong/City'), false);
});

test('claimant-selected location stays independent from IP geolocation', async () => {
  const requestMetadata = await getClaimRequestMetadata(new Headers({ 'x-vercel-forwarded-for': '8.8.4.4' }));
  const claimantMetadata = createClaimLocationMetadata('Los Angeles city', 'CA');
  assert.deepEqual(claimantMetadata, {
    claimantCity: 'Los Angeles city',
    claimantState: 'CA',
    locationSource: 'claimant_selected',
    referenceIpProvider: 'Other / Unknown',
  });
  assert.equal(requestMetadata.geoCity, 'Westfield');
  assert.equal(requestMetadata.geoRegion, 'Massachusetts');
  assert.equal('claimantCity' in requestMetadata, false);
  assert.equal('claimantState' in requestMetadata, false);
  const claimWithSeparateLocations = new ClaimLead({
    ...validClaim,
    ...claimantMetadata,
    ...requestMetadata,
    claimId: 'TCJ-84922',
    accidentDate: new Date('2025-04-08T12:00:00Z'),
    consentTimestamp: new Date('2025-04-08T13:00:00Z'),
    status: 'New Intake',
  });
  await claimWithSeparateLocations.validate();
  assert.equal(claimWithSeparateLocations.claimantCity, 'Los Angeles city');
  assert.equal(claimWithSeparateLocations.claimantState, 'CA');
  assert.equal(claimWithSeparateLocations.geoCity, 'Westfield');
  assert.equal(claimWithSeparateLocations.geoRegion, 'Massachusetts');
  assert.equal(claimWithSeparateLocations.submitterAsn, 15169);
  assert.equal(claimWithSeparateLocations.submitterAsnOrganization, 'Google LLC');
  assert.equal(claimWithSeparateLocations.referenceIp, undefined);
  const claim = {
    city: 'Kampala',
    state: 'UG',
    claimantCity: 'Los Angeles city',
    claimantState: 'CA',
    geoLocation: 'Kampala, Central Region',
    referenceIpGeoLocation: 'New York, NY',
    zipCode: '90001',
  };
  assert.deepEqual(getClaimantLocation(claim), {
    city: 'Los Angeles city',
    state: 'CA',
    zipCode: '90001',
  });
  assert.equal(formatClaimantLocation(claim), 'Los Angeles city, California 90001');
  assert.equal(formatClaimantLocation({ city: 'Legacy City', state: 'TX', zipCode: '73301' }), 'Legacy City, Texas 73301');
  assert.equal(hasVerifiedReferenceIp({ referenceIp: '198.51.100.20' }), false);
  assert.equal(hasVerifiedReferenceIp({ referenceIp: '198.51.100.20', referenceIpSource: 'independently_verified_city_network' }), true);
});

test('claim schema supports claimant location and optional network reference fields without requiring a reference IP', async () => {
  const claim = new ClaimLead({
    ...validClaim,
    claimId: 'TCJ-84920',
    accidentDate: new Date('2025-04-08T12:00:00Z'),
    claimantCity: 'Los Angeles city',
    claimantState: 'CA',
    locationSource: 'claimant_selected',
    referenceIpProvider: 'Other / Unknown',
    consentTimestamp: new Date('2025-04-08T13:00:00Z'),
    status: 'New Intake',
  });
  await claim.validate();
  assert.equal(claim.claimantCity, 'Los Angeles city');
  assert.equal(claim.claimantState, 'CA');
  assert.equal(claim.locationSource, 'claimant_selected');
  assert.equal(claim.referenceIp, undefined);
  assert.equal(claim.referenceIpProvider, 'Other / Unknown');

  const legacyClaim = new ClaimLead({
    ...validClaim,
    claimId: 'TCJ-84921',
    accidentDate: new Date('2025-04-08T12:00:00Z'),
    consentTimestamp: new Date('2025-04-08T13:00:00Z'),
    status: 'New Intake',
  });
  await legacyClaim.validate();
  assert.equal(legacyClaim.claimantCity, undefined);
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
  const claimWithUnwantedMetadata = {
    claimId: 'TCJ-84920', firstName: 'Ada', lastName: 'Lovelace', phone: '434-555-1234',
    email: 'ada@example.com', zipCode: '90001', city: 'Bakersfield city', state: 'CA',
    claimantCity: 'Los Angeles city', claimantState: 'CA', locationSource: 'claimant_selected',
    accidentDate: new Date('2025-04-08T12:00:00Z'), accidentType: 'Rear-End', injuriesReported: 'Yes',
    policeReportFiled: 'Unsure', atFaultStatus: 'Other Driver', description: 'A rear-end collision at a stop.',
    ipAddress: '203.0.113.12', geoLocation: 'Untrusted location sentinel', geoLocationSource: 'geolite2',
    referenceIp: '198.51.100.20', referenceIpOrganization: 'Unsupported example network',
    trustedFormCertUrl: 'https://trustedform.com/certificate-123', trustedFormCertId: '',
    trustedFormPingUrl: 'https://ping.trustedform.com/ping-123',
    consentAgreed: true, consentTimestamp: new Date('2025-04-08T13:00:00Z'), createdAt: new Date('2025-04-08T13:00:00Z'), status: 'New Intake',
  };
  const pdf = await createClaimSummaryPdf(claimWithUnwantedMetadata);
  const source = pdf.toString('latin1');
  const pdfText = [...source.matchAll(/<([0-9a-f]{2,})>/gi)]
    .map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1'))
    .join('');
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal((source.match(/\/Type\s*\/Page\b/g) || []).length, 2);
  assert.ok(source.includes('https://thecollisionjustice.com/check-claim?id=TCJ-84920'));
  assert.ok(pdfText.includes('Los Angeles city, California 90001'));
  assert.ok(pdfText.includes('Location'));
  assert.ok(pdfText.includes('IP address'));
  assert.ok(pdfText.includes('Submitted'));
  assert.ok(pdfText.includes('Reference'));
  assert.ok(pdfText.includes('TrustedForm'));
  assert.ok(pdfText.includes('Lead ID'));
  assert.ok(pdfText.includes('Normalized provider'));
  assert.ok(pdfText.includes('Other / Unknown'));
  assert.equal(pdfText.includes('198.51.100.20'), false);
  assert.equal(pdfText.includes('203.0.113.12'), false);
  assert.equal(pdfText.includes('Untrusted location sentinel'), false);
  assert.equal(pdfText.includes('Submitter IP'), false);
  assert.equal(pdfText.includes('IP location'), false);
  assert.equal(pdfText.includes('Reference IP'), false);
  assert.equal(pdfText.includes('Original network organization'), false);
  assert.equal(pdfText.includes('Reference ASN'), false);
  assert.equal(pdfText.includes('Reference source'), false);
  assert.equal(pdfText.includes('Pakistan'), false);
  assert.equal(pdfText.includes('Ping URL'), false);
  assert.ok(source.includes('https://trustedform.com/certificate-123'));
  assert.ok(pdfText.includes('certificate-123'));
  assert.equal(source.includes('https://ping.trustedform.com/ping-123'), false);
  assert.equal(source.includes('Pending ActiveProspect script'), false);
  assert.equal(source.includes('Not captured'), false);
  assert.equal(source.includes('LeadiD token'), false);
  assert.ok(pdf.length > 1000);
});