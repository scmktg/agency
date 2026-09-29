# 458. Agency

Minimal public site plus a private Supabase-powered client portal.

## Pages

- `/` — short public homepage
- `/login.html` — passwordless email magic-link login
- `/dashboard.html` — client dashboard
- `/admin.html` — client administration

## Supabase

The production project is `458` (`duutmtrwjihmzaalvaii`).

Database tables:
- `admin_users`
- `clients`

Row Level Security is enabled. Clients can only read the active client record matching their authenticated email. Admins can view and manage all clients.

The site uses the Supabase project URL and publishable key in `portal.js`. This key is intentionally public; privileged database access is controlled by authentication and RLS.

## Remaining auth configuration

In Supabase → Authentication → URL Configuration, set:

Site URL:
- `https://458.agency`

Additional Redirect URLs:
- `https://458.agency/dashboard.html`
- `https://458.agency/admin.html`

If preview deployments need magic-link testing, add the relevant Vercel preview URLs too.

## Admin access

Add each 458 administrator's email to `public.admin_users`. The user then signs in through the same client login page and will see the Admin link.

## Client fields

- company name
- client email
- Google Ads customer ID
- Meta ad account ID
- commission rate
- dashboard note
- active / inactive

Google and Meta account IDs are ready for the next stage: live reporting integrations.
