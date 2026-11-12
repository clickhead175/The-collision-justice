import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { clearAdminCookie } from '@/lib/auth';
import { csrfIsValid } from '@/lib/csrf';
import { currentAdmin } from '@/lib/admin';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const admin = await currentAdmin(request);
    if (!admin) throw new ApiError(401, 'Authentication required.');
    if (isDevAdminPreviewEnabled()) {
      const response = NextResponse.json({ message: 'Signed out of the local preview.' });
      clearAdminCookie(response);
      return response;
    }
    await connectToDatabase();
    await Admin.updateOne({ _id: admin._id }, { $inc: { sessionVersion: 1 } });
    const response = NextResponse.json({ message: 'Signed out.' });
    clearAdminCookie(response);
    return response;
  } catch (error) {
    return apiError(error);
  }
}