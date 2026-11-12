import { ApiError } from '@/lib/api-error';

export async function readJson(request: Request, maxBytes = 32 * 1024): Promise<unknown> {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    throw new ApiError(415, 'Request content type must be application/json.');
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new ApiError(400, 'Request content length is invalid.');
    if (Number(contentLength) > maxBytes) throw new ApiError(413, 'Request body is too large.');
  }

  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'Request body is required.');

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        throw new ApiError(400, 'Request body could not be read.');
      }
      const { done, value } = chunk;
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) throw new ApiError(413, 'Request body is too large.');
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, totalBytes));
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON.');
  }
}
