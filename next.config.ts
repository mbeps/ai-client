import type { NextConfig } from "next";

/**
 * Content Security Policy for the application.
 * Permissive enough to allow Mermaid (inline scripts/styles), KaTeX (fonts),
 * rehype-raw HTML rendering, and presigned S3 image URLs.
 * Restrictive enough to block plugin objects and restrict frame/content sources.
 */
const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' https:`,
  `frame-src 'self'`,
  `object-src 'none'`,
  `media-src 'self'`,
  `worker-src 'self' blob:`,
].join("; ");

/**
 * Next.js configuration enabling remote images for common OAuth providers
 * and HTTP security headers for all routes.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        pathname: "/u/**",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
        pathname: "/avatars/**",
      },
    ],
  },

  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: CSP },
    ];

    // HSTS only in production
    if (process.env.NODE_ENV === "production") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
