import { ApiError } from '@/lib/api-error';
import type { DevAdminClaimUpdates } from '@/lib/dev-admin-preview';
import { isValidClaimCity, isValidManualCityName } from '@/lib/us-cities.server';
import type { adminClaimUpdateSchema } from '@/lib/validation';

export async function buildAdminClaimUpdates(
  input: ReturnType<typeof adminClaimUpdateSchema.parse>,
  currentCity: string,
  currentState: string,
): Promise<DevAdminClaimUpdates> {
  const updates: DevAdminClaimUpdates = {};
  if (input.firstName !== undefined) updates.firstName = input.firstName;
  if (input.lastName !== undefined) updates.lastName = input.lastName;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.email !== undefined) updates.email = input.email;
  if (input.zipCode !== undefined) updates.zipCode = input.zipCode;
  if (input.accidentType !== undefined) updates.accidentType = input.accidentType;
  if (input.injuriesReported !== undefined) updates.injuriesReported = input.injuriesReported;
  if (input.policeReportFiled !== undefined) updates.policeReportFiled = input.policeReportFiled;
  if (input.atFaultStatus !== undefined) updates.atFaultStatus = input.atFaultStatus;
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) updates.status = input.status;
  if (input.internalNotes !== undefined) updates.internalNotes = input.internalNotes;
  if (input.accidentDate !== undefined) updates.accidentDate = new Date(`${input.accidentDate}T12:00:00.000Z`);

  if (input.city !== undefined || input.state !== undefined) {
    const city = input.city ?? currentCity;
    const state = input.state ?? currentState;
    if (!await isValidClaimCity(state, city, false) && !isValidManualCityName(city)) {
      throw new ApiError(422, 'Select a city belonging to the chosen state or enter a valid city manually.');
    }
    updates.city = city;
    updates.state = state;
    updates.claimantCity = city;
    updates.claimantState = state;
    updates.locationSource = 'claimant_selected';
  }
  return updates;
}
