/** Fail closed if a manual UI fixture accidentally attempts any backend operation. */
export const supabase = new Proxy({}, {
  get() {
    throw new Error('Backend operations are disabled in the isolated UI preview.');
  },
});
