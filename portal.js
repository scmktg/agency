import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://duutmtrwjihmzaalvaii.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_MKeTfKrRgHTZIArtOpEDKg_0SwMakTJ';
const SITE_ORIGIN = 'https://458.agency';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  }
});

function safeNext(value) {
  return value === '/admin' ? '/admin' : '/dashboard';
}

async function consumeMagicLinkSession() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');

  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) throw error;
    history.replaceState({}, document.title, window.location.pathname);
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    history.replaceState({}, document.title, window.location.pathname);
  }
}

async function getCurrentSession() {
  await consumeMagicLinkSession();

  const first = await supabase.auth.getSession();
  if (first.data.session) return first.data.session;

  return await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        data.subscription.unsubscribe();
        finish(session || null);
      }
    });

    setTimeout(() => {
      data.subscription.unsubscribe();
      finish(null);
    }, 1200);
  });
}

async function sessionOrRedirect(next = window.location.pathname) {
  const session = await getCurrentSession();
  if (!session) {
    window.location.href = '/login?next=' + encodeURIComponent(safeNext(next));
    return null;
  }
  return session;
}

function setStatus(message, kind = '') {
  const el = document.getElementById('status') || document.getElementById('admin-status');
  if (!el) return;
  el.textContent = message;
  el.dataset.kind = kind;
}

async function isAdmin() {
  const { data, error } = await supabase.from('admin_users').select('email').maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function setupLogin() {
  const session = await getCurrentSession();
  const params = new URLSearchParams(location.search);
  const next = safeNext(params.get('next'));

  if (session) {
    window.location.href = next;
    return;
  }

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim().toLowerCase();
    setStatus('Sending secure link…');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: SITE_ORIGIN + next,
        shouldCreateUser: true
      }
    });

    if (error) {
      setStatus(error.message, 'error');
      return;
    }

    event.target.reset();
    setStatus('Check your inbox. Your magic link is on the way.', 'success');
  });
}

async function setupSignOut() {
  const button = document.getElementById('sign-out');
  if (!button) return;

  button.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  });
}

async function setupDashboard() {
  const session = await sessionOrRedirect('/dashboard');
  if (!session) return;
  await setupSignOut();

  try {
    if (await isAdmin()) document.getElementById('admin-link')?.classList.remove('is-hidden');

    const email = session.user.email?.toLowerCase();
    const { data: client, error } = await supabase
      .from('clients')
      .select('id,company_name,email,google_ads_customer_id,meta_ad_account_id,commission_rate,reporting_note,active')
      .eq('email', email)
      .eq('active', true)
      .maybeSingle();

    if (error) throw error;

    if (!client) {
      document.getElementById('client-name').textContent = 'Welcome.';
      document.getElementById('client-meta').textContent = email || '';
      document.getElementById('dashboard-empty').classList.remove('is-hidden');
      return;
    }

    document.getElementById('client-name').textContent = client.company_name;
    document.getElementById('client-meta').textContent = client.email;
    document.getElementById('google-id').textContent = client.google_ads_customer_id || 'Not connected';
    document.getElementById('meta-id').textContent = client.meta_ad_account_id || 'Not connected';
    document.getElementById('commission-rate').textContent = client.commission_rate == null ? '—' : client.commission_rate + '%';
    document.getElementById('dashboard-content').classList.remove('is-hidden');

    if (client.reporting_note) {
      document.getElementById('reporting-note').textContent = client.reporting_note;
      document.getElementById('dashboard-note').classList.remove('is-hidden');
    }
  } catch (error) {
    document.getElementById('client-name').textContent = 'Unable to load account.';
    document.getElementById('client-meta').textContent = error.message;
  }
}

function renderClients(clients) {
  const list = document.getElementById('client-list');
  if (!clients.length) {
    list.innerHTML = '<div class="empty-state"><h2>No clients yet.</h2><p>Add the first client to create their portal profile.</p></div>';
    return;
  }

  list.innerHTML = clients.map(c => `
    <button class="client-row" type="button" data-client='${encodeURIComponent(JSON.stringify(c))}'>
      <div>
        <strong>${escapeHtml(c.company_name)}</strong>
        <span>${escapeHtml(c.email)}</span>
      </div>
      <div class="client-row-meta">
        <span>${c.active ? 'Active' : 'Inactive'}</span>
        <span>${c.commission_rate == null ? '—' : c.commission_rate + '%'}</span>
        <span>→</span>
      </div>
    </button>
  `).join('');

  list.querySelectorAll('.client-row').forEach(row => {
    row.addEventListener('click', () => {
      const client = JSON.parse(decodeURIComponent(row.dataset.client));
      openClientDialog(client);
    });
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

function openClientDialog(client = null) {
  document.getElementById('dialog-title').textContent = client ? 'Edit client' : 'Add client';
  document.getElementById('client-id').value = client?.id || '';
  document.getElementById('company-name').value = client?.company_name || '';
  document.getElementById('client-email').value = client?.email || '';
  document.getElementById('google-customer-id').value = client?.google_ads_customer_id || '';
  document.getElementById('meta-account-id').value = client?.meta_ad_account_id || '';
  document.getElementById('commission').value = client?.commission_rate ?? '';
  document.getElementById('client-active').checked = client?.active ?? true;
  document.getElementById('reporting-note-input').value = client?.reporting_note || '';
  document.getElementById('client-dialog').showModal();
}

async function loadClients() {
  const { data, error } = await supabase.from('clients').select('*').order('company_name', { ascending: true });
  if (error) throw error;
  renderClients(data || []);
}

async function setupAdmin() {
  const session = await sessionOrRedirect('/admin');
  if (!session) return;
  await setupSignOut();

  try {
    if (!(await isAdmin())) {
      window.location.href = '/dashboard';
      return;
    }

    await loadClients();

    document.getElementById('new-client').addEventListener('click', () => openClientDialog());
    document.getElementById('close-dialog').addEventListener('click', () => document.getElementById('client-dialog').close());

    document.getElementById('client-form').addEventListener('submit', async (event) => {
      event.preventDefault();

      const id = document.getElementById('client-id').value || null;
      const record = {
        company_name: document.getElementById('company-name').value.trim(),
        email: document.getElementById('client-email').value.trim().toLowerCase(),
        google_ads_customer_id: document.getElementById('google-customer-id').value.trim() || null,
        meta_ad_account_id: document.getElementById('meta-account-id').value.trim() || null,
        commission_rate: document.getElementById('commission').value === '' ? null : Number(document.getElementById('commission').value),
        active: document.getElementById('client-active').checked,
        reporting_note: document.getElementById('reporting-note-input').value.trim() || null,
        updated_at: new Date().toISOString()
      };

      try {
        setStatus('Saving…');
        const query = id
          ? supabase.from('clients').update(record).eq('id', id).select().single()
          : supabase.from('clients').insert(record).select().single();

        const { error } = await query;
        if (error) throw error;

        document.getElementById('client-dialog').close();
        await loadClients();
        setStatus('Client saved.', 'success');
      } catch (error) {
        setStatus(error.code === '23505' ? 'That email already has a client account.' : error.message, 'error');
      }
    });
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

const page = window.location.pathname.replace(/\/$/, '');
if (page === '/login' || page === '/login.html') setupLogin().catch(e => setStatus(e.message, 'error'));
if (page === '/dashboard' || page === '/dashboard.html') setupDashboard();
if (page === '/admin' || page === '/admin.html') setupAdmin();
