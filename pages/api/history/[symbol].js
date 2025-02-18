// 定義需要忽略的幣種
const IGNORED_SYMBOLS = {
  'CETUS': '由於 OKX API 返回的 CETUS 資金費率數據不準確，暫時忽略此幣種'
};

export default async function handler(req, res) {
  const { symbol, timeRange = '24h', exchange = 'all' } = req.query;

  // 檢查是否為需要忽略的幣種
  if (exchange === 'OKX' && IGNORED_SYMBOLS[symbol]) {
    return res.status(200).json({
      success: true,
      symbol,
      data: [],
      message: IGNORED_SYMBOLS[symbol]
    });
  }

  try {
    // 根據時間範圍計算開始時間，並調整 API 請求限制
    const now = new Date();
    let startTime;
    let limit;  // API 請求數量限制

    switch (timeRange) {
      case '24h':
        startTime = new Date(now - 24 * 60 * 60 * 1000);
        limit = 50;  // 24小時約需要 6-8 個數據點
        break;
      case '7d':
        startTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
        limit = 100;  // 7天約需要 42 個數據點
        break;
      case '30d':
        startTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
        limit = 200;  // 30天約需要 180 個數據點
        break;
      default:
        startTime = new Date(now - 24 * 60 * 60 * 1000);
        limit = 50;
    }

    // 初始化所有交易所的數據
    const formattedData = {
      Binance: [],
      Bybit: [],
      Bitget: [],
      OKX: [],
      HyperLiquid: []
    };

    // 追蹤最常見的結算間隔
    let intervalCounts = {};
    
    // 檢測結算間隔的函數
    const detectInterval = (data) => {
      if (!Array.isArray(data) || data.length < 2) return 8;
      
      // 計算相鄰時間點的間隔
      const intervals = [];
      for (let i = 1; i < data.length; i++) {
        const diff = new Date(data[i-1].time) - new Date(data[i].time);
        const hours = Math.round(diff / (1000 * 60 * 60));
        if (hours > 0) {
          intervals.push(hours);
          intervalCounts[hours] = (intervalCounts[hours] || 0) + 1;
        }
      }
      
      // 找出最常見的間隔
      const mostCommon = Object.entries(intervalCounts)
        .sort((a, b) => b[1] - a[1])[0];
      
      return mostCommon ? parseInt(mostCommon[0]) : 8;
    };

    try {
      // 獲取 Binance 歷史數據
      const binanceRes = await fetch(
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}USDT&limit=${limit}`
      );
      const binanceData = await binanceRes.json();
      if (Array.isArray(binanceData)) {
        formattedData.Binance = binanceData.map(item => ({
          exchange: 'Binance',
          time: new Date(item.fundingTime).toISOString(),
          rate: (parseFloat(item.fundingRate) * 100).toFixed(4),
          interval: 8
        }));
      }
    } catch (error) {
      console.error('Binance API Error:', error);
    }

    try {
      // 獲取 Bybit 歷史數據
      const bybitRes = await fetch(
        `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbol}USDT&limit=200`
      );
      const bybitData = await bybitRes.json();
      if (bybitData.result?.list) {
        formattedData.Bybit = bybitData.result.list.map(item => ({
          exchange: 'Bybit',
          time: new Date(parseInt(item.fundingRateTimestamp)).toISOString(),
          rate: (parseFloat(item.fundingRate) * 100).toFixed(4),
          interval: 8
        }));
      }
    } catch (error) {
      console.error('Bybit API Error:', error);
    }

    try {
      // 獲取 Bitget 歷史數據
      const bitgetRes = await fetch(
        `https://api.bitget.com/api/v2/mix/market/history-fund-rate?symbol=${symbol}USDT&productType=usdt-futures&pageSize=100`
      );
      const bitgetData = await bitgetRes.json();
      if (bitgetData.data) {
        formattedData.Bitget = bitgetData.data.map(item => ({
          exchange: 'Bitget',
          time: new Date(parseInt(item.fundingTime)).toISOString(),
          rate: (parseFloat(item.fundingRate) * 100).toFixed(4),
          interval: 8
        }));
      }
    } catch (error) {
      console.error('Bitget API Error:', error);
    }

    try {
      // 獲取 OKX 歷史數據
      if (symbol !== 'CETUS') {  // 忽略 CETUS
        const okxRes = await fetch(
          `https://www.okx.com/api/v5/public/funding-rate-history?instId=${symbol}-USDT-SWAP&limit=100`
        );
        const okxData = await okxRes.json();
        if (okxData.data) {
          formattedData.OKX = okxData.data.map(item => ({
            exchange: 'OKX',
            time: new Date(parseInt(item.fundingTime)).toISOString(),
            rate: (parseFloat(item.fundingRate) * 100).toFixed(4),
            interval: 8
          }));
        }
      }
    } catch (error) {
      console.error('OKX API Error:', error);
    }

    try {
      // 獲取 HyperLiquid 歷史數據
      const hyperRes = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: 'fundingHistory',
          coin: symbol,
          startTime: startTime.getTime()
        })
      });
      
      const hyperData = await hyperRes.json();
      if (Array.isArray(hyperData)) {
        // 獲取最常見的結算間隔
        const commonInterval = detectInterval(
          Object.values(formattedData)
            .flat()
            .filter(item => item.time)
        );

        // 按檢測到的間隔分組並計算平均值
        const groupedData = hyperData.reduce((acc, item) => {
          const time = new Date(item.time);
          // 將時間向下取整到最近的 commonInterval 小時
          time.setMinutes(0, 0, 0);
          const hour = time.getHours();
          time.setHours(Math.floor(hour / commonInterval) * commonInterval);
          
          const timeKey = time.toISOString();
          if (!acc[timeKey]) {
            acc[timeKey] = {
              sum: 0,
              count: 0,
              time: time,
              hourlyRates: []
            };
          }
          
          acc[timeKey].sum += parseFloat(item.fundingRate);
          acc[timeKey].count += 1;
          acc[timeKey].hourlyRates.push({
            time: new Date(item.time).toLocaleString(),
            rate: (parseFloat(item.fundingRate) * 100).toFixed(4)
          });
          
          return acc;
        }, {});

        // 計算每個時間間隔的平均值
        formattedData.HyperLiquid = Object.values(groupedData)
          .map(group => ({
            exchange: 'HyperLiquid',
            time: group.time.toISOString(),
            rate: ((group.sum / group.count) * 100).toFixed(4),
            interval: commonInterval,
            hourlyRates: group.hourlyRates.sort((a, b) => new Date(b.time) - new Date(a.time))
          }))
          .filter(item => !isNaN(parseFloat(item.rate)));
      }
    } catch (error) {
      console.error('HyperLiquid API Error:', error);
    }

    // 合併數據
    let responseData = [];
    if (exchange === 'all') {
      Object.values(formattedData).forEach(data => {
        responseData = responseData.concat(data);
      });
    } else {
      responseData = formattedData[exchange] || [];
    }

    // 按時間排序
    responseData.sort((a, b) => new Date(b.time) - new Date(a.time));

    // 確保返回的數據格式一致
    res.status(200).json({
      success: true,
      symbol,
      data: responseData || []  // 確保始終返回數組
    });

  } catch (error) {
    console.error('History API Error:', error);
    res.status(500).json({ 
      success: false,
      error: '獲取歷史資料失敗', 
      details: error.message,
      data: []
    });
  }
} 