import { createClient } from '@supabase/supabase-js';

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Not signed in.' });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.email) return res.status(401).json({ error: 'Session expired.' });

  const email = user.email.toLowerCase();
  const isAdmin = adminEmails().includes(email);

  const { data: client, error } = await supabase
    .from('clients')
    .select('id,company_name,email,google_ads_customer_id,meta_ad_account_id,commission_rate,reporting_note,active')
    .eq('email', email)
    .eq('active', true)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Could not load client account.' });

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ isAdmin, client: client || null });
}
