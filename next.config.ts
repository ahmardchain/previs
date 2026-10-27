import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Walrus Memory SDK runs only in server routes.
  serverExternalPackages: ["@mysten-incubation/memwal"],
};

export default nextConfig;
