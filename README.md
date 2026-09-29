# 458. Agency

Minimal public site plus a private client portal.

## Public site

The homepage is intentionally short:
- Google Ads + Meta Ads only
- research-first positioning
- three-step process
- no retainer / no setup fee / commission only

## Client portal

Pages:
- `/login.html` — passwordless magic-link login
- `/dashboard.html` — client dashboard
- `/admin.html` — admin client management

The portal uses Supabase Auth for magic links and a Supabase `clients` table for account configuration.

## Required setup

1. Create a Supabase project.
2. Run `supabase.sql` in the Supabase SQL editor.
3. In Supabase Auth, add your production URL to the allowed redirect URLs:
   - `https://458.agency/dashboard.html`
   - `https://458.agency/admin.html`
   - your Vercel preview URL equivalents if needed
4. Add these environment variables in Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_EMAILS` — comma-separated emails allowed into the admin area
5. Redeploy.

Clients enter their email on the login page and receive a Supabase magic link. If their email matches an active record in `clients`, their dashboard loads the configured account details.

## Current client fields

- company name
- client email
- Google Ads customer ID
- Meta ad account ID
- commission rate
- dashboard/account note
- active/inactive status

The Google and Meta IDs are ready for the next integration step: pulling live advertising data into the dashboard.
