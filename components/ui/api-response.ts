export async function readApiResponse(
  response: Response,
  fallbackMessage: string,
): Promise<Record<string, unknown>> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(fallbackMessage);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(fallbackMessage);
  }

  const body = payload as Record<string, unknown>;
  if (!response.ok) {
    const errors = body.errors && typeof body.errors === 'object' && !Array.isArray(body.errors)
      ? Object.values(body.errors).find((value): value is string => typeof value === 'string')
      : undefined;
    throw new Error(typeof body.message === 'string' ? body.message : errors ?? fallbackMessage);
  }

  return body;
}
