export default function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(503).json({ error: 'Portal is not configured yet.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
