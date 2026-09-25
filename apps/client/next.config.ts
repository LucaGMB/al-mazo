import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const devServerOrigin = process.env.DEV_SERVER_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    // Solo en dev: reescribe /api/* hacia al-mazo-server corriendo en local.
    // En producción no hace falta nada acá: el reverse proxy (Nginx/Caddy)
    // enruta /api/* al mismo backend, same-origin.
    if (!isDev) return [];
    return [{ source: "/api/:path*", destination: `${devServerOrigin}/api/:path*` }];
  },
};

export default nextConfig;
