import { isIP } from 'node:net';
import { open, type AsnResponse, type CityResponse, type Reader, type Response } from 'maxmind';
import path from 'node:path';

type GeoLiteDatabaseType = 'GeoLite2-City' | 'GeoLite2-ASN';
type GeoLiteReader<T extends Response> = Reader<T>;

export type GeoLite2Location = {
  country: string | null;
  region: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
} | null;

export type GeoLite2Network = {
  asn: number | null;
  organization: string | null;
  provider: 'AT&T' | 'Verizon' | 'Xfinity' | 'Spectrum' | 'Comcast' | 'Other / Unknown';
} | null;

declare global {
  var geoLite2CityReader: Promise<GeoLiteReader<CityResponse> | null> | undefined;
  var geoLite2AsnReader: Promise<GeoLiteReader<AsnResponse> | null> | undefined;
}

const cityDatabasePath = path.join(process.cwd(), 'data', 'GeoLite2-City.mmdb');
const asnDatabasePath = path.join(process.cwd(), 'data', 'GeoLite2-ASN.mmdb');

const nonPublicIPv4Ranges = [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24],
  ['192.31.196.0', 24], ['192.52.193.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['192.175.48.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const;

const nonPublicIPv6Ranges = [
  ['::', 96], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 23],
  ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20], ['fc00::', 7], ['fe80::', 10],
  ['fec0::', 10], ['ff00::', 8],
] as const;

function safeErrorSummary(error: unknown) {
  if (!(error instanceof Error)) return 'UnknownError';
  const code = 'code' in error && typeof error.code === 'string' ? ` (${error.code})` : '';
  return `${error.name}${code}`;
}

function isInSubnet(ip: string, network: string, prefix: number, version: 4 | 6) {
  const ipBytes = addressBytes(ip, version);
  const networkBytes = addressBytes(network, version);
  if (!ipBytes || !networkBytes) return false;
  const fullBytes = Math.floor(prefix / 8);
  const remainingBits = prefix % 8;
  for (let index = 0; index < fullBytes; index += 1) {
    if (ipBytes[index] !== networkBytes[index]) return false;
  }
  if (remainingBits === 0) return true;
  const mask = (0xff << (8 - remainingBits)) & 0xff;
  return (ipBytes[fullBytes] & mask) === (networkBytes[fullBytes] & mask);
}

function addressBytes(ip: string, version: 4 | 6) {
  if (version === 4) return ip.split('.').map(Number);

  let address = ip.toLowerCase();
  const dottedTail = address.match(/(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dottedTail) {
    const octets = dottedTail[2].split('.').map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    const firstWord = ((octets[0] << 8) | octets[1]).toString(16);
    const secondWord = ((octets[2] << 8) | octets[3]).toString(16);
    address = `${dottedTail[1]}${firstWord}:${secondWord}`;
  }

  const parts = address.split('::');
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(':') : [];
  const right = parts[1] ? parts[1].split(':') : [];
  const missingWords = 8 - left.length - right.length;
  if ((parts.length === 1 && missingWords !== 0) || (parts.length === 2 && missingWords < 1)) return null;
  const words = [...left, ...Array(missingWords).fill('0'), ...right];
  if (words.length !== 8 || words.some((word) => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  return words.flatMap((word) => {
    const value = Number.parseInt(word, 16);
    return [value >> 8, value & 0xff];
  });
}

function normalizeIpForLookup(ip: string) {
  const version = isIP(ip);
  if (version === 4) return ip;
  if (version !== 6) return null;

  const bytes = addressBytes(ip, 6);
  if (!bytes) return null;
  if (bytes.slice(0, 10).every((byte) => byte === 0) && bytes[10] === 0xff && bytes[11] === 0xff) {
    return bytes.slice(12).join('.');
  }
  return ip;
}

function isPublicIp(ip: string) {
  const normalizedIp = normalizeIpForLookup(ip);
  if (!normalizedIp) return false;

  if (isIP(normalizedIp) === 4) {
    return !nonPublicIPv4Ranges.some(([network, prefix]) => isInSubnet(normalizedIp, network, prefix, 4));
  }

  return isInSubnet(normalizedIp, '2000::', 3, 6)
    && !nonPublicIPv6Ranges.some(([network, prefix]) => isInSubnet(normalizedIp, network, prefix, 6));
}

export async function openGeoLite2Database<T extends Response>(
  filePath: string,
  expectedType: GeoLiteDatabaseType,
): Promise<GeoLiteReader<T> | null> {
  try {
    const reader = await open<T>(filePath);
    if (reader.metadata.databaseType !== expectedType) {
      const error = new Error('Database type mismatch');
      error.name = 'DatabaseTypeMismatch';
      throw error;
    }
    return reader;
  } catch (error) {
    console.warn(`${expectedType} database unavailable.`, safeErrorSummary(error));
    return null;
  }
}

function getCityReader() {
  if (!globalThis.geoLite2CityReader) {
    globalThis.geoLite2CityReader = openGeoLite2Database<CityResponse>(cityDatabasePath, 'GeoLite2-City');
  }
  return globalThis.geoLite2CityReader;
}

function getAsnReader() {
  if (!globalThis.geoLite2AsnReader) {
    globalThis.geoLite2AsnReader = openGeoLite2Database<AsnResponse>(asnDatabasePath, 'GeoLite2-ASN');
  }
  return globalThis.geoLite2AsnReader;
}

export function isValidGeoIpAddress(ip: string) {
  return isIP(ip) !== 0;
}

export function isPublicGeoIpAddress(ip: string) {
  return isPublicIp(ip);
}

export async function lookupGeoLite2Location(ip: string): Promise<GeoLite2Location> {
  const lookupIp = normalizeIpForLookup(ip);
  if (!lookupIp || !isPublicIp(ip)) return null;

  try {
    const reader = await getCityReader();
    if (!reader) return null;
    const result = reader.get(lookupIp);
    if (!result) return null;

    const location: Exclude<GeoLite2Location, null> = {
      country: result.country?.names.en || null,
      region: result.subdivisions?.[0]?.names.en || null,
      city: result.city?.names.en || null,
      postalCode: result.postal?.code || null,
      latitude: typeof result.location?.latitude === 'number' ? result.location.latitude : null,
      longitude: typeof result.location?.longitude === 'number' ? result.location.longitude : null,
    };
    return Object.values(location).some((value) => value !== null) ? location : null;
  } catch (error) {
    console.warn('GeoLite2 City lookup failed.', safeErrorSummary(error));
    return null;
  }
}

export async function lookupGeoLite2Network(ip: string): Promise<GeoLite2Network> {
  const lookupIp = normalizeIpForLookup(ip);
  if (!lookupIp || !isPublicIp(ip)) return null;

  try {
    const reader = await getAsnReader();
    if (!reader) return null;
    const result = reader.get(lookupIp);
    if (!result) return null;

    const organization = result.autonomous_system_organization?.trim() || null;
    const normalizedOrganization = organization?.toLowerCase() || '';
    const provider = /\bat&t\b/.test(normalizedOrganization) ? 'AT&T'
      : /\bverizon\b/.test(normalizedOrganization) ? 'Verizon'
        : /\bxfinity\b/.test(normalizedOrganization) ? 'Xfinity'
          : /\bspectrum\b/.test(normalizedOrganization) ? 'Spectrum'
            : /\bcomcast\b/.test(normalizedOrganization) ? 'Comcast'
              : 'Other / Unknown';

    if (!result.autonomous_system_number && !organization) return null;
    return {
      asn: result.autonomous_system_number || null,
      organization,
      provider,
    };
  } catch (error) {
    console.warn('GeoLite2 ASN lookup failed.', safeErrorSummary(error));
    return null;
  }
}

export function formatGeoLite2Location(location: Exclude<GeoLite2Location, null> | null) {
  if (!location) return '';
  return [
    location.city,
    location.region,
    location.country,
    location.postalCode,
  ].filter((part): part is string => Boolean(part?.trim())).join(', ').slice(0, 300);
}
