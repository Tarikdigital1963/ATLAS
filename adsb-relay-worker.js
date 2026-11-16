/**
 * ATLAS MONDE - ADS-B relay for Cloudflare Workers
 * Deploy this file as a Cloudflare Worker, then set its workers.dev URL
 * in terminal-aerien.html as ADSB_RELAY_URL.
 */
const ALLOWED_ORIGIN = "https://tarikdigital1963.github.io";
const API_BASE = "https://api.adsb.lol/v2";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== "GET") {
      return Response.json({ error: "Method not allowed" }, { status: 405, headers });
    }

    const incoming = new URL(request.url);
    const lat = Number(incoming.searchParams.get("lat"));
    const lon = Number(incoming.searchParams.get("lon"));
    const dist = Number(incoming.searchParams.get("dist") || 80);

    if (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lon) || lon < -180 || lon > 180 ||
        !Number.isFinite(dist) || dist < 1 || dist > 250) {
      return Response.json({ error: "Invalid lat, lon or dist parameters" }, { status: 400, headers });
    }

    const upstream = `${API_BASE}/lat/${lat}/lon/${lon}/dist/${dist}`;
    try {
      const response = await fetch(upstream, {
        headers: { "Accept": "application/json", "User-Agent": "ATLAS-MONDE-ADS-B-relay/1.0" },
        cf: { cacheTtl: 20, cacheEverything: true }
      });
      const body = await response.text();
      return new Response(body, {
        status: response.status,
        headers: {
          ...headers,
          "Content-Type": response.headers.get("Content-Type") || "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=20"
        }
      });
    } catch (error) {
      return Response.json({ error: "ADS-B upstream unavailable", detail: String(error) }, { status: 502, headers });
    }
  }
};
