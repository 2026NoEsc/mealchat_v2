/** Preview only. Never requests OS permission, registers a token, or accesses a server. */
export async function requestNotificationPermission() { return { status: 'granted' }; }
export async function queueNotificationGuide() { /* No device storage in the preview. */ }
