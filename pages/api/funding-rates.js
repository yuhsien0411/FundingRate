// 使用 Next.js 的內置 API 路由處理 WebSocket
import { Server } from 'socket.io';

// 緩存配置
const CACHE_DURATION = 60000; // 1分鐘
let cachedData = null;
let lastCacheTime = 0;

// 創建 socket.io 實例
let io;

if (!global.io) {
  global.io = new Server();
}
io = global.io;

// 主要的 API 處理函數
export default async function handler(req, res) {
  // 設置 Socket.IO
  if (!res.socket.server.io) {
    io.attach(res.socket.server);
    res.socket.server.io = io;
  }

  // 如果是 WebSocket 請求
  if (req.headers.upgrade === 'websocket') {
    res.end();
    return;
  }

  try {
    const currentTime = Date.now();
    
    // 檢查緩存是否有效
    if (cachedData && currentTime - lastCacheTime < CACHE_DURATION) {
      return res.status(200).json(cachedData);
    }

    // 獲取新數據
    const data = await fetchAllExchangeData();
    
    // 更新緩存
    cachedData = data;
    lastCacheTime = currentTime;

    // 通過 WebSocket 廣播新數據
    if (io) {
      io.emit('funding-rates-update', data);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching funding rates:', error);
    res.status(500).json({ error: 'Failed to fetch funding rates' });
  }
}

async function fetchAllExchangeData() {
  try {
    console.log('開始獲取交易所數據...');
    
    // 添加重試函數
    async function fetchWithRetry(url, options = {}, retries = 3) {
      for (let i = 0; i < retries; i++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 秒超時
          
          const response = await fetch(url, {
            ...options,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          return response;
        } catch (error) {
          console.error(`嘗試 ${i + 1}/${retries} 失敗:`, url, error.message);
          if (i === retries - 1) throw error;
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // 指數退避
        }
      }
    }
    
    const apiCalls = [
      { name: 'Binance Rates', url: 'https://fapi.binance.com/fapi/v1/premiumIndex' },
      { name: 'Binance Funding Info', url: 'https://fapi.binance.com/fapi/v1/fundingInfo' },
      { name: 'Bybit Rates', url: 'https://api.bybit.com/v5/market/tickers?category=linear' },
      { name: 'Bybit Instruments', url: 'https://api.bybit.com/v5/market/instruments-info?category=linear&limit=1000' },
      { 
        name: 'Bitget Rates', 
        url: 'https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES',
        options: {
          headers: {
            'Content-Type': 'application/json',
            'locale': 'zh-CN'
          }
        }
      },
      { 
        name: 'Bitget Contracts', 
        url: 'https://api.bitget.com/api/v2/mix/market/contracts?productType=USDT-FUTURES',
        options: {
          headers: {
            'Content-Type': 'application/json',
            'locale': 'zh-CN'
          }
        }
      },
      { name: 'OKX Tickers', url: 'https://www.okx.com/api/v5/public/mark-price?instType=SWAP' },
      { name: 'OKX Instruments', url: 'https://www.okx.com/api/v5/public/instruments?instType=SWAP' },
      { 
        name: 'Gate.io Contracts', 
        url: 'https://api.gateio.ws/api/v4/futures/usdt/contracts',
        options: {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      },
      { 
        name: 'Hyperliquid', 
        url: 'https://api.hyperliquid.xyz/info',
        options: {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'metaAndAssetCtxs' })
        }
      }
    ];

    const responses = await Promise.all(
      apiCalls.map(async ({ name, url, options = {} }) => {
        try {
          const response = await fetchWithRetry(url, options);
          const text = await response.text();
          try {
            return JSON.parse(text);
          } catch (e) {
            console.error(`JSON 解析錯誤 (${name}):`, e);
            console.error('收到的響應:', text.substring(0, 200) + '...');
            return null;
          }
        } catch (error) {
          console.error(`${name} API 調用失敗:`, error);
          return null;
        }
      })
    );

    const [
      binanceRatesData, 
      binanceFundingInfoData, 
      bybitRatesData, 
      bybitInstrumentsData,
      bitgetRatesData, 
      bitgetContractsData,
      okxTickersData,
      okxInstrumentsData,
      gateioContractsData,
      hyperliquidData
    ] = responses;

    // 檢查是否所有必需的數據都成功獲取
    if (!binanceRatesData || !bybitRatesData || !bitgetRatesData || !okxTickersData) {
      console.error('部分關鍵數據獲取失敗:', {
        binanceRatesData: !!binanceRatesData,
        bybitRatesData: !!bybitRatesData,
        bitgetRatesData: !!bitgetRatesData,
        okxTickersData: !!okxTickersData
      });
    }

    // 創建幣安結算週期映射
    const binanceIntervals = {};
    if (binanceFundingInfoData) {
      binanceFundingInfoData.forEach(info => {
        binanceIntervals[info.symbol] = parseInt(info.fundingIntervalHours) || 8;
      });
    }

    // 創建 Bybit 結算週期映射
    const bybitIntervals = {};
    if (bybitInstrumentsData?.result?.list) {
      bybitInstrumentsData.result.list.forEach(instrument => {
        bybitIntervals[instrument.symbol] = (parseInt(instrument.fundingInterval) || 480) / 60;
      });
    }

    // 處理幣安數據
    const binanceRates = binanceRatesData
      ? binanceRatesData
          .filter(item => item.symbol.endsWith('USDT'))
          .map(item => {
            const interval = binanceIntervals[item.symbol] || 8;
            return {
              symbol: item.symbol.replace('USDT', ''),
              exchange: 'Binance',
              currentRate: (parseFloat(item.lastFundingRate) * 100).toFixed(3),
              isSpecialInterval: interval !== 8,
              settlementInterval: interval
            };
          })
      : [];

    // 創建 Bitget 合約結算週期映射
    const bitgetIntervals = {};
    if (bitgetContractsData?.data) {
      bitgetContractsData.data.forEach(contract => {
        bitgetIntervals[contract.symbol] = parseInt(contract.fundInterval) || 8;
      });
    }

    // 處理 HyperLiquid 數據
    let hyperliquidRates = [];
    if (hyperliquidData) {
      try {
        const [metadata, assetContexts] = hyperliquidData;
        hyperliquidRates = metadata.universe.map((asset, index) => {
          const assetData = assetContexts[index];
          const rate = (parseFloat(assetData.funding) * 100).toFixed(3);
          return {
            symbol: asset.name,
            exchange: 'HyperLiquid',
            currentRate: rate,
            isSpecialInterval: true,
            settlementInterval: 1
          };
        });
      } catch (error) {
        console.error('HyperLiquid 數據處理錯誤:', error);
      }
    }

    // 處理 Bybit 數據
    const bybitRates = bybitRatesData?.result?.list
      ? bybitRatesData.result.list
          .filter(item => item.symbol.endsWith('USDT') && item.fundingRate)
          .map(item => {
            try {
              const interval = bybitIntervals[item.symbol] || 8;
              return {
                symbol: item.symbol.replace('USDT', ''),
                exchange: 'Bybit',
                currentRate: (parseFloat(item.fundingRate) * 100).toFixed(3),
                isSpecialInterval: interval !== 8,
                settlementInterval: interval
              };
            } catch (error) {
              console.error('Bybit 數據處理錯誤:', error, item);
              return null;
            }
          })
          .filter(item => item !== null)
      : [];

    // 處理 Bitget 數據
    const bitgetRates = bitgetRatesData?.data
      ? bitgetRatesData.data
          .filter(item => item.symbol && item.fundingRate)
          .map(item => {
            try {
              const symbol = item.symbol.replace('USDT', '');
              const interval = bitgetIntervals[item.symbol] || 8;
              return {
                symbol,
                exchange: 'Bitget',
                currentRate: (parseFloat(item.fundingRate) * 100).toFixed(3),
                isSpecialInterval: interval !== 8,
                settlementInterval: interval
              };
            } catch (error) {
              console.error('Bitget 數據處理錯誤:', error, item);
              return null;
            }
          })
          .filter(item => item !== null)
      : [];

    // 創建 OKX 結算週期映射
    const okxIntervals = {};
    if (okxInstrumentsData.data) {
      okxInstrumentsData.data.forEach(instrument => {
        if (instrument.instId.endsWith('-USDT-SWAP')) {
          // 從 fundingInterval 獲取結算週期（毫秒轉小時）
          const interval = parseInt(instrument.fundingInterval) / (1000 * 60 * 60);
          okxIntervals[instrument.instId] = interval || 8;
        }
      });
    }

    // 處理 OKX 數據
    // 1. 先從 tickers 獲取所有 USDT 永續合約
    const okxUsdtContracts = (okxTickersData.data || [])
      .filter(item => item.instId && item.instId.endsWith('-USDT-SWAP'))
      .map(item => item.instId);

    // 2. 獲取這些合約的資金費率
    const okxFundingRatesRes = await Promise.all(
      okxUsdtContracts.map(instId => 
        fetch(`https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`)
      )
    );

    const okxFundingRatesData = await Promise.all(
      okxFundingRatesRes.map(res => res.json())
    );

    // 3. 處理資金費率數據
    const okxRates = okxFundingRatesData
      .filter(data => data.data && data.data[0])
      .map(data => {
        try {
          const item = data.data[0];
          const symbol = item.instId.split('-')[0];
          const fundingRate = parseFloat(item.fundingRate);

          if (!item.instId || !fundingRate || isNaN(fundingRate)) {
            return null;
          }

          // 計算結算週期（毫秒轉換為小時）
          const nextFundingTime = parseInt(item.nextFundingTime);
          const currentFundingTime = parseInt(item.fundingTime);
          const interval = (nextFundingTime - currentFundingTime) / (1000 * 60 * 60);

          return {
            symbol,
            exchange: 'OKX',
            currentRate: (fundingRate * 100).toFixed(3),
            isSpecialInterval: interval !== 8,  // 如果不是8小時就標記
            settlementInterval: interval,  // 實際結算間隔
            nextFundingTime: new Date(nextFundingTime).toISOString(),
            fundingTime: new Date(currentFundingTime).toISOString()
          };
        } catch (error) {
          console.error('OKX data processing error:', error, item);
          return null;
        }
      })
      .filter(item => item !== null);

    // 處理 Gate.io 數據
    let gateioRates = [];
    if (gateioContractsData) {
      try {
        gateioRates = gateioContractsData
          .filter(item => item.name && item.name.endsWith('_USDT'))
          .map(item => {
            try {
              const symbol = item.name.replace('_USDT', '');
              const fundingRate = parseFloat(item.funding_rate);
              const interval = parseInt(item.funding_interval) / 3600; // 轉換為小時

              if (!item.name || !fundingRate || isNaN(fundingRate)) {
                return null;
              }

              return {
                symbol,
                exchange: 'Gate.io',
                currentRate: (fundingRate * 100).toFixed(3),
                isSpecialInterval: interval !== 8,
                settlementInterval: interval,
                nextFundingTime: new Date(item.funding_next_apply * 1000).toISOString()
              };
            } catch (error) {
              console.error('Gate.io 數據處理錯誤:', error, item);
              return null;
            }
          })
          .filter(item => item !== null);
      } catch (error) {
        console.error('Gate.io 數據處理錯誤:', error);
      }
    }

    // 合併所有交易所的數據
    const allRates = [
      ...binanceRates,
      ...bybitRates,
      ...bitgetRates,
      ...okxRates,
      ...gateioRates,
      ...hyperliquidRates
    ].filter(item => {
      // 確保 item 和 currentRate 存在且為有效數值
      return item && 
        item.currentRate && 
        !isNaN(parseFloat(item.currentRate)) && 
        parseFloat(item.currentRate) !== 0;
    });

    console.log('數據處理完成，各交易所數據數量:', {
      binance: binanceRates?.length || 0,
      bybit: bybitRates?.length || 0,
      bitget: bitgetRates?.length || 0,
      okx: okxRates?.length || 0,
      gateio: gateioRates?.length || 0,
      hyperliquid: hyperliquidRates?.length || 0
    });

    return {
      success: true,
      data: allRates,
      debug: {
        binanceCount: binanceRates?.length || 0,
        bybitCount: bybitRates?.length || 0,
        bitgetCount: bitgetRates?.length || 0,
        okxCount: okxRates?.length || 0,
        gateioCount: gateioRates?.length || 0,
        hyperliquidCount: hyperliquidRates?.length || 0,
        totalCount: allRates.length
      }
    };
  } catch (error) {
    console.error('fetchAllExchangeData 發生錯誤:', error);
    return {
      success: false,
      data: [],
      error: error.message
    };
  }
}

// 配置 API 路由以支持 WebSocket
export const config = {
  api: {
    bodyParser: false,
  },
};