import { isIP } from 'node:net';
import {
  formatGeoLite2Location,
  lookupGeoLite2Location,
  lookupGeoLite2Network,
} from '@/lib/geolite2.server';

function usableIp(value: string) {
  const candidate = value.trim().toLowerCase();
  return isIP(candidate) ? candidate : '';
}

export async function getClaimRequestMetadata(headers: Headers) {
  const vercelForwardedIps = headers.get('x-vercel-forwarded-for')?.split(',') || [];
  const ipAddress = vercelForwardedIps.map(usableIp).find(Boolean) || '';
  const [location, network] = ipAddress
    ? await Promise.all([lookupGeoLite2Location(ipAddress), lookupGeoLite2Network(ipAddress)])
    : [null, null];
  return {
    ipAddress,
    geoLocation: formatGeoLite2Location(location),
    ...(location ? {
      geoLocationSource: 'geolite2',
      geoCountry: location.country || undefined,
      geoRegion: location.region || undefined,
      geoCity: location.city || undefined,
      geoPostalCode: location.postalCode || undefined,
      geoLatitude: location.latitude ?? undefined,
      geoLongitude: location.longitude ?? undefined,
    } : {}),
    ...(network ? {
      submitterAsn: network.asn ?? undefined,
      submitterAsnOrganization: network.organization || undefined,
      submitterNetworkProvider: network.provider,
    } : {}),
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
