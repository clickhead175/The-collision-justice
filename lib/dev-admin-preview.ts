import { CLAIM_STATUSES } from '@/lib/brand';

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
  accidentDate: Date;
  accidentType: string;
  injuriesReported: string;
  policeReportFiled: string;
  atFaultStatus: string;
  description: string;
  ipAddress?: string;
  geoLocation: string;
  trustedFormCertUrl?: string;
  trustedFormCertId?: string;
  trustedFormPingUrl?: string;
  consentAgreed: boolean;
  consentTimestamp: Date;
  status: string;
  internalNotes: string;
  createdAt: Date;
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

const globalPreview = globalThis as typeof globalThis & { __collisionJusticePreviewClaims?: DevPreviewClaim[] };

function previewClaims() {
  if (!globalPreview.__collisionJusticePreviewClaims) {
    const records: Array<Omit<DevPreviewClaim, '_id' | 'consentAgreed' | 'consentTimestamp' | 'createdAt'>> = [
      { claimId: 'TCJ-42819', firstName: 'Jordan', lastName: 'Miller', phone: '434-555-0101', email: 'jordan.miller@example.com', zipCode: '24501', city: 'Lynchburg', state: 'VA', accidentDate: new Date('2026-10-28T12:00:00Z'), accidentType: 'Rear-End', injuriesReported: 'Yes', policeReportFiled: 'Yes', atFaultStatus: 'Other Driver', description: 'Demo record: rear-end collision at a traffic light. Driver is organizing incident documents.', ipAddress: '192.0.2.41', geoLocation: 'Lynchburg, VA 24501', trustedFormCertUrl: 'https://trustedform.com/demo-cert-42819', trustedFormCertId: 'demo-cert-42819', status: 'New Intake', internalNotes: '' },
      { claimId: 'TCJ-57302', firstName: 'Casey', lastName: 'Reed', phone: '804-555-0102', email: 'casey.reed@example.com', zipCode: '23220', city: 'Richmond', state: 'VA', accidentDate: new Date('2026-10-21T12:00:00Z'), accidentType: 'Side-Impact', injuriesReported: 'No', policeReportFiled: 'Yes', atFaultStatus: 'Shared', description: 'Demo record: intersection side-impact. Police report requested for the file.', ipAddress: '192.0.2.42', geoLocation: 'Richmond, VA 23220', trustedFormCertUrl: 'https://trustedform.com/demo-cert-57302', trustedFormCertId: 'demo-cert-57302', status: 'Reviewing Docs', internalNotes: 'Demo only: awaiting a copy of the report.' },
      { claimId: 'TCJ-61947', firstName: 'Taylor', lastName: 'Brooks', phone: '757-555-0103', email: 'taylor.brooks@example.com', zipCode: '23510', city: 'Norfolk', state: 'VA', accidentDate: new Date('2026-10-13T12:00:00Z'), accidentType: 'Multi-Vehicle', injuriesReported: 'Yes', policeReportFiled: 'Unsure', atFaultStatus: 'Unsure', description: 'Demo record: multi-vehicle incident; collecting contact and insurance details.', ipAddress: '192.0.2.43', geoLocation: 'Norfolk, VA 23510', trustedFormCertUrl: 'https://trustedform.com/demo-cert-61947', trustedFormCertId: 'demo-cert-61947', status: 'Assigned', internalNotes: '' },
      { claimId: 'TCJ-70435', firstName: 'Morgan', lastName: 'Hayes', phone: '703-555-0104', email: 'morgan.hayes@example.com', zipCode: '22101', city: 'McLean', state: 'VA', accidentDate: new Date('2026-09-30T12:00:00Z'), accidentType: 'Rear-End', injuriesReported: 'Yes', policeReportFiled: 'Yes', atFaultStatus: 'Other Driver', description: 'Demo record: rear-end collision with photographs and medical visit details to review.', ipAddress: '192.0.2.44', geoLocation: 'McLean, VA 22101', trustedFormCertUrl: 'https://trustedform.com/demo-cert-70435', trustedFormCertId: 'demo-cert-70435', status: 'Filed', internalNotes: 'Demo only: sample status for dashboard preview.' },
      { claimId: 'TCJ-81526', firstName: 'Riley', lastName: 'Carter', phone: '540-555-0105', email: 'riley.carter@example.com', zipCode: '24011', city: 'Roanoke', state: 'VA', accidentDate: new Date('2026-09-18T12:00:00Z'), accidentType: 'Hit & Run', injuriesReported: 'No', policeReportFiled: 'Yes', atFaultStatus: 'Unsure', description: 'Demo record: hit-and-run incident with a report filed after the collision.', ipAddress: '192.0.2.45', geoLocation: 'Roanoke, VA 24011', trustedFormCertUrl: 'https://trustedform.com/demo-cert-81526', trustedFormCertId: 'demo-cert-81526', status: 'Closed', internalNotes: '' },
      { claimId: 'TCJ-93640', firstName: 'Avery', lastName: 'Parker', phone: '434-555-0106', email: 'avery.parker@example.com', zipCode: '24502', city: 'Lynchburg', state: 'VA', accidentDate: new Date('2026-09-05T12:00:00Z'), accidentType: 'Other', injuriesReported: 'No', policeReportFiled: 'No', atFaultStatus: 'Shared', description: 'Demo record: low-speed parking-lot collision; driver is gathering photos.', ipAddress: '192.0.2.46', geoLocation: 'Lynchburg, VA 24502', trustedFormCertUrl: 'https://trustedform.com/demo-cert-93640', trustedFormCertId: 'demo-cert-93640', status: 'New Intake', internalNotes: '' },
    ];
    globalPreview.__collisionJusticePreviewClaims = records.map((claim, index) => {
      const createdAt = new Date(Date.UTC(2026, 9, 29 - index * 4, 15, 30));
      const {
        ipAddress: _mockIpAddress,
        trustedFormCertUrl: _mockTrustedFormUrl,
        trustedFormCertId: _mockTrustedFormId,
        trustedFormPingUrl: _mockTrustedFormPingUrl,
        ...previewClaim
      } = claim;
      return {
        ...previewClaim,
        _id: `preview-claim-${index + 1}`,
        consentAgreed: true,
        consentTimestamp: createdAt,
        createdAt,
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

export function updateDevAdminClaim(claimId: string, updates: { status?: (typeof CLAIM_STATUSES)[number]; internalNotes?: string }) {
  const claim = findDevAdminClaim(claimId);
  if (!claim) return null;
  if (updates.status) claim.status = updates.status;
  if (updates.internalNotes !== undefined) claim.internalNotes = updates.internalNotes;
  return claim;
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
