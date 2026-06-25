/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["svitech.in", "www.svitech.in"],
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
