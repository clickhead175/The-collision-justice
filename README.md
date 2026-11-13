# The Collision Justice

The application uses Next.js App Router, React Server Components for public pages, MongoDB Atlas through Mongoose, encrypted and HMAC-signed admin sessions, TOTP two-factor authentication, and PDFKit. Vercel deploys it as a native Next.js application. Claims, inquiries, admins, and rate-limit records are stored in MongoDB; PDFs are generated in memory and are never written to local disk.

## Local setup

Requirements: Node.js 20.9+ and a MongoDB Atlas cluster reachable over TLS.

1. Create a MongoDB Atlas project and database user. Give the user access only to this database. For production, restrict network access using Vercel Secure Compute/static egress where available; do not leave broad `0.0.0.0/0` access enabled.
2. Copy `.env.example` to `.env.local` in the repository root and set `MONGODB_URI`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `NEXT_PUBLIC_SITE_URL`. URL-encode special characters in the Atlas username/password.
3. Generate an admin signing key:

   ```powershell
   npm run secrets
   ```

   Put the printed `JWT_SECRET` in `.env.local`. Keep it private and stable; rotating it signs out admins and invalidates outstanding claim PDF links.
4. Install and start the application:

   ```powershell
   npm install
   npm run dev
   ```

   Public routes include `/`, `/about`, `/faq`, `/contact`, `/privacy-policy`, `/terms`, `/get-a-quote`, and `/check-claim`. Admin sign-in is at `/admin/login`.
5. Seed the initial admin account and initialize MongoDB indexes:

   ```powershell
   npm run seed-admin
   npm run db:indexes
   ```

   The seed script reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env.local`, hashes the password with bcrypt, and creates or resets that account as the protected `superadmin`. Use a unique password of 12 to 72 bytes. Do not commit `.env.local` or share its contents.

## Vercel deployment

1. Push the repository to your Git provider and import it into Vercel using the repository root. Vercel detects Next.js and builds it natively.
2. Add these variables in Vercel Project Settings for Production (and Preview if appropriate):

   - `MONGODB_URI`: TLS-enabled MongoDB Atlas connection string.
   - `JWT_SECRET`: at least 32 random bytes from `npm run secrets`.
   - `ADMIN_EMAIL` and `ADMIN_PASSWORD`: initial admin seed credentials.
   - `NEXT_PUBLIC_SITE_URL`: canonical public HTTPS domain, without a trailing slash.
   - `NEXT_PUBLIC_BRAND_NAME` and `NEXT_PUBLIC_BRAND_LOGO_URL`: optional public branding overrides.
   - `NEXT_PUBLIC_JORNAYA_CAMPAIGN_KEY` and `NEXT_PUBLIC_TRUSTEDFORM_SCRIPT_URL`: optional approved compliance-script settings. These are public identifiers, not private API secrets.
   - `TRUSTEDFORM_API_KEY`: server-only ActiveProspect API key for the authenticated TrustedForm Validate API. Never prefix this with `NEXT_PUBLIC_`.
   - `CRON_SECRET`: a separate long random secret used to authenticate the scheduled TrustedForm retry route.

3. Deploy. The public pages are server-rendered, and `app/sitemap.ts` and `app/robots.ts` generate sitemap and crawler rules. Admin and API routes are excluded from indexing.
4. Seed the production admin from a trusted local terminal with the production `MONGODB_URI`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` available in its local environment, then run `npm run seed-admin`. Avoid placing passwords in terminal command arguments.
5. Verify the claim intake, email-or-phone status lookup, admin login, status updates, inquiry listing, CSV export, and claim-summary PDF downloads before launch.

## TrustedForm verification and location data

- The claim form requires a TrustedForm certificate URL with a Lead ID before it sends a claim. If collection times out, submission stops, entered form data remains available, and the claimant can retry after the script supplies the certificate. If the callback arrives after a claim was already submitted with its certificate, a short-lived claim-scoped token supports idempotent recovery; it cannot attach a different certificate or create a certificate-free claim.
- Claims with a certificate are saved as `pending` before any external validation. An authenticated server-side request to the ActiveProspect Validate API can later mark the certificate ID `valid` or `invalid`; `valid` means the API accepted the certificate ID, not that it independently proves the claimant's physical location or the legal sufficiency of consent.
- `TRUSTEDFORM_API_KEY` is required for automatic validation. The scheduled endpoint retries temporary failures with increasing delays (capped at six hours) and stops after eight attempts; an administrator can request a fresh check. Set `CRON_SECRET` in Vercel so its scheduled request is authorized. Vercel Cron is configured for a five-minute schedule; Preview deployments can use the administrator's manual check.
- The 50 `public/data/us-cities` JSON files are claimant city-selector data sourced from Census Gazetteer places. They do not contain IP ranges and must never be used to assign an IP address to a selected city. The separate server-only GeoLite2 City/ASN databases provide approximate information about the server-observed public IP. Keep them outside `public` and comply with the license and attribution terms shipped with the specific database release. A GeoLite2 result does not verify physical presence in a claimant-selected city.
- No additional IP-to-city dataset was added: the Census files are not IP geolocation data, and no dataset can establish that a claimant-selected city is the physical location of an observed network IP. The PDF continues to show an IP reference only when the existing independent-verification marker is present; otherwise it shows `Not available`.

## Security and operations

- Admin access has three server-enforced roles: `superadmin`, `admin`, and read-only `viewer`. The seeded account is always `superadmin`; team APIs cannot create, modify, or delete a superadmin. Admin sessions contain a signed JWT encrypted with AES-256-GCM and separately HMAC-signed in an `HttpOnly`, `Secure` production cookie with `SameSite=Strict`; session versions and roles are checked against MongoDB on each request. Sessions last 24 hours by default or 30 days when Remember Me is selected.
- Users can enroll in TOTP-based two-factor authentication. TOTP secrets are AES-256-GCM encrypted using a key derived from `JWT_SECRET`; login challenges expire after five minutes, and five failed password or TOTP attempts trigger a temporary lockout.
- All write requests require a same-origin double-submit CSRF token. Public intake, contact, status lookup, and admin login have MongoDB-backed rate limits; public forms include honeypots and strict server-side Zod validation.
- JSON API bodies have explicit byte limits, and the Next.js configuration applies `nosniff`, clickjacking, referrer, permissions, and HSTS headers on every route.
- Passwords use bcrypt. Claim IDs are unique and readable (`TCJ-12345`). Lookup requires the Claim ID and the email address or phone number submitted with the claim.
- MongoDB uses TLS. Mongoose connections are cached for serverless reuse and model indexes are initialized idempotently.
- PDFs are generated into memory and streamed with private/no-store headers. Do not add file-based sessions, uploads, or PDF storage to Vercel functions.
- Set a retention/deletion policy, configure Atlas backups and least-privilege access, and obtain privacy/compliance review before accepting real health or injury data.
- Technical SEO cannot guarantee rankings or indexing. Verify business details, legal disclosures, testimonial authorization, and the stated 4.8 rating/45,000+ figure before publishing.
- No software can be guaranteed completely bug-free or vulnerability-free. Run the checks below and keep dependencies patched.

## Checks

```powershell
npm run typecheck
npm test
npm run build
npm audit
```
