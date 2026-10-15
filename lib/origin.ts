// Public origin of the request. Behind a proxy (our host), request.url carries
// the internal address (e.g. localhost:PORT), so prefer the forwarded headers.
export function publicOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
}
