import type { NextConfig } from "next";

// Every page is generated at build time from the JSON files in ET_CONTENT_DIR; nothing runs per request.
const nextConfig: NextConfig = {
  poweredByHeader: false,
};

export default nextConfig;
