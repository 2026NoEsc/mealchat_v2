/** Importing offline contract helpers must not initialize the configured native auth client.
 * Metro and Jest share this synchronous, statically resolvable lazy module boundary. */
export function getRoomDecisionClient(): typeof import('./supabase') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- intentionally lazy runtime client, not a Node-only import
  return require('./supabase');
}
