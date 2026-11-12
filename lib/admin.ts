import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api-error';
import { Admin } from '@/models/Admin';
import { connectToDatabase } from '@/lib/mongodb';
import { requireAdmin, verifyAdminToken, type AdminRole } from '@/lib/auth';
import { getDevAdminPreviewIdentity, isDevAdminPreviewEnabled } from '@/lib/dev-admin-preview';

export type CurrentAdmin = {
  _id: unknown;
  email: string;
  name: string;
  role: AdminRole;
  isTwoFactorEnabled: boolean;
  sessionVersion: number;
  createdAt: Date;
};

export async function currentAdmin(request: NextRequest) {
  if (isDevAdminPreviewEnabled()) return getDevAdminPreviewIdentity();
  const claims = await requireAdmin(request);
  if (!claims?.sub) return null;
  return adminForSession(claims.sub, claims.email, claims.role, claims.ver);
}

export async function adminForSessionToken(token: string | undefined) {
  if (isDevAdminPreviewEnabled()) return getDevAdminPreviewIdentity();
  if (!token) return null;
  try {
    const claims = await verifyAdminToken(token);
    return adminForSession(claims.sub, claims.email, claims.role, claims.ver);
  } catch {
    return null;
  }
}

async function adminForSession(id: string, email: string, role: string, version: number) {
  await connectToDatabase();
  const admin = await Admin.findById(id).select('email name role isTwoFactorEnabled sessionVersion createdAt').lean();
  if (!admin || admin.sessionVersion !== version || admin.email !== email || admin.role !== role) return null;
  return admin as CurrentAdmin;
}

export async function requireAdminRole(request: NextRequest, allowed: readonly AdminRole[]) {
  const admin = await currentAdmin(request);
  if (!admin) throw new ApiError(401, 'Authentication required.');
  if (!allowed.includes(admin.role)) throw new ApiError(403, 'You do not have permission to perform this action.');
  return admin;
}