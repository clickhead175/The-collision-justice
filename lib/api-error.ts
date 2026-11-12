import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    const errors = Object.fromEntries(error.issues.map((issue) => [issue.path.join('.') || 'form', issue.message]));
    return NextResponse.json({ message: 'Please correct the highlighted fields.', errors }, { status: 422 });
  }
  if (error instanceof ApiError) return NextResponse.json({ message: error.message }, { status: error.status });
  console.error('API request failed:', error instanceof Error ? error.name : 'UnknownError');
  return NextResponse.json({ message: 'The service is temporarily unavailable. Please try again.' }, { status: 503 });
}