import { STATES } from '@/lib/brand';

export type ClaimLocationRecord = {
  claimantCity?: string | null;
  claimantState?: string | null;
  locationSource?: string | null;
  referenceIp?: string | null;
  referenceIpSource?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

export function createClaimLocationMetadata(city: string, state: string) {
  return {
    claimantCity: city,
    claimantState: state,
    locationSource: 'claimant_selected' as const,
    referenceIpProvider: 'Other / Unknown' as const,
  };
}

export function hasVerifiedReferenceIp(claim: ClaimLocationRecord) {
  return Boolean(claim.referenceIp?.trim() && claim.referenceIpSource === 'independently_verified_city_network');
}

export function getClaimantLocation(claim: ClaimLocationRecord) {
  return {
    city: claim.claimantCity?.trim() || claim.city?.trim() || '',
    state: claim.claimantState?.trim() || claim.state?.trim() || '',
    zipCode: claim.zipCode?.trim() || '',
  };
}

export function formatClaimantLocation(claim: ClaimLocationRecord) {
  const { city, state, zipCode } = getClaimantLocation(claim);
  const stateName = STATES.find(([code]) => code === state)?.[1] || state;
  const location = [city || 'Not available', stateName || 'Not available'].join(', ');
  return zipCode ? `${location} ${zipCode}` : location;
}
