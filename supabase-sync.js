// ── Supabase Sync ─────────────────────────────────
// Activates only when config.js is present with valid credentials.
// Falls back to localStorage silently if not configured.

let db = null;

(function initSupabase() {
  if (
    typeof window.SUPABASE_URL      === 'undefined' ||
    typeof window.SUPABASE_ANON_KEY === 'undefined' ||
    typeof window.supabase          === 'undefined'
  ) return;

  db = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  console.log('[Focus] Supabase sync enabled.');
})();

// Pull latest tasks from Supabase into localStorage
async function syncFromSupabase() {
  if (!db) return;
  try {
    const { data, error } = await db.from('tasks').select('*');
    if (error) throw error;
    if (data) {
      localStorage.setItem('focus_tasks', JSON.stringify(data));
    }
  } catch (e) {
    console.warn('[Focus] Pull failed:', e.message);
  }
}

// Push local tasks to Supabase, removing any deleted ones
async function syncToSupabase(tasks) {
  if (!db) return;
  try {
    if (tasks.length > 0) {
      const { error } = await db.from('tasks').upsert(tasks, { onConflict: 'id' });
      if (error) throw error;
    }
    // Delete tasks that exist remotely but were deleted locally
    const { data: remote } = await db.from('tasks').select('id');
    if (remote) {
      const localIds = new Set(tasks.map(t => t.id));
      const toDelete = remote.map(r => r.id).filter(id => !localIds.has(id));
      if (toDelete.length > 0) {
        await db.from('tasks').delete().in('id', toDelete);
      }
    }
  } catch (e) {
    console.warn('[Focus] Push failed:', e.message);
  }
}
