import { Buffer } from 'node:buffer';
import { createClaimAuditChanges } from '@/lib/claim-audit';
import { ClaimAudit, type ClaimAuditActorRole } from '@/models/ClaimAudit';
import { ClaimLead } from '@/models/ClaimLead';

export type TrustedFormValidationResult =
  | { status: 'valid'; reason: null }
  | { status: 'invalid'; reason: 'invalid_certificate' }
  | { status: 'pending'; reason: 'credentials_missing' | 'credentials_rejected' | 'temporarily_unavailable' | 'invalid_response' };

export type TrustedFormVerificationFields = {
  trustedFormVerificationStatus: 'valid' | 'invalid' | 'pending';
  trustedFormVerificationAttempts: number;
  trustedFormVerificationLastAttemptAt: Date;
  trustedFormVerificationNextAttemptAt: Date | null;
  trustedFormVerificationError: string | null;
};

export type TrustedFormVerificationActor = {
  actorId: string;
  actorEmail: string;
  actorRole: ClaimAuditActorRole;
};

const retryDelaysMs = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000, 6 * 60 * 60_000];
const maxAttempts = 8;
const timeoutMs = 3_000;

export async function validateTrustedFormCertificate(
  certificateId: string,
  options: { apiKey?: string; fetcher?: typeof fetch; timeout?: number } = {},
): Promise<TrustedFormValidationResult> {
  const apiKey = options.apiKey ?? process.env.TRUSTEDFORM_API_KEY;
  if (!apiKey?.trim()) return { status: 'pending', reason: 'credentials_missing' };
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(certificateId)) {
    return { status: 'invalid', reason: 'invalid_certificate' };
  }

  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(
      `https://cert.trustedform.com/${encodeURIComponent(certificateId)}/validate`,
      {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`API:${apiKey}`).toString('base64')}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(options.timeout ?? timeoutMs),
        cache: 'no-store',
      },
    );
  } catch {
    return { status: 'pending', reason: 'temporarily_unavailable' };
  }

  if (response.status === 401 || response.status === 403) {
    return { status: 'pending', reason: 'credentials_rejected' };
  }
  if ([408, 425, 429].includes(response.status) || response.status >= 500) {
    return { status: 'pending', reason: 'temporarily_unavailable' };
  }
  if (!response.ok) return { status: 'pending', reason: 'invalid_response' };

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { status: 'pending', reason: 'invalid_response' };
  }
  if (!body || typeof body !== 'object' || !('outcome' in body)) {
    return { status: 'pending', reason: 'invalid_response' };
  }

  if (body.outcome === 'success' && response.ok) return { status: 'valid', reason: null };
  if (body.outcome === 'failure') return { status: 'invalid', reason: 'invalid_certificate' };
  return { status: 'pending', reason: 'invalid_response' };
}

export function getTrustedFormVerificationFields(
  result: TrustedFormValidationResult,
  previousAttempts: number,
  now = new Date(),
): TrustedFormVerificationFields {
  const attempts = result.status === 'pending' && result.reason === 'credentials_missing'
    ? previousAttempts
    : previousAttempts + 1;
  if (result.status !== 'pending') {
    return {
      trustedFormVerificationStatus: result.status,
      trustedFormVerificationAttempts: attempts,
      trustedFormVerificationLastAttemptAt: now,
      trustedFormVerificationNextAttemptAt: null,
      trustedFormVerificationError: result.reason,
    };
  }

  const nextDelay = result.reason === 'credentials_missing'
    ? 24 * 60 * 60_000
    : result.reason === 'credentials_rejected'
      ? 6 * 60 * 60_000
      : retryDelaysMs[Math.min(attempts - 1, retryDelaysMs.length - 1)];
  const exhausted = result.reason !== 'credentials_missing' && attempts >= maxAttempts;
  return {
    trustedFormVerificationStatus: 'pending',
    trustedFormVerificationAttempts: attempts,
    trustedFormVerificationLastAttemptAt: now,
    trustedFormVerificationNextAttemptAt: exhausted ? null : new Date(now.getTime() + nextDelay),
    trustedFormVerificationError: exhausted ? 'retry_limit_reached' : result.reason,
  };
}

export function getInitialTrustedFormVerificationFields(certificateId: string, now = new Date()) {
  return certificateId
    ? {
      trustedFormVerificationStatus: 'pending' as const,
      trustedFormVerificationAttempts: 0,
      trustedFormVerificationNextAttemptAt: now,
      trustedFormVerificationError: 'pending_validation',
    }
    : {
      trustedFormVerificationStatus: 'missing_certificate' as const,
      trustedFormVerificationAttempts: 0,
      trustedFormVerificationNextAttemptAt: null,
      trustedFormVerificationError: null,
    };
}

export async function recordTrustedFormValidation(
  claimId: string,
  expectedAttempts: number,
  result: TrustedFormValidationResult,
  actor: TrustedFormVerificationActor,
  retryBaseAttempts = expectedAttempts,
): Promise<TrustedFormVerificationFields | null> {
  const session = await ClaimLead.startSession();
  const savedFields: { value: TrustedFormVerificationFields | null } = { value: null };
  try {
    await session.withTransaction(async () => {
      const claim = await ClaimLead.findOne({
        claimId,
        trustedFormVerificationStatus: 'pending',
        trustedFormVerificationAttempts: expectedAttempts,
      }).session(session);
      if (!claim || !claim.trustedFormCertId) return;

      const fields = getTrustedFormVerificationFields(result, retryBaseAttempts);
      const previousValues = {
        trustedFormVerificationStatus: claim.trustedFormVerificationStatus,
        trustedFormVerificationAttempts: claim.trustedFormVerificationAttempts,
        trustedFormVerificationLastAttemptAt: claim.trustedFormVerificationLastAttemptAt,
        trustedFormVerificationNextAttemptAt: claim.trustedFormVerificationNextAttemptAt,
        trustedFormVerificationError: claim.trustedFormVerificationError,
      };
      claim.set(fields);
      await claim.save({ session });

      if (!(result.status === 'pending' && result.reason === 'credentials_missing')) {
        const changes = createClaimAuditChanges(previousValues, fields);
        if (changes.length) {
          await ClaimAudit.create([{
            claimId,
            ...actor,
            changedAt: new Date(),
            changes,
          }], { session });
        }
      }
      savedFields.value = fields;
    });
  } finally {
    await session.endSession();
  }
  return savedFields.value;
}
