/** @type {import('next').NextConfig} */
const nextConfig = {
  // New build ID each deploy so stale HTML cannot reference old action/chunk IDs.
  generateBuildId: async () => {
    return process.env.BUILD_ID ?? `build-${Date.now()}`;
  },
  async headers() {
    return [
      {
        source: "/login/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/dashboard/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
