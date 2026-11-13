import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { STATES } from '@/lib/brand';

const stateCodes = new Set<string>(STATES.map(([code]) => code));
const cityDataDirectory = path.join(process.cwd(), 'public', 'data', 'us-cities');

export function isUsStateCode(value: string): value is (typeof STATES)[number][0] {
  return stateCodes.has(value);
}

export async function getUsCities(stateCode: string): Promise<string[]> {
  if (!isUsStateCode(stateCode)) throw new Error('Invalid state code.');
  const filePath = path.join(cityDataDirectory, `${stateCode}.json`);
  const contents = await readFile(filePath, 'utf8');
  const cities: unknown = JSON.parse(contents);
  if (!Array.isArray(cities) || cities.length === 0
    || !cities.every((city): city is string => typeof city === 'string' && city.trim().length > 0)
    || new Set(cities).size !== cities.length) {
    throw new Error(`City data for ${stateCode} is invalid.`);
  }
  return cities;
}

export function isValidManualCityName(city: string) {
  return city.length <= 120 && /^\p{L}[\p{L}\p{M} .,'’()-]*$/u.test(city);
}

export async function isValidClaimCity(stateCode: string, city: string, manualEntry: boolean) {
  if (!isUsStateCode(stateCode) || city.trim() !== city || city.length === 0 || city.length > 120) return false;
  if (manualEntry) return isValidManualCityName(city);
  return (await getUsCities(stateCode)).includes(city);
}
