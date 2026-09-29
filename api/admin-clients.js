import { createClient } from '@supabase/supabase-js';

function getService() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

async function requireAdmin(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: 'Not signed in.', status: 401 };

  const supabase = getService();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user?.email) return { error: 'Session expired.', status: 401 };
  if (!adminEmails().includes(user.email.toLowerCase())) return { error: 'Admin access required.', status: 403 };
  return { supabase, user };
}

export default async function handler(req, res) {
  const auth = await requireAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const { supabase } = auth;

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('company_name', { ascending: true });

    if (error) return res.status(500).json({ error: 'Could not load clients.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ clients: data || [] });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    if (!body.company_name || !body.email) return res.status(400).json({ error: 'Company name and email are required.' });

    const record = {
      company_name: String(body.company_name).trim(),
      email: String(body.email).trim().toLowerCase(),
      google_ads_customer_id: body.google_ads_customer_id || null,
      meta_ad_account_id: body.meta_ad_account_id || null,
      commission_rate: body.commission_rate === null || body.commission_rate === '' ? null : Number(body.commission_rate),
      reporting_note: body.reporting_note || null,
      active: body.active !== false,
      updated_at: new Date().toISOString()
    };

    let query;
    if (body.id) {
      query = supabase.from('clients').update(record).eq('id', body.id).select().single();
    } else {
      query = supabase.from('clients').insert(record).select().single();
    }

    const { data, error } = await query;
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'That email already has a client account.' });
      return res.status(500).json({ error: 'Could not save client.' });
    }
    return res.status(200).json({ client: data });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}
