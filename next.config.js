/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
}

module.exports = nextConfig