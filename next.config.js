/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 禁用 webpack HMR (Hot Module Replacement)
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: false,
        followSymlinks: false,
      };
    }
    return config;
  },
  // 添加自定義 headers 來防止不必要的請求
  async headers() {
    return [
      {
        source: '/socket.io/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        // Binance Futures API 重寫
        source: '/api/binance/funding-rates',
        destination: 'https://fapi.binance.com/fapi/v1/premiumIndex'
      },
      {
        // Bybit API 重寫 
        source: '/api/bybit/funding-rates',
        destination: 'https://api.bybit.com/v5/market/tickers'
      },
      {
        // Bitget API 重寫
        source: '/api/bitget/funding-rates', 
        destination: 'https://api.bitget.com/api/v2/mix/market/tickers'
      }
    ];
  },
  // 設置伺服器監聽端口
  serverRuntimeConfig: {
    port: parseInt(process.env.PORT, 10) || 8080
  },
  // 允許外部訪問
  experimental: {
    allowExternalDir: true
  }
}

module.exports = nextConfig