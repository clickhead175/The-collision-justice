import { isIP } from 'node:net';

type ClaimLocation = {
  city: string;
  state: string;
  zipCode: string;
};

function usableIp(value: string) {
  const candidate = value.trim().toLowerCase();
  if (!isIP(candidate) || candidate === '::1' || candidate === '127.0.0.1' || candidate.startsWith('127.')) return '';
  if (candidate.startsWith('::ffff:127.')) return '';
  return candidate;
}

function cleanHeader(value: string | null, maxLength: number) {
  if (!value) return '';
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Keep the original value when a proxy supplies a non-encoded header.
  }
  return decoded.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

export function getClaimRequestMetadata(headers: Headers, fallback: ClaimLocation, clientIp = '') {
  const forwardedIps = headers.get('x-forwarded-for')?.split(',') || [];
  const realIp = headers.get('x-real-ip') || '';
  const cloudflareIp = headers.get('cf-connecting-ip') || '';
  const ipAddress = [...forwardedIps, realIp, cloudflareIp].map(usableIp).find(Boolean)
    || usableIp(clientIp);
  const city = cleanHeader(headers.get('x-vercel-ip-city'), 120) || fallback.city;
  const state = cleanHeader(headers.get('x-vercel-ip-country-region'), 80) || fallback.state;
  const zipCode = cleanHeader(headers.get('x-vercel-ip-postal-code'), 20) || fallback.zipCode;
  const region = [city, state].filter(Boolean).join(', ');
  return {
    ipAddress,
    geoLocation: `${region}${region && zipCode ? ' ' : ''}${zipCode}`.slice(0, 300),
  };
}

export function extractTrustedFormCertId(certUrl: string, token: string) {
  if (certUrl) {
    try {
      const url = new URL(certUrl);
      if (url.protocol !== 'https:' || !['cert.trustedform.com', 'trustedform.com'].includes(url.hostname)) return '';
      const id = url.pathname.split('/').filter(Boolean).at(-1) || '';
      return /^[A-Za-z0-9_-]{1,256}$/.test(id) ? id : '';
    } catch {
      return '';
    }
  }
  const id = token.trim().split('/').filter(Boolean).at(-1)?.split(/[?#]/, 1)[0] || '';
  return /^[A-Za-z0-9_-]{1,256}$/.test(id) ? id : '';
}
