import type { NextConfig } from "next";

// Every page is generated at build time from the JSON files in ET_CONTENT_DIR; nothing runs per request.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The Board page became Trends (SPEC §0.5); old links keep working.
  async redirects() {
    return [{ source: "/board", destination: "/trends", permanent: true }];
  },
};

export default nextConfig;
