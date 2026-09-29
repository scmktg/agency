import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

let supabase;

async function getConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error('Portal is not configured yet.');
  return res.json();
}

async function getSupabase() {
  if (supabase) return supabase;
  const config = await getConfig();
  supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
  return supabase;
}

async function sessionOrRedirect(next = window.location.pathname) {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    const target = encodeURIComponent(next);
    window.location.href = '/login.html?next=' + target;
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

async function api(path, options = {}) {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (session?.access_token) headers.Authorization = 'Bearer ' + session.access_token;
  const res = await fetch(path, { ...options, headers });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

async function setupLogin() {
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '/dashboard.html';

  if (session) {
    window.location.href = next;
    return;
  }

  document.getElementById('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    setStatus('Sending secure link…');
    const redirectTo = window.location.origin + next;
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true }
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
    const sb = await getSupabase();
    await sb.auth.signOut();
    window.location.href = '/login.html';
  });
}

async function setupDashboard() {
  const session = await sessionOrRedirect('/dashboard.html');
  if (!session) return;
  await setupSignOut();

  try {
    const data = await api('/api/me');
    if (data.isAdmin) document.getElementById('admin-link')?.classList.remove('is-hidden');

    if (!data.client) {
      document.getElementById('client-name').textContent = 'Welcome.';
      document.getElementById('client-meta').textContent = session.user.email;
      document.getElementById('dashboard-empty').classList.remove('is-hidden');
      return;
    }

    const c = data.client;
    document.getElementById('client-name').textContent = c.company_name;
    document.getElementById('client-meta').textContent = c.email;
    document.getElementById('google-id').textContent = c.google_ads_customer_id || 'Not connected';
    document.getElementById('meta-id').textContent = c.meta_ad_account_id || 'Not connected';
    document.getElementById('commission-rate').textContent = c.commission_rate == null ? '—' : c.commission_rate + '%';
    document.getElementById('dashboard-content').classList.remove('is-hidden');

    if (c.reporting_note) {
      document.getElementById('reporting-note').textContent = c.reporting_note;
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
  const data = await api('/api/admin-clients');
  renderClients(data.clients || []);
}

async function setupAdmin() {
  const session = await sessionOrRedirect('/admin.html');
  if (!session) return;
  await setupSignOut();

  try {
    const me = await api('/api/me');
    if (!me.isAdmin) {
      window.location.href = '/dashboard.html';
      return;
    }

    await loadClients();

    document.getElementById('new-client').addEventListener('click', () => openClientDialog());
    document.getElementById('close-dialog').addEventListener('click', () => document.getElementById('client-dialog').close());

    document.getElementById('client-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = {
        id: document.getElementById('client-id').value || null,
        company_name: document.getElementById('company-name').value.trim(),
        email: document.getElementById('client-email').value.trim().toLowerCase(),
        google_ads_customer_id: document.getElementById('google-customer-id').value.trim() || null,
        meta_ad_account_id: document.getElementById('meta-account-id').value.trim() || null,
        commission_rate: document.getElementById('commission').value === '' ? null : Number(document.getElementById('commission').value),
        active: document.getElementById('client-active').checked,
        reporting_note: document.getElementById('reporting-note-input').value.trim() || null
      };

      try {
        setStatus('Saving…');
        await api('/api/admin-clients', { method: 'POST', body: JSON.stringify(payload) });
        document.getElementById('client-dialog').close();
        await loadClients();
        setStatus('Client saved.', 'success');
      } catch (error) {
        setStatus(error.message, 'error');
      }
    });
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

const page = window.location.pathname;
if (page.endsWith('/login.html') || page === '/login') setupLogin().catch(e => setStatus(e.message, 'error'));
if (page.endsWith('/dashboard.html') || page === '/dashboard') setupDashboard();
if (page.endsWith('/admin.html') || page === '/admin') setupAdmin();
