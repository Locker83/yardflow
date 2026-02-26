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
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('role')
    .order('name');
  return { data: data || [], error };
}

export async function createUser({ username, password, name, role, color }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ username: username.toLowerCase(), password_hash: password, name, role, color, active: true })
    .select()
    .single();
  return { data, error };
}

export async function updateUser(id, updates) {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function toggleUserActive(id, active) {
  return updateUser(id, { active });
}

export async function resetUserPassword(id, newPassword) {
  return updateUser(id, { password_hash: newPassword });
}

export async function deleteUser(id) {
  const { error } = await supabase.from('users').delete().eq('id', id);
  return { error };
}

// ─── LOCATIONS ──────────────────────────────────────────────
export async function fetchLocations() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('id');
  return { data: data || [], error };
}

export async function createLocation({ id, label, type, zone }) {
  const { data, error } = await supabase
    .from('locations')
    .insert({ id, label, type, zone: zone || null })
    .select()
    .single();
  return { data, error };
}

export async function updateLocation(id, updates) {
  const { data, error } = await supabase
    .from('locations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function deleteLocation(id) {
  // Check if any trailers are at this location
  const { data: trailersAtLoc } = await supabase
    .from('trailers')
    .select('id')
    .eq('location_id', id)
    .limit(1);
  if (trailersAtLoc && trailersAtLoc.length > 0) {
    return { error: { message: 'Cannot delete — trailers are currently at this location. Move them first.' } };
  }
  const { error } = await supabase.from('locations').delete().eq('id', id);
  return { error };
}

// ─── TRAILERS ───────────────────────────────────────────────
export async function fetchTrailers() {
  const { data, error } = await supabase
    .from('trailers')
    .select('*')
    .order('number');
  return { data: data || [], error };
}

export async function createTrailer({ number, type, status, location_id, carrier, notes }) {
  const { data, error } = await supabase
    .from('trailers')
    .insert({ number, type, status, location_id, carrier, notes: notes || '' })
    .select()
    .single();
  return { data, error };
}

export async function updateTrailer(id, updates) {
  const { data, error } = await supabase
    .from('trailers')
    .update({ ...updates, last_moved: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return { data, error };
}

export async function updateTrailerByNumber(number, updates) {
  const { data, error } = await supabase
    .from('trailers')
    .update({ ...updates, last_moved: new Date().toISOString() })
    .eq('number', number)
    .select()
    .single();
  return { data, error };
}

// ─── MOVES ──────────────────────────────────────────────────
export async function fetchMoves() {
  const { data, error } = await supabase
    .from('moves')
    .select('*')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
}

export async function createMove({ type, trailer_number, trailer_type, from_location, to_location, requested_by, requested_by_user, priority, notes }) {
  const { data, error } = await supabase
    .from('moves')
    .insert({
      type, trailer_number, trailer_type: trailer_type || '',
      from_location, to_location,
      requested_by: requested_by || '', requested_by_user,
      priority: priority || 'normal', notes: notes || '',
      status: 'pending',
    })
    .select()
    .single();
  return { data, error };
}

export async function claimMove(moveId, userId) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('moves')
    .update({ claimed_by: userId, claimed_at: now, started_at: now, status: 'in-progress' })
    .eq('id', moveId)
    .select()
    .single();
  return { data, error };
}

export async function completeMove(moveId, trailerNumber, toLocation) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('moves')
    .update({ status: 'completed', completed_at: now })
    .eq('id', moveId)
    .select()
    .single();

  // Update trailer location
  if (trailerNumber && toLocation) {
    await updateTrailerByNumber(trailerNumber, { location_id: toLocation });
  }

  return { data, error };
}

// ─── REALTIME SUBSCRIPTIONS ─────────────────────────────────
export function subscribeToMoves(callback) {
  return supabase
    .channel('moves-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'moves' }, callback)
    .subscribe();
}

export function subscribeToTrailers(callback) {
  return supabase
    .channel('trailers-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trailers' }, callback)
    .subscribe();
}

export function subscribeToLocations(callback) {
  return supabase
    .channel('locations-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'locations' }, callback)
    .subscribe();
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
