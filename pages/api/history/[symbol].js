export default async function handler(req, res) {
  const { symbol, timeRange = '24h', exchange = 'all' } = req.query;


  try {
    // 根據時間範圍計算開始時間，並調整 API 請求限制
    const now = new Date();
    let startTime;
    let limit;  // API 請求數量限制

    switch (timeRange) {
      case '24h':
        startTime = new Date(now - 5 * 24 * 60 * 60 * 1000);  // 改為5天以確保獲取足夠數據
        limit = 200;
        break;
      case '7d':
        startTime = new Date(now - 10 * 24 * 60 * 60 * 1000);  // 改為10天
        limit = 300;
        break;
      case '30d':
        startTime = new Date(now - 35 * 24 * 60 * 60 * 1000);  // 改為35天
        limit = 1000;
        break;
      default:
        startTime = new Date(now - 5 * 24 * 60 * 60 * 1000);  // 預設也改為5天
        limit = 200;
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
        `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}USDT&limit=100`
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
      const endTime = now.getTime();
      const bybitRes = await fetch(
        `https://api.bybit.com/v5/market/funding/history?category=linear&symbol=${symbol}USDT&limit=100`
      );
      const bybitData = await bybitRes.json();
      if (bybitData.result?.list) {
        formattedData.Bybit = bybitData.result.list
          .map(item => {
            const timestamp = parseInt(item.fundingRateTimestamp);
            if (isNaN(timestamp)) {
              return null;
            }
            const rate = parseFloat(item.fundingRate);
            const time = new Date(timestamp);
            // 只保留整點的數據
            if (time.getMinutes() !== 0) {
              return null;
            }
            return {
              exchange: 'Bybit',
              time: time.toISOString(),
              rate: (rate * 100).toFixed(4),
              interval: 8
            };
          })
          .filter(item => item !== null)
          .sort((a, b) => new Date(b.time) - new Date(a.time));

        // 調試輸出
        // console.log('Bybit 數據詳情:', formattedData.Bybit.map(item => ({
        //   時間: new Date(item.time).toLocaleString(),
        //   費率: item.rate
        // })));
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
    } catch (error) {
      console.error('OKX API Error:', error);
    }

    try {
      // 獲取 HyperLiquid 數據
      formattedData.HyperLiquid = [];  // 預設為空數組
      let hyperLiquidData = {
        currentRate: null,
        historicalRates: []
      };

      // 1. 先獲取當前數據
      const hyperCurrentRes = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' })
      });

      if (hyperCurrentRes.ok) {
        const [metadata, assetContexts] = await hyperCurrentRes.json();
        const currentAssetIndex = metadata.universe.findIndex(asset => asset.name === symbol);
        
        if (currentAssetIndex !== -1 && assetContexts[currentAssetIndex]) {
          hyperLiquidData.currentRate = (parseFloat(assetContexts[currentAssetIndex].funding) * 100).toFixed(4);
          
          // 2. 只有在有當前數據時才獲取歷史數據
          try {
            // 檢查其他交易所的最早時間
            const earliestTime = Math.min(
              ...Object.entries(formattedData)
                .filter(([exchange, data]) => data.length > 0)
                .map(([exchange, data]) => {
                  const earliest = new Date(data[data.length - 1].time).getTime();
                  console.log(`${exchange} 最早時間:`, new Date(earliest).toLocaleString());
                  return earliest;
                }),
              now.getTime()
            );

            console.log('所有交易所最早時間:', new Date(earliestTime).toLocaleString());

            // 分批獲取歷史數據
            let allHyperData = [];
            const batchSize = 7 * 24 * 60 * 60 * 1000; // 7天的毫秒數
            
            for (let currentStartTime = earliestTime; 
                 currentStartTime < now.getTime(); 
                 currentStartTime += batchSize) {
              
              const batchEndTime = Math.min(currentStartTime + batchSize, now.getTime());
              
              const requestBody = {
                type: 'fundingHistory',
                coin: symbol,
                startTime: Math.floor(currentStartTime),
                endTime: Math.floor(batchEndTime)
              };
              
              console.log('HyperLiquid API 批次請求:', {
                批次開始: new Date(currentStartTime).toLocaleString(),
                批次結束: new Date(batchEndTime).toLocaleString(),
                時間範圍_天: Math.floor((batchEndTime - currentStartTime) / (24 * 60 * 60 * 1000))
              });

              const hyperRes = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
              });
              
              if (!hyperRes.ok) {
                console.error(`HyperLiquid 歷史數據請求失敗: ${hyperRes.status}`);
                break;
              }

              const batchData = await hyperRes.json();
              
              if (Array.isArray(batchData) && batchData.length > 0) {
                allHyperData = allHyperData.concat(batchData);
                console.log('批次數據統計:', {
                  批次大小: batchData.length,
                  累計數據點: allHyperData.length
                });
              } else {
                break;  // 如果沒有數據了就停止
              }

              await new Promise(resolve => setTimeout(resolve, 100));
            }

            // 處理歷史數據
            if (allHyperData.length > 0) {
              // 找出其他交易所的最小結算間隔
              const intervals = new Set();  // 使用 Set 來避免重複
              const exchangeIntervalMap = new Map();  // 儲存每個交易所的間隔
              
              // 檢測每個交易所的結算間隔
              Object.entries(formattedData).forEach(([exchange, data]) => {
                if (exchange === 'HyperLiquid' || data.length < 2) return;
                
                // 計算相鄰時間點的間隔
                const exchangeIntervals = new Set();
                for (let i = 1; i < data.length; i++) {
                  const time1 = new Date(data[i-1].time);
                  const time2 = new Date(data[i].time);
                  const diff = Math.abs(time1 - time2);
                  const hours = Math.round(diff / (1000 * 60 * 60));
                  if (hours > 0) {
                    exchangeIntervals.add(hours);
                  }
                }
                
                // 如果找到了間隔，添加到總集合中
                if (exchangeIntervals.size > 0) {
                  const exchangeInterval = Math.min(...exchangeIntervals);
                  intervals.add(exchangeInterval);
                  exchangeIntervalMap.set(exchange, exchangeInterval);
                  console.log(`${exchange} 檢測到的結算間隔:`, exchangeInterval, '小時');
                }
              });

              // 獲取最小間隔（如果沒有檢測到，使用 8 小時作為預設值）
              const minInterval = intervals.size > 0 ? Math.min(...intervals) : 8;
              console.log('使用最小結算間隔:', minInterval, '小時');

              // 按最小間隔分組數據
              const groupedData = allHyperData.reduce((acc, item) => {
                const time = new Date(item.time);
                // 將時間向下取整到最近的間隔
                time.setMinutes(0, 0, 0);
                const hour = time.getHours();
                time.setHours(Math.floor(hour / minInterval) * minInterval);
                
                const timeKey = time.toISOString();
                if (!acc[timeKey]) {
                  acc[timeKey] = {
                    sum: 0,
                    count: 0,
                    time: time,
                    hourlyRates: []
                  };
                }
                
                // 添加到總和和計數
                const rate = parseFloat(item.fundingRate);
                if (!isNaN(rate)) {
                  acc[timeKey].sum += rate;
                  acc[timeKey].count += 1;
                }

                // 保存詳細的每小時數據
                acc[timeKey].hourlyRates.push({
                  time: new Date(item.time).toLocaleString(),
                  rate: (rate * 100).toFixed(4)
                });
                
                return acc;
              }, {});

              // 計算每個時間間隔的平均值並格式化數據
              hyperLiquidData.historicalRates = Object.entries(groupedData)
                .map(([timeKey, group]) => ({
                  exchange: 'HyperLiquid',
                  time: group.time.toISOString(),
                  rate: ((group.sum / group.count) * 100).toFixed(4),
                  interval: minInterval,
                  hourlyRates: group.hourlyRates
                    .sort((a, b) => new Date(b.time) - new Date(a.time))
                    .map(hr => ({
                      time: hr.time,
                      rate: hr.rate,
                      isHourly: true
                    }))
                }))
                .filter(item => !isNaN(parseFloat(item.rate)))
                .sort((a, b) => new Date(b.time) - new Date(a.time));

              console.log('HyperLiquid 數據統計:', {
                原始數據點: allHyperData.length,
                分組後數據點: hyperLiquidData.historicalRates.length,
                時間範圍: {
                  開始: hyperLiquidData.historicalRates[hyperLiquidData.historicalRates.length - 1]?.time,
                  結束: hyperLiquidData.historicalRates[0]?.time
                },
                使用間隔: minInterval
              });
            }
          } catch (error) {
            console.error('HyperLiquid 歷史數據獲取錯誤:', error);
            // 歷史數據獲取失敗不影響當前數據
          }

          // 合併當前和歷史數據
          formattedData.HyperLiquid = [
            {
              exchange: 'HyperLiquid',
              time: now.toISOString(),
              rate: hyperLiquidData.currentRate,
              interval: 1,
              isCurrent: true
            },
            ...(hyperLiquidData.historicalRates || [])
          ];
        } else {
          console.log(`HyperLiquid: ${symbol} 不存在或無當前數據`);
        }
      } else {
        console.log(`HyperLiquid API 請求失敗: ${hyperCurrentRes.status}`);
      }
    } catch (error) {
      console.error('HyperLiquid 整體處理錯誤:', error);
    }

    // 合併所有交易所數據
    const responseData = [];
    
    // 根據請求的交易所添加數據
    if (exchange === 'all' || exchange === 'HyperLiquid') {
      // 添加 HyperLiquid 數據
      if (formattedData.HyperLiquid.length > 0) {
        responseData.push(...formattedData.HyperLiquid);
      }
    }
    
    if (exchange === 'all' || (exchange !== 'HyperLiquid' && formattedData[exchange])) {
      // 添加其他交易所數據
      Object.entries(formattedData).forEach(([exchangeName, data]) => {
        if ((exchange === 'all' || exchange === exchangeName) && 
            exchangeName !== 'HyperLiquid' && 
            data.length > 0) {
          // 添加當前數據
          responseData.push({
            exchange: exchangeName,
            time: now.toISOString(),
            rate: data[0].rate,
            interval: data[0].interval,
            isCurrent: true
          });
          // 添加歷史數據
          responseData.push(...data);
        }
      });
    }

    // 按時間排序
    responseData.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      return new Date(b.time) - new Date(a.time);
    });

    // 返回數據
    res.status(200).json({
      success: true,
      symbol,
      data: responseData
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

// 修改 HyperLiquid 歷史數據獲取函數
async function getHyperLiquidHistory(symbol, startTime, endTime) {
  let allData = [];
  let currentStartTime = startTime;
  let retryCount = 0;
  const MAX_RETRIES = 3;
  
  while (currentStartTime < endTime && retryCount < MAX_RETRIES) {
    try {
      const response = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'fundingHistory',
          coin: symbol,
          startTime: currentStartTime,
          endTime: Math.min(currentStartTime + (7 * 24 * 60 * 60 * 1000), endTime)
        })
      });

      // 如果返回 404 或其他表示無數據的狀態碼，直接返回空數組
      if (response.status === 404) {
        console.log(`HyperLiquid: ${symbol} 無可用數據`);
        return [];
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('HyperLiquid API 錯誤:', {
          '狀態碼': response.status,
          '狀態文本': response.statusText,
          '響應內容': errorText,
          '請求參數': {
            type: 'fundingHistory',
            coin: symbol,
            startTime: currentStartTime,
            endTime: Math.min(currentStartTime + (7 * 24 * 60 * 60 * 1000), endTime)
          }
        });
        
        // 如果是 500 錯誤，可能是暫時性問題，進行重試
        if (response.status === 500) {
          retryCount++;
          if (retryCount < MAX_RETRIES) {
            console.log(`重試第 ${retryCount} 次...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒後重試
            continue;
          }
        }
        
        return allData; // 返回已收集的數據
      }

      const data = await response.json();
      
      // 檢查數據格式
      if (!Array.isArray(data)) {
        console.log('HyperLiquid 返回的數據格式無效:', data);
        return allData;
      }

      // 如果第一次請求就沒有數據，可能表示該幣種不存在
      if (data.length === 0 && allData.length === 0) {
        console.log(`HyperLiquid: ${symbol} 無歷史數據`);
        return [];
      }

      allData = allData.concat(data);
      
      // 如果返回的數據少於500條，說明已經沒有更多數據
      if (data.length < 500) {
        break;
      }
      
      // 使用最後一條數據的時間作為下一次請求的起始時間
      if (data.length > 0) {
        const lastTimestamp = new Date(data[data.length - 1].time).getTime();
        currentStartTime = lastTimestamp + 1;
      } else {
        break;
      }

      // 重置重試計數
      retryCount = 0;
      
      // 添加延遲以避免請求過於頻繁
      await new Promise(resolve => setTimeout(resolve, 200));

    } catch (error) {
      console.error('HyperLiquid API Error:', error);
      retryCount++;
      if (retryCount < MAX_RETRIES) {
        console.log(`重試第 ${retryCount} 次...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      break;
    }
  }

  console.log(`HyperLiquid ${symbol} 數據獲取完成:`, {
    總數據量: allData.length,
    時間範圍: {
      開始: allData[allData.length - 1]?.time ? new Date(allData[allData.length - 1].time).toLocaleString() : null,
      結束: allData[0]?.time ? new Date(allData[0].time).toLocaleString() : null
    }
  });

  return allData;
} 