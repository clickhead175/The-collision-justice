export type DevPreviewClaim = {
  _id: string;
  claimId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  zipCode: string;
  city: string;
  state: string;
  claimantCity: string;
  claimantState: string;
  locationSource: 'claimant_selected';
  accidentDate: Date;
  accidentType: string;
  injuriesReported: string;
  policeReportFiled: string;
  atFaultStatus: string;
  description: string;
  trustedFormVerificationStatus: 'missing_certificate' | 'pending' | 'valid' | 'invalid';
  consentAgreed: boolean;
  consentTimestamp: Date;
  status: string;
  internalNotes: string;
  createdAt: Date;
};

export type DevAdminClaimUpdates = Partial<Pick<DevPreviewClaim,
  | 'firstName' | 'lastName' | 'phone' | 'email' | 'zipCode' | 'city' | 'state'
  | 'claimantCity' | 'claimantState' | 'locationSource' | 'accidentDate'
  | 'accidentType' | 'injuriesReported' | 'policeReportFiled' | 'atFaultStatus'
  | 'description' | 'status' | 'internalNotes'
>>;

type DevAdminActor = { actorId: string; actorEmail: string; actorRole: 'superadmin' | 'admin' };
type DevClaimAuditChange = { field: string; previousValue: unknown; newValue: unknown };
export type DevClaimAuditRecord = {
  _id: string;
  claimId: string;
  actorId: string;
  actorEmail: string;
  actorRole: 'superadmin' | 'admin';
  changedAt: Date;
  changes: DevClaimAuditChange[];
};

type ClaimFilters = {
  page: number;
  search: string;
  status: string;
  state: string;
  accidentType: string;
  limit: number;
};

function isPreviewEnabled() {
  return process.env.NODE_ENV === 'development'
    && process.env.DEV_BYPASS_ADMIN_AUTH === 'true'
    && !process.env.MONGODB_URI?.trim();
}

export const isDevAdminPreviewEnabled = isPreviewEnabled;

const globalPreview = globalThis as typeof globalThis & {
  __collisionJusticePreviewClaims?: DevPreviewClaim[];
  __collisionJusticePreviewAudit?: DevClaimAuditRecord[];
};

function previewClaims() {
  if (!globalPreview.__collisionJusticePreviewClaims) {
    const records: Array<Omit<DevPreviewClaim, '_id' | 'consentAgreed' | 'consentTimestamp' | 'createdAt' | 'trustedFormVerificationStatus'>> = [
      { claimId: 'TCJ-42819', firstName: 'Jordan', lastName: 'Miller', phone: '434-555-0101', email: 'jordan.miller@example.com', zipCode: '24501', city: 'Lynchburg', state: 'VA', claimantCity: 'Lynchburg', claimantState: 'VA', locationSource: 'claimant_selected', accidentDate: new Date('2026-10-28T12:00:00Z'), accidentType: 'Rear-End', injuriesReported: 'Yes', policeReportFiled: 'Yes', atFaultStatus: 'Other Driver', description: 'Demo record: rear-end collision at a traffic light. Driver is organizing incident documents.', status: 'New Intake', internalNotes: '' },
      { claimId: 'TCJ-57302', firstName: 'Casey', lastName: 'Reed', phone: '804-555-0102', email: 'casey.reed@example.com', zipCode: '23220', city: 'Richmond', state: 'VA', claimantCity: 'Richmond', claimantState: 'VA', locationSource: 'claimant_selected', accidentDate: new Date('2026-10-21T12:00:00Z'), accidentType: 'Side-Impact', injuriesReported: 'No', policeReportFiled: 'Yes', atFaultStatus: 'Shared', description: 'Demo record: intersection side-impact. Police report requested for the file.', status: 'Reviewing Docs', internalNotes: 'Demo only: awaiting a copy of the report.' },
      { claimId: 'TCJ-61947', firstName: 'Taylor', lastName: 'Brooks', phone: '757-555-0103', email: 'taylor.brooks@example.com', zipCode: '23510', city: 'Norfolk', state: 'VA', claimantCity: 'Norfolk', claimantState: 'VA', locationSource: 'claimant_selected', accidentDate: new Date('2026-10-13T12:00:00Z'), accidentType: 'Multi-Vehicle', injuriesReported: 'Yes', policeReportFiled: 'Unsure', atFaultStatus: 'Unsure', description: 'Demo record: multi-vehicle incident; collecting contact and insurance details.', status: 'Assigned', internalNotes: '' },
      { claimId: 'TCJ-70435', firstName: 'Morgan', lastName: 'Hayes', phone: '703-555-0104', email: 'morgan.hayes@example.com', zipCode: '22101', city: 'McLean', state: 'VA', claimantCity: 'McLean', claimantState: 'VA', locationSource: 'claimant_selected', accidentDate: new Date('2026-09-30T12:00:00Z'), accidentType: 'Rear-End', injuriesReported: 'Yes', policeReportFiled: 'Yes', atFaultStatus: 'Other Driver', description: 'Demo record: rear-end collision with photographs and medical visit details to review.', status: 'Filed', internalNotes: 'Demo only: sample status for dashboard preview.' },
      { claimId: 'TCJ-81526', firstName: 'Riley', lastName: 'Carter', phone: '540-555-0105', email: 'riley.carter@example.com', zipCode: '24011', city: 'Roanoke', state: 'VA', claimantCity: 'Roanoke', claimantState: 'VA', locationSource: 'claimant_selected', accidentDate: new Date('2026-09-18T12:00:00Z'), accidentType: 'Hit & Run', injuriesReported: 'No', policeReportFiled: 'Yes', atFaultStatus: 'Unsure', description: 'Demo record: hit-and-run incident with a report filed after the collision.', status: 'Closed', internalNotes: '' },
      { claimId: 'TCJ-93640', firstName: 'Avery', lastName: 'Parker', phone: '434-555-0106', email: 'avery.parker@example.com', zipCode: '24502', city: 'Lynchburg', state: 'VA', claimantCity: 'Lynchburg', claimantState: 'VA', locationSource: 'claimant_selected', accidentDate: new Date('2026-09-05T12:00:00Z'), accidentType: 'Other', injuriesReported: 'No', policeReportFiled: 'No', atFaultStatus: 'Shared', description: 'Demo record: low-speed parking-lot collision; driver is gathering photos.', status: 'New Intake', internalNotes: '' },
    ];
    globalPreview.__collisionJusticePreviewClaims = records.map((claim, index) => {
      const createdAt = new Date(Date.UTC(2026, 9, 29 - index * 4, 15, 30));
      return {
        ...claim,
        _id: `preview-claim-${index + 1}`,
        consentAgreed: true,
        consentTimestamp: createdAt,
        createdAt,
        trustedFormVerificationStatus: 'missing_certificate' as const,
      };
    });
  }
  return globalPreview.__collisionJusticePreviewClaims;
}

export function getDevAdminClaims() {
  return [...previewClaims()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function findDevAdminClaim(claimId: string) {
  return previewClaims().find((claim) => claim.claimId === claimId) ?? null;
}

function previewAudit() {
  if (!globalPreview.__collisionJusticePreviewAudit) globalPreview.__collisionJusticePreviewAudit = [];
  return globalPreview.__collisionJusticePreviewAudit;
}

export function getDevAdminClaimAudit(claimId: string) {
  return previewAudit().filter((event) => event.claimId === claimId).sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime());
}

export function updateDevAdminClaim(claimId: string, updates: DevAdminClaimUpdates, actor: DevAdminActor) {
  const claim = findDevAdminClaim(claimId);
  if (!claim) return null;
  const changes = Object.entries(updates).flatMap(([field, newValue]) => {
    const previousValue = claim[field as keyof DevPreviewClaim] ?? null;
    const unchanged = previousValue instanceof Date && newValue instanceof Date
      ? previousValue.getTime() === newValue.getTime()
      : Object.is(previousValue, newValue);
    return unchanged ? [] : [{ field, previousValue, newValue: newValue ?? null }];
  });
  Object.assign(claim, updates);
  const auditEvent = changes.length ? {
    _id: `preview-audit-${previewAudit().length + 1}`,
    claimId,
    ...actor,
    changedAt: new Date(),
    changes,
  } : null;
  if (auditEvent) previewAudit().push(auditEvent);
  return { claim, auditEvent };
}

export function getDevAdminClaimsPage(filters: ClaimFilters) {
  const allClaims = getDevAdminClaims();
  const search = filters.search.toLocaleLowerCase();
  const filtered = allClaims.filter((claim) =>
    (!filters.status || claim.status === filters.status)
    && (!filters.state || claim.state === filters.state)
    && (!filters.accidentType || claim.accidentType === filters.accidentType)
    && (!search || [claim.claimId, claim.firstName, claim.lastName, claim.phone, claim.zipCode]
      .some((value) => value.toLocaleLowerCase().includes(search))),
  );
  const newIntakes = allClaims.filter((claim) => claim.status === 'New Intake').length;
  const pendingDocs = allClaims.filter((claim) => claim.status === 'Reviewing Docs').length;
  const filed = allClaims.filter((claim) => claim.status === 'Filed').length;
  const lastPage = Math.max(1, Math.ceil(filtered.length / filters.limit));
  const page = Math.min(filters.page, lastPage);
  const start = (page - 1) * filters.limit;
  return {
    claims: filtered.slice(start, start + filters.limit),
    totalClaims: allClaims.length,
    newIntakes,
    pendingDocs,
    filed,
    page,
    lastPage,
  };
}

export function getDevAdminPreviewIdentity() {
  return {
    _id: 'local-preview-admin',
    email: 'preview@localhost',
    name: 'Local Preview Admin',
    role: 'superadmin' as const,
    isTwoFactorEnabled: false,
    sessionVersion: 0,
    createdAt: new Date(0),
  };
}
