/**
 * True when the browser says the request came from another site. Same-origin `fetch` sends
 * `Sec-Fetch-Site: same-origin`; older browsers only send `Origin` on cross-origin requests.
 * Scripts can fake both headers, so this only stops other sites using the route from their pages.
 */
export function isCrossSiteRequest(headers: Headers, host: string): boolean {
  const fetchSite = headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite !== "same-origin" && fetchSite !== "none";
  const origin = headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}
