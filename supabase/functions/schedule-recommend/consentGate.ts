function logMissingGateConfiguration(url: string | undefined, publishableKey: string | undefined): void {
  // Fixed identifiers only. Never log values, Authorization, request bodies, or user IDs.
  if (!url) console.error("S1_GATE_CONFIG_MISSING: SUPABASE_URL");
  if (!publishableKey) console.error("S1_GATE_CONFIG_MISSING: SUPABASE_ANON_KEY");
}

/** User-scoped RPC only. No admin client or sensitive request body is accepted. */
export async function checkRequiredConsent(
  url: string | undefined,
  publishableKey: string | undefined,
  authorization: string | null,
  rpcFetch: typeof fetch = fetch,
): Promise<Response | null> {
  if (!url || !publishableKey || !authorization) {
    logMissingGateConfiguration(url, publishableKey);
    return Response.json({ code: "S1006", error: "CONSENT_STATUS_UNAVAILABLE" }, { status: 503 });
  }
  try {
    const response = await rpcFetch(url + "/rest/v1/rpc/get_my_consent_status", {
      method: "POST",
      headers: { apikey: publishableKey, Authorization: authorization, "Content-Type": "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      return Response.json({ code: "S1006", error: "CONSENT_STATUS_UNAVAILABLE" }, { status: 503 });
    }
    const data = await response.json();
    if (data?.contract_version !== 1 || !data?.bundle_version ||
        !["accepted", "required"].includes(data?.required?.status) ||
        typeof data?.required?.service_agreed !== "boolean" ||
        typeof data?.required?.privacy_agreed !== "boolean") {
      return Response.json({ code: "S1006", error: "CONSENT_STATUS_UNAVAILABLE" }, { status: 503 });
    }
    if (data.required.status !== "accepted" || !data.required.service_agreed || !data.required.privacy_agreed) {
      return Response.json({ code: "S1001", error: "TERMS_REQUIRED" }, { status: 403 });
    }
    return null;
  } catch {
    return Response.json({ code: "S1006", error: "CONSENT_STATUS_UNAVAILABLE" }, { status: 503 });
  }
}

/** Resolve room permission with the caller's JWT before using the admin client. */
export async function checkRoomPermission(
  url: string | undefined,
  publishableKey: string | undefined,
  authorization: string | null,
  roomId: string,
  rpcFetch: typeof fetch = fetch,
): Promise<Response | null> {
  if (!url || !publishableKey || !authorization) {
    logMissingGateConfiguration(url, publishableKey);
    return Response.json({ code: "S1006", error: "CONSENT_STATUS_UNAVAILABLE" }, { status: 503 });
  }
  try {
    const response = await rpcFetch(url + "/rest/v1/rpc/room_availability_status", {
      method: "POST",
      headers: { apikey: publishableKey, Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ target_room: roomId }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      if (failure?.code === "S1001") return Response.json({ code: "S1001", error: "TERMS_REQUIRED" }, { status: 403 });
      if (["42501", "P0001", "P0002"].includes(failure?.code)) return Response.json({ code: "42501", error: "NOT_ALLOWED" }, { status: 403 });
      return Response.json({ code: "S1006", error: "CONSENT_STATUS_UNAVAILABLE" }, { status: 503 });
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) return Response.json({ code: "S1006", error: "CONSENT_STATUS_UNAVAILABLE" }, { status: 503 });
    if (rows.length === 0) return Response.json({ code: "42501", error: "NOT_ALLOWED" }, { status: 403 });
    return null;
  } catch {
    return Response.json({ code: "S1006", error: "CONSENT_STATUS_UNAVAILABLE" }, { status: 503 });
  }
}
