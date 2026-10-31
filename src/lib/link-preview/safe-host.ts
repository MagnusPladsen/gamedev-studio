function ipv4Parts(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const numbers = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
  return numbers.every((n) => n >= 0 && n <= 255) ? numbers : null;
}

function isPrivateIpv4([a, b]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  );
}

/** True for loopback, private, link-local and other addresses a server must never be asked to fetch. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.toLowerCase().replace(/^\[|\]$/g, "");
  const v4 = ipv4Parts(ip);
  if (v4) return isPrivateIpv4(v4);
  if (!ip.includes(":")) return true;
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  return !isGlobalIpv6(ip);
}

/**
 * Only global unicast (2000::/3) counts as public. Teredo, documentation and 6to4 ranges are refused
 * because they can wrap an IPv4 address; NAT64, site-local and every other range fall outside 2000::/3.
 */
function isGlobalIpv6(ip: string): boolean {
  const groups = ip.split(":");
  const first = parseInt(groups[0] || "0", 16);
  const second = ip.startsWith(`${groups[0]}::`) ? 0 : parseInt(groups[1] || "0", 16);
  if ((first & 0xe000) !== 0x2000) return false;
  if (first === 0x2002) return false;
  return !(first === 0x2001 && (second === 0 || second === 0xdb8));
}

/** Host names that only make sense inside a private network. */
export function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa") ||
    !host.includes(".")
  );
}
