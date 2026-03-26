// instrumentation.ts — runs before any server code
// Force IPv4 DNS resolution globally — Railway cannot reach Supabase over IPv6

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("dns");
    dns.setDefaultResultOrder("ipv4first");
  }
}
