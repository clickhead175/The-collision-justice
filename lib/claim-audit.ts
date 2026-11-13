import { ApiError } from '@/lib/api-error';
import type { AdminRole } from '@/lib/auth';
import type { ClaimAuditChange } from '@/models/ClaimAudit';

export function assertCanEditClaim(role: AdminRole): asserts role is Exclude<AdminRole, 'viewer'> {
  if (role === 'viewer') throw new ApiError(403, 'You do not have permission to edit claims.');
}

export function createClaimAuditChanges<Before extends object, After extends object>(
  before: Before,
  after: After,
): ClaimAuditChange[] {
  const previous = before as Record<string, unknown>;
  return Object.entries(after).flatMap(([field, value]) => {
    const previousValue = previous[field] ?? null;
    const newValue = (value as unknown) ?? null;
    const unchanged = previousValue instanceof Date && newValue instanceof Date
      ? previousValue.getTime() === newValue.getTime()
      : Object.is(previousValue, newValue);
    return unchanged ? [] : [{ field, previousValue, newValue }];
  });
}
