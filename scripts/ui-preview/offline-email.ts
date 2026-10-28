/** Test-only duplicate-email scenario; never calls the production email RPC. */
export async function checkEmailAvailable() {
  return { status: new URLSearchParams(globalThis.location?.search).get('scene') === 'personal-taken' ? 'taken' : 'available' };
}
