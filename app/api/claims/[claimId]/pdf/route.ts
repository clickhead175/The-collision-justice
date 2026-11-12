import { NextRequest, NextResponse } from 'next/server';
import { verifyClaimPdfToken } from '@/lib/auth';
import { apiError } from '@/lib/api-error';
import { currentAdmin } from '@/lib/admin';
import { ClaimLead } from '@/models/ClaimLead';
import { connectToDatabase } from '@/lib/mongodb';
import { createClaimSummaryPdf } from '@/lib/claim-pdf';
import { findDevAdminClaim, isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ claimId: string }> }) {
  try {
    const { claimId } = await params;
    if (!/^TCJ-\d{5}$/.test(claimId)) return NextResponse.json({ message: 'Claim not found.' }, { status: 404 });
    const token = request.nextUrl.searchParams.get('token') || '';
    let authorized = false;
    if (token) authorized = await verifyClaimPdfToken(token, claimId).catch(() => false);
    const admin = await currentAdmin(request);
    if (!authorized) authorized = Boolean(admin);
    if (!authorized) return NextResponse.json({ message: 'This PDF link is invalid or expired.' }, { status: 403 });
    if (isDevAdminPreviewEnabled() && admin) {
      const claim = findDevAdminClaim(claimId);
      if (!claim) return NextResponse.json({ message: 'Claim not found.' }, { status: 404 });
      const pdf = await createClaimSummaryPdf(claim);
      return new NextResponse(new Uint8Array(pdf), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${claimId}-claim-summary.pdf"`,
          'Cache-Control': 'private, no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    }
    await connectToDatabase();
    const claim = await ClaimLead.findOne({ claimId }).lean();
    if (!claim) return NextResponse.json({ message: 'Claim not found.' }, { status: 404 });
    const pdf = await createClaimSummaryPdf(claim);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${claimId}-claim-summary.pdf"`,
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}