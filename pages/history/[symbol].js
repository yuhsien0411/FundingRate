import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// 註冊 Chart.js 組件
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// 定義圖表選項函數，接收數據和主題作為參數
const getChartOptions = (data, isDarkMode) => {
  // 計算數據的最大和最小值
  const values = data?.datasets?.flatMap(dataset => dataset.data.filter(v => v !== null)) || [];
  const maxValue = Math.max(...values, 0.01);
  const minValue = Math.min(...values, -0.01);
  
  // 計算數據中心點
  const center = (maxValue + minValue) / 2;
  
  // 計算以中心點為基準的範圍（確保能顯示所有數據）
  const halfRange = Math.max(Math.abs(maxValue - center), Math.abs(minValue - center));
  const adjustedHalfRange = halfRange * 1.2; // 增加 20% 邊距
  
  // 計算最終範圍（圍繞中心點對稱）
  let yMin = Math.floor((center - adjustedHalfRange) * 1000) / 1000;
  let yMax = Math.ceil((center + adjustedHalfRange) * 1000) / 1000;
  
  // 計算合適的步進值
  const totalRange = yMax - yMin;
  const getStepSize = (range) => {
    if (range <= 0.1) return 0.02;
    if (range <= 0.2) return 0.04;
    if (range <= 0.5) return 0.1;
    if (range <= 1) return 0.2;
    if (range <= 2) return 0.4;
    return 0.5;
  };
  
  const stepSize = getStepSize(totalRange);
  
  // 調整範圍以適應步進值
  const steps = Math.ceil(totalRange / stepSize);
  const adjustedRange = steps * stepSize;
  const extraSpace = (adjustedRange - totalRange) / 2;
  
  yMin = Math.floor((yMin - extraSpace) * 1000) / 1000;
  yMax = Math.ceil((yMax + extraSpace) * 1000) / 1000;

  return {
    responsive: true,  // 響應式圖表
    maintainAspectRatio: false,  // 不保持寬高比，允許自定義高度
    interaction: {
      mode: 'index',  // 同一時間點的所有數據
      intersect: false,  // 不需要直接指向數據點
    },
    plugins: {
      legend: {
        position: 'top',  // 圖例位置：'top', 'bottom', 'left', 'right'
        labels: {
          color: isDarkMode ? '#fff' : '#666'
        }
      },
      title: {
        display: true,
        text: '資金費率歷史走勢',
        color: isDarkMode ? '#fff' : '#333'
      },
      tooltip: {
        callbacks: {
          // 自定義 tooltip 內容
          label: function(context) {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(4)}%`;
          }
        },
        itemSort: function(a, b) {
          // 按數值大小降序排序
          return b.parsed.y - a.parsed.y;
        },
        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDarkMode ? '#fff' : '#333',
        bodyColor: isDarkMode ? '#fff' : '#333',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
      }
    },
    scales: {
      y: {
        min: yMin,  // Y軸最小值
        max: yMax,  // Y軸最大值
        ticks: {
          callback: value => value.toFixed(4) + '%',  // Y軸標籤格式
          stepSize,  // 刻度間隔
          maxTicksLimit: 10,  // 最大刻度數量
          color: isDarkMode ? '#fff' : '#666'
        },
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        }
      },
      x: {
        grid: {
          display: false  // 不顯示X軸網格線
        },
        ticks: {
          maxRotation: 0,  // 標籤不旋轉
          autoSkip: true,  // 自動跳過重疊的標籤
          maxTicksLimit: 12,  // 最大標籤數量
          color: isDarkMode ? '#fff' : '#666'
        }
      }
    },
    elements: {  // 圖表元素樣式
      line: {
        tension: 0.4,  // 線條平滑度：0-1，0為直線
        borderWidth: 2  // 線條寬度
      },
      point: {
        radius: 3,  // 數據點大小
        hoverRadius: 6  // 懸停時數據點大小
      }
    }
  };
};

// 定義交易所顏色和順序
const exchangeColors = {
  Binance: '#F3BA2F',  // 黃色
  Bybit: '#4183FC',    // 藍色
  Bitget: '#00b067',   // 綠色
  OKX: '#2FB8E7',      // OKX 品牌藍色
  HyperLiquid: '#FF0000'  // 紅色
};

// 定義交易所順序
const exchangeOrder = ['Binance', 'Bybit', 'Bitget', 'OKX', 'HyperLiquid'];

// 修改計算累計費率函數
const calculateCumulativeRates = (data, timeRange) => {
  if (!data?.data) return null;

  const now = new Date();
  let filterTime;
  switch (timeRange) {
    case '24h':
      filterTime = new Date(now - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      filterTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      filterTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const cumulativeRates = {};
  exchangeOrder.forEach(exchange => {
    const filteredData = data.data
      .filter(item => 
        item.exchange === exchange && 
        new Date(item.time) > filterTime &&
        item.rate !== null &&
        !item.isCurrent  // 排除當前費率
      )
      .map(item => parseFloat(item.rate));

    cumulativeRates[exchange] = filteredData.length > 0
      ? filteredData.reduce((sum, rate) => sum + rate, 0).toFixed(4)
      : null;
  });

  return cumulativeRates;
};

export default function HistoryPage() {
  const router = useRouter();
  const { symbol } = router.query;
  const [historyData, setHistoryData] = useState(null);
  const [currentRates, setCurrentRates] = useState(null);  // 添加當前費率狀態
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [chartData, setChartData] = useState(null);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    if (!historyData?.data) return;

    const now = new Date();
    let filterTime;
    switch (timeRange) {
      case '24h':
        filterTime = new Date(now - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        filterTime = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        filterTime = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    const filteredData = historyData.data.filter(item => 
      new Date(item.time) > filterTime
    );

    setChartData(filteredData);
  }, [timeRange, historyData]);

  useEffect(() => {
    if (!symbol) return;

    const fetchHistoryData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/history/${symbol}?exchange=${selectedExchange}`);
        const data = await response.json();
        setHistoryData(data);
      } catch (error) {
        console.error('Error fetching history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoryData();
  }, [symbol, selectedExchange]);

  // 獲取當前費率
  useEffect(() => {
    if (!symbol) return;

    const fetchCurrentRates = async () => {
      try {
        // 使用當前費率 API
        const currentData = {
          time: new Date().toISOString(),
          rates: {}
        };

        // 初始化所有交易所數據位置
        exchangeOrder.forEach(exchange => {
          currentData.rates[exchange] = {
            rate: null,
            hourlyRates: null
          };
        });

        // Bitget
        try {
          const bitgetRes = await fetch(
            `https://api.bitget.com/api/v2/mix/market/current-fund-rate?` + 
            `symbol=${symbol}USDT&productType=USDT-FUTURES`
          );
          const bitgetData = await bitgetRes.json();
          
          // 檢查 API 返回的完整結構
          if (bitgetData.code === '00000' && 
              bitgetData.data?.[0]?.symbol === `${symbol}USDT` && 
              bitgetData.data[0].fundingRate) {
            const rate = parseFloat(bitgetData.data[0].fundingRate);
            if (!isNaN(rate)) {
              currentData.rates.Bitget.rate = (rate * 100).toFixed(4);
            } else {
              console.debug('Bitget invalid rate value:', bitgetData.data[0].fundingRate);
            }
          } else {
            console.debug('Bitget response structure:', {
              code: bitgetData.code,
              msg: bitgetData.msg,
              data: bitgetData.data
            });
          }
        } catch (error) {
          console.error('Bitget current rate error:', error);
        }

        // Binance
        try {
          const binanceRes = await fetch(
            `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}USDT`
          );
          const binanceData = await binanceRes.json();
          if (binanceData.lastFundingRate) {
            currentData.rates.Binance.rate = 
              (parseFloat(binanceData.lastFundingRate) * 100).toFixed(4);
          }
        } catch (error) {
          console.error('Binance current rate error:', error);
        }

        // Bybit
        try {
          const bybitRes = await fetch(
            `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}USDT`
          );
          const bybitData = await bybitRes.json();
          if (bybitData.result?.list?.[0]) {
            const data = bybitData.result.list[0];
            // 確保資金費率存在且為有效數字
            if (data.fundingRate && !isNaN(parseFloat(data.fundingRate))) {
              currentData.rates.Bybit.rate = 
                (parseFloat(data.fundingRate) * 100).toFixed(4);
            }
          }
        } catch (error) {
          console.error('Bybit current rate error:', error);
        }

        // OKX
        try {
          const okxRes = await fetch(
            `https://www.okx.com/api/v5/public/funding-rate?instId=${symbol}-USDT-SWAP`
          );
          const okxData = await okxRes.json();
          if (okxData.data?.[0]) {
            const fundingRate = okxData.data[0].fundingRate;
            if (fundingRate && !isNaN(parseFloat(fundingRate))) {
              currentData.rates.OKX.rate = 
                (parseFloat(fundingRate) * 100).toFixed(4);
            }
          }
        } catch (error) {
          console.error('OKX current rate error:', error);
          // 只在真正出錯時才顯示調試信息
          if (!currentData.rates.OKX.rate) {
            console.debug('OKX Debug:', {
              error: error.message,
              data: okxData?.data?.[0]
            });
          }
        }

        // HyperLiquid
        try {
          const hyperRes = await fetch('https://api.hyperliquid.xyz/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'metaAndAssetCtxs'
            })
          });
          const hyperData = await hyperRes.json();
          if (Array.isArray(hyperData) && hyperData.length === 2) {
            const [metadata, assetContexts] = hyperData;
            const assetIndex = metadata.universe.findIndex(asset => asset.name === symbol);
            if (assetIndex !== -1 && assetContexts[assetIndex]) {
              // 獲取當前小時的資金費率
              const currentHourRes = await fetch('https://api.hyperliquid.xyz/info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'fundingHistory',
                  coin: symbol,
                  startTime: Math.floor(Date.now() - 3600000), // 一小時前
                  endTime: Math.floor(Date.now())
                })
              });
              
              const currentHourData = await currentHourRes.json();
              let totalRate = 0;
              
              if (Array.isArray(currentHourData)) {
                // 計算當前小時內所有費率的總和
                totalRate = currentHourData.reduce((sum, item) => {
                  return sum + parseFloat(item.funding || 0);
                }, 0);
              }
              
              currentData.rates.HyperLiquid = {
                rate: (totalRate * 100).toFixed(4),
                hourlyRates: currentHourData.map(item => ({
                  time: new Date(item.time).toLocaleString(),
                  rate: (parseFloat(item.funding) * 100).toFixed(4)
                }))
              };
            }
          }
        } catch (error) {
          console.error('HyperLiquid current rate error:', error);
        }

        // 在設置 currentRates 之前進行數據驗證
        Object.keys(currentData.rates).forEach(exchange => {
          const rate = currentData.rates[exchange].rate;
          if (rate === 'NaN' || rate === 'undefined' || rate === null) {
            currentData.rates[exchange].rate = null;  // 將無效值設為 null
          }
        });

        setCurrentRates(currentData);
      } catch (error) {
        console.error('Error fetching current rates:', error);
      }
    };

    fetchCurrentRates();
    // 每分鐘更新一次當前費率
    const interval = setInterval(fetchCurrentRates, 60000);
    return () => clearInterval(interval);
  }, [symbol]);

  // 初始化時檢查系統主題偏好
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  const getChartData = () => {
    if (!chartData) return null;

    const timeGroups = {};
    chartData.forEach(item => {
      const time = new Date(item.time);
      const timeKey = time.toLocaleString();
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = {};
      }
      // 確保將資金費率為 0 的數據點也包含進來
      timeGroups[timeKey][item.exchange] = item.rate;
    });

    const labels = Object.keys(timeGroups).reverse();
    const datasets = exchangeOrder
      .filter(exchange => selectedExchange === 'all' || selectedExchange === exchange)
      .map(exchange => ({
        label: exchange,
        data: labels.map(time => {
          const value = timeGroups[time][exchange];
          // 如果值存在（包括 0），則返回該值，否則返回 null
          return value !== undefined ? value : null;
        }),
        borderColor: exchangeColors[exchange],
        backgroundColor: exchangeColors[exchange],
        tension: 0.4,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2,
        spanGaps: true,
        order: exchangeOrder.indexOf(exchange)
      }));

    return { labels, datasets };
  };

  // 處理滑鼠懸停事件
  const handleMouseEnter = (event, rates) => {
    if (!rates?.hourlyRates) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    const content = rates.hourlyRates
      .filter(hr => hr.isHourly)  // 只顯示小時數據
      .map(hr => `${hr.time}: ${hr.rate}%`)
      .join('\n');

    setTooltipContent(content);
    setTooltipPosition({
      x: rect.left + (rect.width / 2),
      y: rect.top - 10
    });
  };

  // 處理滑鼠離開事件
  const handleMouseLeave = () => {
    setTooltipContent(null);
  };

  if (!symbol) return null;

  return (
    <div className={`container ${isDarkMode ? 'dark' : ''}`}>
      <Head>
        <title>{symbol} - 資金費率歷史</title>
      </Head>

      <main>
        <div className="header">
          <h1>{symbol} 資金費率歷史</h1>
          <div className="controls">
            <select 
              value={selectedExchange} 
              onChange={(e) => setSelectedExchange(e.target.value)}
              className="select-control"
            >
              <option value="all">所有交易所</option>
              <option value="HyperLiquid">HyperLiquid</option>
              <option value="Binance">Binance</option>
              <option value="Bybit">Bybit</option>
              <option value="Bitget">Bitget</option>
              <option value="OKX">OKX</option>
            </select>

            <div className="time-range">
              <button 
                className={timeRange === '24h' ? 'active' : ''} 
                onClick={() => setTimeRange('24h')}
              >
                24H
              </button>
              <button 
                className={timeRange === '7d' ? 'active' : ''} 
                onClick={() => setTimeRange('7d')}
              >
                7D
              </button>
              <button 
                className={timeRange === '30d' ? 'active' : ''} 
                onClick={() => setTimeRange('30d')}
              >
                30D
              </button>
            </div>

            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="theme-toggle"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        
        {isLoading ? (
          <div className="loading">載入中...</div>
        ) : (
          <div className="history-content">
            <div className="chart-container">
              {chartData && (
                <Line 
                  options={getChartOptions(getChartData(), isDarkMode)} 
                  data={getChartData()} 
                />
              )}
            </div>
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>時間</th>
                    {exchangeOrder.map(exchange => (
                      <th key={exchange} style={{ color: exchangeColors[exchange] }}>
                        {exchange}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 添加累計費率行 */}
                  <tr className="cumulative-row">
                    <td>累計 ({timeRange})</td>
                    {exchangeOrder.map(exchange => {
                      const cumulativeRates = calculateCumulativeRates(historyData, timeRange);
                      const rate = cumulativeRates?.[exchange];
                      return (
                        <td 
                          key={exchange}
                          className={`${
                            rate 
                              ? parseFloat(rate) > 0 
                                ? 'positive-rate' 
                                : 'negative-rate'
                              : ''
                          }`}
                        >
                          {rate ? `${rate}%` : '-'}
                        </td>
                      );
                    })}
                  </tr>
                  {/* 當前費率行 */}
                  {currentRates && (
                    <tr>
                      <td>當前</td>
                      {exchangeOrder.map(exchange => (
                        <td 
                          key={exchange}
                          className={`${
                            currentRates.rates[exchange]?.rate 
                              ? parseFloat(currentRates.rates[exchange].rate) > 0 
                                ? 'positive-rate' 
                                : 'negative-rate'
                              : ''
                          }`}
                          onMouseEnter={(e) => exchange === 'HyperLiquid' && 
                            handleMouseEnter(e, currentRates.rates[exchange])}
                          onMouseLeave={handleMouseLeave}
                        >
                          {currentRates.rates[exchange]?.rate 
                            ? `${currentRates.rates[exchange].rate}%` 
                            : '-'}
                          {exchange === 'HyperLiquid' && 
                           currentRates.rates[exchange]?.hourlyRates && (
                            <span className="info-icon">ℹ</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  )}
                  {/* 修改歷史數據行 */}
                  {Object.entries(
                    historyData?.data.reduce((acc, item) => {
                      if (item.isCurrent) return acc;
                      
                      const timeKey = new Date(item.time).toLocaleString();
                      if (!acc[timeKey]) {
                        acc[timeKey] = {};
                      }
                      acc[timeKey][item.exchange] = item;
                      return acc;
                    }, {})
                  ).sort((a, b) => new Date(b[0]) - new Date(a[0]))
                  .map(([time, rates]) => (
                    <tr key={time}>
                      <td>{time}</td>
                      {exchangeOrder.map(exchange => (
                        <td 
                          key={exchange}
                          className={`${rates[exchange]?.rate && parseFloat(rates[exchange].rate) > 0 ? 'positive-rate' : 'negative-rate'}`}
                          onMouseEnter={(e) => exchange === 'HyperLiquid' && rates[exchange]?.hourlyRates && handleMouseEnter(e, rates[exchange])}
                          onMouseLeave={handleMouseLeave}
                        >
                          {rates[exchange]?.rate ? `${rates[exchange].rate}%` : '-'}
                          {exchange === 'HyperLiquid' && rates[exchange]?.hourlyRates && (
                            <span className="info-icon">ℹ</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 提示框 */}
      {tooltipContent && (
        <div 
          className="tooltip"
          style={{
            position: 'fixed',
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 10000,
            background: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            lineHeight: 1.4,
            whiteSpace: 'pre',
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            maxWidth: '300px',
            maxHeight: '200px',
            overflowY: 'auto'
          }}
        >
          {tooltipContent}
          <div 
            style={{
              position: 'absolute',
              left: '50%',
              bottom: '-6px',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid rgba(0, 0, 0, 0.9)'
            }}
          />
        </div>
      )}

      <style jsx global>{`
        :root {
          --bg-primary: ${isDarkMode ? '#1a1a1a' : '#ffffff'};
          --bg-secondary: ${isDarkMode ? '#2d2d2d' : '#f8f9fa'};
          --text-primary: ${isDarkMode ? '#ffffff' : '#000000'};
          --text-secondary: ${isDarkMode ? '#cccccc' : '#666666'};
          --border-color: ${isDarkMode ? '#404040' : '#dddddd'};
          --positive-rate: ${isDarkMode ? '#4caf50' : '#4caf50'};
          --negative-rate: ${isDarkMode ? '#f44336' : '#f44336'};
        }

        body {
          background-color: var(--bg-primary);
          color: var(--text-primary);
        }

        .container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .controls {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .theme-toggle {
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          cursor: pointer;
          font-size: 16px;
        }

        .select-control {
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .time-range {
          display: flex;
          gap: 8px;
        }

        .time-range button {
          padding: 8px 16px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-secondary);
          color: var(--text-primary);
          cursor: pointer;
        }

        .time-range button.active {
          background: #007bff;
          color: white;
          border-color: #007bff;
        }

        .loading {
          text-align: center;
          padding: 20px;
        }

        .history-content {
          margin-top: 20px;
        }

        .chart-container {
          height: 400px;  // 圖表高度
          margin-bottom: 20px;  // 下邊距
          padding: 20px;  // 內邊距
          border: 1px solid var(--border-color);  // 邊框樣式
          border-radius: 4px;  // 圓角
          background: var(--bg-secondary);  // 背景色
        }

        .data-table {
          position: relative;
          overflow-x: auto;
          margin-top: 20px;
        }

        /* 添加容器來處理溢出 */
        .tooltip-container {
          position: fixed;
          pointer-events: none;
          z-index: 10000;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          white-space: nowrap;
        }

        th, td {
          padding: 12px;
          border: 1px solid var(--border-color);
          text-align: center;
          min-width: 100px;
        }

        th {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        td:first-child {
          background: var(--bg-secondary);
          color: var(--text-primary);
        }

        .positive-rate {
          color: var(--positive-rate);
        }

        .negative-rate {
          color: var(--negative-rate);
        }

        .has-tooltip {
          position: relative;
          cursor: help;
        }

        .has-tooltip:hover:before {
          content: attr(data-tooltip);
          position: fixed;  /* 改為 fixed 定位 */
          left: 50%;
          top: 50%;
          transform: translate(-50%, -150%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px;
          border-radius: 4px;
          white-space: pre;
          z-index: 10000;  /* 提高 z-index */
          min-width: 200px;
          max-width: 400px;
          font-size: 12px;
          line-height: 1.4;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          pointer-events: none;
          text-align: left;
        }

        .has-tooltip:hover:after {
          content: '';
          position: fixed;  /* 改為 fixed 定位 */
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          border: 8px solid transparent;
          border-top-color: rgba(0, 0, 0, 0.9);
          pointer-events: none;
          z-index: 10000;  /* 提高 z-index */
          margin-top: 20px;
        }

        /* 確保表格的 sticky 元素不會覆蓋提示框 */
        th, td:first-child {
          z-index: 2;
        }

        .info-icon {
          display: inline-block;
          margin-left: 4px;
          font-size: 0.8em;
          color: var(--text-secondary);
        }

        .tooltip {
          position: fixed;
          transform: translate(-50%, -100%);
          background: ${isDarkMode ? 'rgba(45, 45, 45, 0.95)' : 'rgba(0, 0, 0, 0.9)'};
          color: ${isDarkMode ? '#fff' : '#fff'};
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          line-height: 1.4;
          white-space: pre;
          z-index: 10000;
          pointer-events: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          max-width: 300px;
          max-height: 200px;
          overflow-y: auto;
          margin-top: -8px;
        }

        .tooltip::-webkit-scrollbar {
          width: 6px;
        }

        .tooltip::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }

        .tooltip::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
        }

        .hyperliquid-cell {
          position: relative;
          cursor: pointer;
        }

        .hyperliquid-cell:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .info-icon {
          display: inline-block;
          margin-left: 4px;
          font-size: 0.8em;
          color: var(--text-secondary);
          cursor: help;
        }

        .cumulative-row {
          background-color: ${isDarkMode ? '#2d2d2d' : '#f8f9fa'};
          font-weight: bold;
        }
        
        .cumulative-row td:first-child {
          font-weight: bold;
        }
      `}</style>
    </div>
  );
} 