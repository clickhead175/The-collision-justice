import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { csrfIsValid } from '@/lib/csrf';
import { ContactInquiry } from '@/models/ContactInquiry';
import { connectToDatabase } from '@/lib/mongodb';
import { rateLimit, requestIdentity } from '@/lib/rate-limit';
import { readJson } from '@/lib/request';
import { contactInputSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh the page and try again.');
    if (!await rateLimit('contact-inquiry', requestIdentity(request), 5, 60 * 60 * 1000)) throw new ApiError(429, 'Too many messages. Please try again later.');
    const inquiry = contactInputSchema.parse(await readJson(request));
    await connectToDatabase();
    await ContactInquiry.create(inquiry);
    return NextResponse.json({ message: 'Message received.' }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}