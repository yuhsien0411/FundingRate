import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import Head from 'next/head';
import {
  Chart,
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
Chart.register(
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
  let yMin = Math.floor((center - adjustedHalfRange) * 10000) / 10000;
  let yMax = Math.ceil((center + adjustedHalfRange) * 10000) / 10000;
  
  // 計算合適的步進值
  const totalRange = yMax - yMin;
  const getStepSize = (range) => {
    if (range <= 0.0001) return 0.00002;
    if (range <= 0.0002) return 0.00004;
    if (range <= 0.0005) return 0.0001;
    if (range <= 0.001) return 0.0002;
    if (range <= 0.002) return 0.0004;
    return 0.0005;
  };
  
  const stepSize = getStepSize(totalRange);
  
  // 調整範圍以適應步進值
  const steps = Math.ceil(totalRange / stepSize);
  const adjustedRange = steps * stepSize;
  const extraSpace = (adjustedRange - totalRange) / 2;
  
  yMin = Math.floor((yMin - extraSpace) * 10000) / 10000;
  yMax = Math.ceil((yMax + extraSpace) * 10000) / 10000;

  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDarkMode ? '#fff' : '#666',
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: '資金費率歷史走勢',
        color: isDarkMode ? '#fff' : '#333',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          top: 20,
          bottom: 20
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.dataset.label}: ${(context.parsed.y * 100).toFixed(4)}%`;
          }
        },
        itemSort: function(a, b) {
          return b.parsed.y - a.parsed.y;
        },
        backgroundColor: isDarkMode ? 'rgba(45, 45, 45, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        titleColor: isDarkMode ? '#fff' : '#333',
        bodyColor: isDarkMode ? '#fff' : '#333',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        padding: 10,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
      }
    },
    scales: {
      y: {
        min: yMin,
        max: yMax,
        ticks: {
          callback: value => (value * 100).toFixed(4) + '%',
          stepSize,
          maxTicksLimit: 10,
          color: isDarkMode ? '#fff' : '#666',
          font: {
            size: 11
          }
        },
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          drawBorder: false
        },
        border: {
          display: true,
          color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'
        }
      },
      x: {
        grid: {
          display: false,
          drawBorder: false
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 12,
          color: isDarkMode ? '#fff' : '#666',
          font: {
            size: 11
          }
        },
        border: {
          display: true,
          color: isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'
        }
      }
    },
    elements: {
      line: {
        tension: 0.4,
        borderWidth: 2
      },
      point: {
        radius: 2,
        hoverRadius: 4,
        hitRadius: 6
      }
    },
    layout: {
      padding: {
        top: 10,
        right: 20,
        bottom: 10,
        left: 10
      }
    }
  };
};

// 定義交易所顏色和順序
const exchangeColors = {
  Binance: '#FF0000',  // 紅色
  Bybit: '#F3BA2F',    // 黃色
  Bitget: '#00CED1',   // 湖水綠
  OKX: '#000000',      // 預設黑色
  'Gate.io': '#4183FC', // 藍色
  HyperLiquid: '#006400'  // 深綠色
};

// 定義交易所順序
const exchangeOrder = ['Binance', 'Bybit', 'Bitget', 'OKX', 'Gate.io', 'HyperLiquid'];

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
      ? filteredData.reduce((sum, rate) => sum + rate, 0).toFixed(3)
      : null;
  });

  return cumulativeRates;
};

export default function HistoryPage() {
  const router = useRouter();
  const { symbol } = router.query;
  const [historyData, setHistoryData] = useState(null);
  const [currentRates, setCurrentRates] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedExchange, setSelectedExchange] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [chartData, setChartData] = useState(null);
  const [tooltipContent, setTooltipContent] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 檢測螢幕尺寸
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // 初始檢測
    checkIsMobile();
    
    // 監聽螢幕尺寸變化
    window.addEventListener('resize', checkIsMobile);
    
    // 清理事件監聽器
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

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

    // 過濾歷史數據
    const filteredData = historyData.data.filter(item => 
      new Date(item.time) > filterTime
    );
    
    // 如果有當前費率，將其添加到圖表數據中
    let chartDataWithCurrent = [...filteredData];
    
    if (currentRates) {
      // 將當前費率添加到數據中
      Object.entries(currentRates.rates).forEach(([exchange, data]) => {
        if (data.rate && !isNaN(parseFloat(data.rate))) {
          chartDataWithCurrent.push({
            symbol: symbol,
            exchange: exchange,
            rate: data.rate,
            time: currentRates.time,
            isCurrent: true
          });
        }
      });
    }
    
    setChartData(chartDataWithCurrent);
  }, [timeRange, historyData, currentRates, symbol]);

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
              currentData.rates.Bitget.rate = (rate * 100).toFixed(3);
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
              (parseFloat(binanceData.lastFundingRate) * 100).toFixed(3);
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
                (parseFloat(data.fundingRate) * 100).toFixed(3);
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
                (parseFloat(fundingRate) * 100).toFixed(3);
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

        // Gate.io
        try {
          const gateRes = await fetch(
            `/api/gateio/current-rate?symbol=${symbol}`
          );
          const gateData = await gateRes.json();
          if (gateData.success && gateData.rate) {
            currentData.rates['Gate.io'].rate = gateData.rate;
          } else {
            console.debug('Gate.io API response:', gateData);
          }
        } catch (error) {
          console.error('Gate.io current rate error:', error);
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

  // 更新 Chart.js 全局配置
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (isDarkMode) {
        Chart.defaults.color = '#ffffff';
        Chart.defaults.backgroundColor = '#2d2d2d';
        Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
      } else {
        Chart.defaults.color = '#666666';
        Chart.defaults.backgroundColor = '#ffffff';
        Chart.defaults.borderColor = 'rgba(0, 0, 0, 0.1)';
      }
    }
  }, [isDarkMode]);

  // 初始化時檢查系統主題偏好
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
    
    // 設置 body 的 class 以便應用深色模式
    if (prefersDark) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, []);
  
  // 處理深色模式切換
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
  }, [isDarkMode]);

  const getChartData = () => {
    if (!chartData) return null;

    const timeGroups = {};
    chartData.forEach(item => {
      const time = new Date(item.time);
      const timeKey = time.toLocaleString();
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = {};
      }
      // 將資金費率轉換為小數形式
      timeGroups[timeKey][item.exchange] = parseFloat(item.rate) / 100;
    });

    const labels = Object.keys(timeGroups).reverse();
    const datasets = exchangeOrder
      .filter(exchange => selectedExchange === 'all' || selectedExchange === exchange)
      .map(exchange => ({
        label: exchange,
        data: labels.map(time => {
          const value = timeGroups[time][exchange];
          return value !== undefined ? value : null;
        }),
        borderColor: exchange === 'OKX' ? (isDarkMode ? '#FFFFFF' : '#000000') : exchangeColors[exchange],
        backgroundColor: exchange === 'OKX' ? (isDarkMode ? '#FFFFFF' : '#000000') : exchangeColors[exchange],
        tension: 0.4,
        pointRadius: 2,
        pointHoverRadius: 4,
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
    let content = '';
    
    if (Array.isArray(rates.hourlyRates)) {
      content = rates.hourlyRates
        .map(hr => `${hr.time}: ${hr.rate}%`)
        .join('\n');
    }
    
    if (content) {
      setTooltipContent(content);
      setTooltipPosition({
        x: rect.left + (rect.width / 2),
        y: rect.top - 10
      });
    }
  };

  // 處理滑鼠離開事件
  const handleMouseLeave = () => {
    setTooltipContent(null);
  };

  // 更新圖表配置以適應移動設備
  const getResponsiveChartOptions = (data, isDarkMode) => {
    const options = getChartOptions(data, isDarkMode);
    
    if (isMobile) {
      // 調整移動端的圖表配置
      options.plugins.legend.labels.padding = 10;
      options.plugins.legend.labels.boxWidth = 12;
      options.plugins.legend.labels.font.size = 10;
      options.plugins.title.font.size = 14;
      options.scales.x.ticks.maxTicksLimit = 6;
      options.scales.y.ticks.font.size = 9;
      options.scales.x.ticks.font.size = 9;
    }
    
    return options;
  };

  if (!symbol) return null;

  return (
    <div className={`container ${isDarkMode ? 'dark' : ''}`}>
      <Head>
        <title>{symbol} - 資金費率歷史</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
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
              <option value="Gate.io">Gate.io</option>
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
            <div className="chart-container" style={{ background: isDarkMode ? '#2d2d2d' : '#ffffff' }}>
              {chartData && (
                <Line 
                  options={getResponsiveChartOptions(getChartData(), isDarkMode)} 
                  data={getChartData()} 
                />
              )}
            </div>
            <div className="data-table">
              {isMobile && <div className="swipe-indicator">👉</div>}
              <table>
                <thead>
                  <tr>
                    <th>時間</th>
                    {exchangeOrder.map(exchange => (
                      <th key={exchange} style={{ color: exchange === 'OKX' ? (isDarkMode ? '#FFFFFF' : '#000000') : exchangeColors[exchange] }}>
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
                            rate && !isNaN(parseFloat(rate))
                              ? parseFloat(rate) > 0 
                                ? 'positive-rate' 
                                : 'negative-rate'
                              : ''
                          }`}
                        >
                          <span className={`funding-rate ${rate && !isNaN(parseFloat(rate)) ? (parseFloat(rate) >= 0 ? 'positive-rate' : 'negative-rate') : ''}`}>
                            {rate && !isNaN(parseFloat(rate)) ? parseFloat(rate).toFixed(3) + '%' : '-'}
                          </span>
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
                            currentRates.rates[exchange]?.rate && !isNaN(parseFloat(currentRates.rates[exchange].rate))
                              ? parseFloat(currentRates.rates[exchange].rate) > 0 
                                ? 'positive-rate' 
                                : 'negative-rate'
                              : ''
                          }`}
                          onMouseEnter={(e) => exchange === 'HyperLiquid' && 
                            handleMouseEnter(e, currentRates.rates[exchange])}
                          onMouseLeave={handleMouseLeave}
                        >
                          <span className={`funding-rate ${currentRates.rates[exchange]?.rate && !isNaN(parseFloat(currentRates.rates[exchange].rate)) ? (parseFloat(currentRates.rates[exchange].rate) >= 0 ? 'positive-rate' : 'negative-rate') : ''}`}>
                            {currentRates.rates[exchange]?.rate && !isNaN(parseFloat(currentRates.rates[exchange].rate)) 
                              ? parseFloat(currentRates.rates[exchange].rate).toFixed(3) + '%' 
                              : '-'}
                          </span>
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
                          className={`${rates[exchange]?.rate && !isNaN(parseFloat(rates[exchange].rate)) ? (parseFloat(rates[exchange].rate) > 0 ? 'positive-rate' : 'negative-rate') : ''}`}
                          onMouseEnter={(e) => exchange === 'HyperLiquid' && rates[exchange]?.hourlyRates && handleMouseEnter(e, rates[exchange])}
                          onMouseLeave={handleMouseLeave}
                        >
                          <span className={`funding-rate ${rates[exchange]?.rate && !isNaN(parseFloat(rates[exchange].rate)) ? (parseFloat(rates[exchange].rate) >= 0 ? 'positive-rate' : 'negative-rate') : ''}`}>
                            {rates[exchange]?.rate && !isNaN(parseFloat(rates[exchange].rate)) ? parseFloat(rates[exchange].rate).toFixed(3) + '%' : '-'}
                          </span>
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
            left: `${tooltipPosition.x}px`,
            top: `${tooltipPosition.y}px`
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
              borderTop: '6px solid var(--bg-secondary)'
            }}
          />
        </div>
      )}
    </div>
  );
} 