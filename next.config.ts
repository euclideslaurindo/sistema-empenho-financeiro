import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['localhost'],
  reactStrictMode: true,
  // Next.js 16 removeu a integração de ESLint do `next build` (não existe
  // mais a chave `eslint` no NextConfig) — o lint já roda como etapa própria
  // no CI (.github/workflows/ci.yml) e no Dockerfile, então a proteção
  // continua existindo, só que fora do `next build` em si.
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  output: 'standalone',
  transpilePackages: ['motion'],
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: process.env.APP_URL || "http://localhost:3000" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version" },
        ]
      }
    ]
  }
};

export default nextConfig;
