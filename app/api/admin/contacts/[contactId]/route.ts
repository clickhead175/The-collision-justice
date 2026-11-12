import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { ApiError, apiError } from '@/lib/api-error';
import { requireAdminRole } from '@/lib/admin';
import { csrfIsValid } from '@/lib/csrf';
import { ContactInquiry } from '@/models/ContactInquiry';
import { connectToDatabase } from '@/lib/mongodb';
import { readJson } from '@/lib/request';
import { adminContactUpdateSchema } from '@/lib/validation';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ contactId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdminRole(request, ['superadmin', 'admin']);
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const input = adminContactUpdateSchema.parse(await readJson(request));
    const { contactId } = await params;
    if (!mongoose.isValidObjectId(contactId)) throw new ApiError(404, 'Contact inquiry not found.');
    await connectToDatabase();
    const inquiry = await ContactInquiry.findByIdAndUpdate(contactId, { $set: input }, { returnDocument: 'after', runValidators: true });
    if (!inquiry) throw new ApiError(404, 'Contact inquiry not found.');
    return NextResponse.json({ inquiry }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    await requireAdminRole(request, ['superadmin', 'admin']);
    if (!csrfIsValid(request)) throw new ApiError(403, 'Security check failed. Refresh and try again.');
    const { contactId } = await params;
    if (!mongoose.isValidObjectId(contactId)) throw new ApiError(404, 'Contact inquiry not found.');
    await connectToDatabase();
    const result = await ContactInquiry.deleteOne({ _id: contactId });
    if (!result.deletedCount) throw new ApiError(404, 'Contact inquiry not found.');
    return NextResponse.json({ deleted: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
