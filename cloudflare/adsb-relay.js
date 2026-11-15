/**
 * ATLAS MONDE - Relais ADS-B pour Cloudflare Workers
 * Déploiement : Cloudflare Dashboard > Workers & Pages > Create Worker > coller ce fichier.
 */
const ALLOWED_ORIGIN = "https://tarikdigital1963.github.io";
const CACHE_SECONDS = 45;
export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    const headers = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers });
    const incoming = new URL(request.url);
    const lat = Number(incoming.searchParams.get("lat"));
    const lon = Number(incoming.searchParams.get("lon"));
    const dist = Number(incoming.searchParams.get("dist") || 80);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180 || !Number.isFinite(dist) || dist < 1 || dist > 250) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }
    const cache = caches.default;
    const key = new Request("https://atlas-adsb-cache.invalid/" + lat.toFixed(3) + "/" + lon.toFixed(3) + "/" + Math.round(dist));
    let response = await cache.match(key);
    if (!response) {
      const upstream = "https://api.adsb.lol/v2/lat/" + lat + "/lon/" + lon + "/dist/" + Math.round(dist);
      const result = await fetch(upstream, { headers: { "Accept": "application/json" } });
      if (!result.ok) return new Response(JSON.stringify({ error: "ADSB.lol upstream error", upstream_status: result.status }), { status: result.status, headers: { ...headers, "Content-Type": "application/json" } });
      response = new Response(await result.text(), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=" + CACHE_SECONDS } });
      ctx.waitUntil(cache.put(key, response.clone()));
    }
    const out = new Headers(response.headers);
    for (const [k,v] of Object.entries(headers)) out.set(k,v);
    out.set("Cache-Control", "public, max-age=" + CACHE_SECONDS);
    return new Response(response.body, { status: response.status, headers: out });
  }
};