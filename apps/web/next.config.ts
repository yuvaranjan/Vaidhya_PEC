import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // packages/shared ships raw TypeScript; Next compiles it as if it were app code.
  transpilePackages: ["@vaidhya/shared"],

  turbopack: {
    root: path.resolve(__dirname, "../../"),
  },

  // Hackathon posture: a type error or a lint warning must never be the reason
  // the demo build fails at 3am. Both still run in the editor and in `npm run lint`.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

