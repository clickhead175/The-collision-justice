import { generateSecret, generateURI } from 'otplib';
import QRCode from 'qrcode';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { currentAdmin } from '@/lib/admin';
import { encryptAdminSecret } from '@/lib/auth';
import { csrfIsValid } from '@/lib/csrf';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const admin = await currentAdmin(request);
    if (!admin) throw new ApiError(401, 'Authentication required.');
    if (admin.isTwoFactorEnabled) throw new ApiError(409, 'Two-factor authentication is already enabled.');
    const secret = generateSecret();
    const uri = generateURI({ issuer: 'The Collision Justice', label: admin.email, secret });
    const qrCodeDataUrl = await QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 2, width: 240 });
    await connectToDatabase();
    const result = await Admin.updateOne({ _id: admin._id, isTwoFactorEnabled: false }, { $set: { pendingTwoFactorSecret: encryptAdminSecret(secret) } });
    if (!result.matchedCount) throw new ApiError(409, 'Two-factor setup could not be started. Reload and try again.');
    return NextResponse.json({ secret, qrCodeDataUrl }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
