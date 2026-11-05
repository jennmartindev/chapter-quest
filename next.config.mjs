/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We typecheck via tsc/build; skip the optional ESLint pass so a missing
  // lint config never blocks a deploy.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] }];
  },
};

export default nextConfig;
