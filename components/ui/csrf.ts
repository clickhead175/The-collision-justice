export async function getCsrfHeaders() {
  const response = await fetch('/api/csrf', { credentials: 'same-origin', cache: 'no-store' });
  if (!response.ok) throw new Error('Security token could not be initialized. Refresh and try again.');
  const token = decodeURIComponent(document.cookie.split('; ').find((item) => item.startsWith('csrf-token='))?.split('=').slice(1).join('=') || '');
  if (!token) throw new Error('Security token is missing. Refresh and try again.');
  return { 'X-CSRF-Token': token };
}