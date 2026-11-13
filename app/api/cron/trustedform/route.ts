import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { apiError, ApiError } from '@/lib/api-error';
import { connectToDatabase } from '@/lib/mongodb';
import {
  recordTrustedFormValidation,
  validateTrustedFormCertificate,
} from '@/lib/trustedform-verification.server';
import { ClaimLead } from '@/models/ClaimLead';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization') || '';
  if (!secret || !authorization.startsWith('Bearer ')) return false;
  const provided = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) throw new ApiError(403, 'Not authorized.');
    await connectToDatabase();
    const now = new Date();
    await ClaimLead.updateMany(
      { trustedFormVerificationStatus: { $exists: false }, trustedFormCertId: { $type: 'string', $ne: '' } },
      {
        $set: {
          trustedFormVerificationStatus: 'pending',
          trustedFormVerificationAttempts: 0,
          trustedFormVerificationNextAttemptAt: now,
          trustedFormVerificationError: 'pending_validation',
        },
      },
    );
    const claims = await ClaimLead.find({
      trustedFormVerificationStatus: 'pending',
      trustedFormVerificationAttempts: { $lt: 8 },
      trustedFormVerificationNextAttemptAt: { $lte: now },
      trustedFormCertId: { $type: 'string', $ne: '' },
    }).sort({ trustedFormVerificationNextAttemptAt: 1 }).limit(2).lean();

    const results = await Promise.all(claims.map(async (claim) => {
      const attempts = claim.trustedFormVerificationAttempts || 0;
      const validation = await validateTrustedFormCertificate(claim.trustedFormCertId || '');
      const fields = await recordTrustedFormValidation(claim.claimId, attempts, validation, {
        actorId: 'system:trustedform',
        actorEmail: 'TrustedForm validation worker',
        actorRole: 'system',
      });
      return fields?.trustedFormVerificationStatus || 'skipped';
    }));

    return NextResponse.json({
      processed: results.length,
      valid: results.filter((result) => result === 'valid').length,
      invalid: results.filter((result) => result === 'invalid').length,
      pending: results.filter((result) => result === 'pending').length,
      skipped: results.filter((result) => result === 'skipped').length,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
