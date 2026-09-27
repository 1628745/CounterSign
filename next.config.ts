import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the Turbopack root to this project so it stops looking for a
  // lockfile/config up the tree (there's an unrelated package-lock.json in
  // the parent home directory that would otherwise trigger a root-detection
  // warning on every `next dev`).
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
