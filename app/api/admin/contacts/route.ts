import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { currentAdmin, requireAdminRole } from '@/lib/admin';
import { csrfIsValid } from '@/lib/csrf';
import { ContactInquiry } from '@/models/ContactInquiry';
import { connectToDatabase } from '@/lib/mongodb';
import { isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';
import { readJson } from '@/lib/request';
import { contactInputSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (!await currentAdmin(request)) throw new ApiError(401, 'Authentication required.');
    if (isDevAdminPreviewEnabled()) {
      return NextResponse.json({ inquiries: [] }, { headers: { 'Cache-Control': 'private, no-store' } });
    }
    await connectToDatabase();
    const inquiries = await ContactInquiry.find().sort({ createdAt: -1 }).limit(200).lean();
    return NextResponse.json({ inquiries }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminRole(request, ['superadmin', 'admin']);
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const input = contactInputSchema.parse(await readJson(request));
    if (isDevAdminPreviewEnabled()) throw new ApiError(409, 'Local preview inquiries cannot be created.');
    await connectToDatabase();
    const inquiry = await ContactInquiry.create({
      name: input.name, email: input.email, phone: input.phone, subject: input.subject, message: input.message,
    });
    return NextResponse.json({ inquiry }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
