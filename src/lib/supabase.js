import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables! Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── AUTH ────────────────────────────────────────────────────
export async function loginUser(username, password) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username.toLowerCase())
    .eq('password_hash', password)
    .single();
  if (error || !data) return { user: null, error: 'Invalid username or password' };
  if (!data.active) return { user: null, error: 'Account is disabled. Contact your administrator.' };
  return { user: data, error: null };
}

// ─── USERS ──────────────────────────────────────────────────
export async function fetchUsers() {
  const { data, error } = await supabase.from('users').select('*').order('role').order('name');
  return { data: data || [], error };
}
export async function createUser({ username, password, name, role, color }) {
  const { data, error } = await supabase.from('users').insert({ username: username.toLowerCase(), password_hash: password, name, role, color, active: true }).select().single();
  return { data, error };
}
export async function updateUser(id, updates) {
  const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().single();
  return { data, error };
}
export async function toggleUserActive(id, active) { return updateUser(id, { active }); }
export async function resetUserPassword(id, newPassword) { return updateUser(id, { password_hash: newPassword }); }
export async function deleteUser(id) {
  const { error } = await supabase.from('users').delete().eq('id', id);
  return { error };
}

// ─── LOCATIONS ──────────────────────────────────────────────
export async function fetchLocations() {
  const { data, error } = await supabase.from('locations').select('*').order('id');
  return { data: data || [], error };
}
export async function createLocation({ id, label, type, zone }) {
  const { data, error } = await supabase.from('locations').insert({ id, label, type, zone: zone || null }).select().single();
  return { data, error };
}
export async function updateLocation(id, updates) {
  const { data, error } = await supabase.from('locations').update(updates).eq('id', id).select().single();
  return { data, error };
}
export async function deleteLocation(id) {
  const { data: trailersAtLoc } = await supabase.from('trailers').select('id').eq('location_id', id).limit(1);
  if (trailersAtLoc && trailersAtLoc.length > 0) {
    return { error: { message: 'Cannot delete — trailers are currently at this location. Move them first.' } };
  }
  const { error } = await supabase.from('locations').delete().eq('id', id);
  return { error };
}

// ─── TRAILERS ───────────────────────────────────────────────
export async function fetchTrailers() {
  const { data, error } = await supabase.from('trailers').select('*').order('number');
  return { data: data || [], error };
}
export async function createTrailer({ number, type, status, location_id, carrier, notes }) {
  const { data, error } = await supabase.from('trailers').insert({ number, type, status, location_id, carrier, notes: notes || '' }).select().single();
  return { data, error };
}
export async function updateTrailer(id, updates) {
  const { data, error } = await supabase.from('trailers').update({ ...updates, last_moved: new Date().toISOString() }).eq('id', id).select().single();
  return { data, error };
}
export async function updateTrailerByNumber(number, updates) {
  const { data, error } = await supabase.from('trailers').update({ ...updates, last_moved: new Date().toISOString() }).eq('number', number).select().single();
  return { data, error };
}

// ─── MOVES ──────────────────────────────────────────────────
export async function fetchMoves() {
  const { data, error } = await supabase.from('moves').select('*').order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function createMove({ type, trailer_number, trailer_type, from_location, to_location, requested_by, requested_by_user, priority, notes, requested_trailer_type }) {
  const { data, error } = await supabase.from('moves').insert({
    type, trailer_number: trailer_number || '', trailer_type: trailer_type || '',
    from_location: from_location || null, to_location: to_location || null,
    requested_by: requested_by || '', requested_by_user,
    priority: priority || 'normal', notes: notes || '',
    requested_trailer_type: requested_trailer_type || '',
    status: 'pending',
  }).select().single();
  return { data, error };
}

export async function claimMove(moveId, userId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('moves')
    .update({ claimed_by: userId, claimed_at: now, started_at: now, status: 'in-progress' })
    .eq('id', moveId).select().single();
  return { data, error };
}

// Complete with optional hostler-provided fields (trailer_number, from/to location)
export async function completeMove(moveId, hostlerUpdates = {}) {
  const now = new Date().toISOString();
  const upd = { status: 'completed', completed_at: now };
  if (hostlerUpdates.trailer_number) upd.trailer_number = hostlerUpdates.trailer_number;
  if (hostlerUpdates.trailer_type) upd.trailer_type = hostlerUpdates.trailer_type;
  if (hostlerUpdates.from_location) upd.from_location = hostlerUpdates.from_location;
  if (hostlerUpdates.to_location) upd.to_location = hostlerUpdates.to_location;

  const { data, error } = await supabase.from('moves').update(upd).eq('id', moveId).select().single();

  // Update trailer location
  const tNum = hostlerUpdates.trailer_number || data?.trailer_number;
  const tLoc = hostlerUpdates.to_location || data?.to_location;
  if (tNum && tLoc) await updateTrailerByNumber(tNum, { location_id: tLoc });

  return { data, error };
}

// Hostler releases — back to pending
export async function releaseMove(moveId) {
  const { data, error } = await supabase.from('moves')
    .update({ claimed_by: null, claimed_at: null, started_at: null, status: 'pending' })
    .eq('id', moveId).select().single();
  return { data, error };
}

// Hostler cancels — stays in log with reason
export async function cancelMove(moveId, reason) {
  const now = new Date().toISOString();
  const { data, error } = await supabase.from('moves')
    .update({ status: 'cancelled', completed_at: now, cancel_reason: reason || '' })
    .eq('id', moveId).select().single();
  return { data, error };
}

// ─── SETTINGS ───────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  trailerTypes: ['Dry Van', 'Reefer', 'Flatbed', 'Tanker'],
  trailerStatuses: ['Empty', 'Loaded', 'Partial', 'Sealed', 'Live Load'],
  carriers: ['PepsiCo', 'Frito-Lay', 'Swift', 'JB Hunt', 'Werner', 'Schneider', 'XPO', 'FedEx', 'UPS'],
  loadTypes: ['Drop', 'Pick', 'Live Unload', 'Live Load'],
  siteName: 'YardFlow',
  movesPerHourTarget: 4,
  maxMoveMinutes: 30,
  shiftHours: 10,
  autoCreateSendBack: true,
};

export async function fetchSettings() {
  const { data, error } = await supabase.from('settings').select('data').eq('id', 'global').single();
  if (error || !data) return { data: DEFAULT_SETTINGS, error };
  return { data: { ...DEFAULT_SETTINGS, ...data.data }, error: null };
}

export async function updateSettings(newData) {
  const { data, error } = await supabase.from('settings').update({ data: newData, updated_at: new Date().toISOString() }).eq('id', 'global').select().single();
  return { data, error };
}

// ─── GATE LOG ───────────────────────────────────────────────
export async function fetchGateLog() {
  const { data, error } = await supabase.from('gate_log').select('*').order('created_at', { ascending: false }).limit(200);
  return { data: data || [], error };
}

export async function createGateEntry({ direction, load_id, trailer_number, carrier, load_type, notes, logged_by, logged_by_name }) {
  const { data, error } = await supabase.from('gate_log').insert({
    direction, load_id: load_id || '', trailer_number: trailer_number || '',
    carrier: carrier || '', load_type: load_type || '',
    notes: notes || '', logged_by, logged_by_name: logged_by_name || '',
  }).select().single();
  return { data, error };
}

export function subscribeToGateLog(cb) {
  return supabase.channel('gate-log-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'gate_log' }, cb).subscribe();
}

// ─── REALTIME ───────────────────────────────────────────────
export function subscribeToMoves(cb) {
  return supabase.channel('moves-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'moves' }, cb).subscribe();
}
export function subscribeToTrailers(cb) {
  return supabase.channel('trailers-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'trailers' }, cb).subscribe();
}
export function subscribeToLocations(cb) {
  return supabase.channel('locations-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, cb).subscribe();
}
export function subscribeToSettings(cb) {
  return supabase.channel('settings-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, cb).subscribe();
}

// ─── HELPERS ────────────────────────────────────────────────
export function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}
export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' + fmtTime(iso);
}
