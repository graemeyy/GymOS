const isDev = process.env.NODE_ENV !== "production";

// Stripe Checkout and the customer portal are full-page redirects, so the app
// itself only needs to talk to its own origin.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self' https://checkout.stripe.com https://billing.stripe.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

// The staff pages moved under /admin. Old bookmarks keep working.
const movedStaffPages = ["members", "classes", "shifts", "billing", "equipment", "inventory", "settings"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      ...movedStaffPages.map((page) => ({ source: `/${page}/:path*`, destination: `/admin/${page}/:path*`, permanent: true })),
      { source: "/radar", destination: "/admin/retention", permanent: true },
      { source: "/iot", destination: "/admin/access", permanent: true },
      { source: "/reception", destination: "/admin/check-in", permanent: true },
      { source: "/setup", destination: "/admin/setup", permanent: true },
      { source: "/marketing", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
