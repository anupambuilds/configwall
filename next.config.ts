import type { NextConfig } from "next";

// GitHub Pages serves a project site from /<repo-name>. Set NEXT_PUBLIC_BASE_PATH
// (e.g. "/config-blr-wall") in the deploy workflow; leave empty for local dev.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
