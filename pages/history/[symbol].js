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

// 定義圖表選項函數，接收數據作為參數
const getChartOptions = (data) => {
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
        // labels: {  // 圖例標籤樣式
        //   padding: 20,  // 圖例間距
        //   font: { size: 13 },  // 圖例字體大小
        //   usePointStyle: true,  // 使用點狀圖例
        //   pointStyle: 'circle'  // 圖例形狀：'circle', 'rect', 'line'
        // }
      },
      title: {
        display: true,
        text: '資金費率歷史走勢'
        // font: {  // 標題字體
        //   size: 16,  // 字體大小
        //   weight: 'bold'  // 字體粗細
        // },
        // padding: {  // 標題內邊距
        //   top: 10,
        //   bottom: 20
        // }
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
        }
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
          // font: { size: 12 },  // 刻度字體大小
          // padding: 8  // 刻度內邊距
        },
        grid: {
          // color: 'rgba(0, 0, 0, 0.05)',  // 網格線顏色
          // drawBorder: false  // 是否繪製邊框
          color: 'rgba(0, 0, 0, 0.1)'  // 當前網格線顏色
        }
        // border: {  // 軸線樣式
        //   display: true,
        //   color: 'rgba(0, 0, 0, 0.1)'
        // }
      },
      x: {
        grid: {
          display: false  // 不顯示X軸網格線
        },
        ticks: {
          maxRotation: 0,  // 標籤不旋轉
          autoSkip: true,  // 自動跳過重疊的標籤
          maxTicksLimit: 12  // 最大標籤數量
          // font: { size: 12 },  // 標籤字體大小
          // padding: 8  // 標籤內邊距
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
  OKX: '#101F35',      // 深藍色
  HyperLiquid: '#FF0000'  // 紅色
};

// 定義交易所順序
const exchangeOrder = ['Binance', 'Bybit', 'Bitget', 'OKX', 'HyperLiquid'];

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
              type: 'fundingRates',
              coin: symbol
            })
          });
          const hyperData = await hyperRes.json();
          if (Array.isArray(hyperData) && hyperData.length > 0) {
            currentData.rates.HyperLiquid = {
              rate: (parseFloat(hyperData[0].fundingRate) * 100).toFixed(4),
              hourlyRates: hyperData.map(item => ({
                time: new Date(item.time).toLocaleString(),
                rate: (parseFloat(item.fundingRate) * 100).toFixed(4)
              }))
            };
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

  const getChartData = () => {
    if (!chartData) return null;

    const timeGroups = {};
    chartData.forEach(item => {
      const time = new Date(item.time);
      const timeKey = time.toLocaleString();
      if (!timeGroups[timeKey]) {
        timeGroups[timeKey] = {};
      }
      timeGroups[timeKey][item.exchange] = parseFloat(item.rate);
    });

    const labels = Object.keys(timeGroups).reverse();
    const datasets = exchangeOrder
      .filter(exchange => selectedExchange === 'all' || selectedExchange === exchange)
      .map(exchange => ({
        label: exchange,
        data: labels.map(time => timeGroups[time][exchange] || null),
        borderColor: exchangeColors[exchange],
        backgroundColor: exchangeColors[exchange],
        tension: 0.4,  // 線條平滑度
        pointRadius: 3,  // 數據點大小
        pointHoverRadius: 6,  // 懸停時數據點大小
        borderWidth: 2,  // 線條寬度
        spanGaps: true,  // 連接空值之間的線條
        order: exchangeOrder.indexOf(exchange)
      }));

    return { labels, datasets };
  };

  // 處理滑鼠懸停事件
  const handleMouseEnter = (event, rates) => {
    if (!rates?.hourlyRates) return;
    
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipContent(
      rates.hourlyRates.map(hr => `${hr.time}: ${hr.rate}%`).join('\n')
    );
    setTooltipPosition({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY
    });
  };

  // 處理滑鼠離開事件
  const handleMouseLeave = () => {
    setTooltipContent(null);
  };

  if (!symbol) return null;

  return (
    <div className="container">
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
              <option value="Binance">Binance</option>
              <option value="Bybit">Bybit</option>
              <option value="OKX">OKX</option>
              <option value="Bitget">Bitget</option>
              <option value="HyperLiquid">HyperLiquid</option>
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
          </div>
        </div>
        
        {isLoading ? (
          <div className="loading">載入中...</div>
        ) : (
          <div className="history-content">
            <div className="chart-container">
              {chartData && (
                <Line 
                  options={getChartOptions(getChartData())} 
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
                  {/* 添加當前費率行 */}
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
                  {/* 歷史數據行 */}
                  {Object.entries(
                    historyData?.data.reduce((acc, item) => {
                      const timeKey = new Date(item.time).toLocaleString();
                      if (!acc[timeKey]) {
                        acc[timeKey] = {};
                      }
                      acc[timeKey][item.exchange] = item.rate;
                      return acc;
                    }, {})
                  ).sort((a, b) => new Date(b[0]) - new Date(a[0]))
                  .map(([time, rates]) => (
                    <tr key={time}>
                      <td>{time}</td>
                      {exchangeOrder.map(exchange => (
                        <td 
                          key={exchange}
                          className={`${rates[exchange] && parseFloat(rates[exchange]) > 0 ? 'positive-rate' : 'negative-rate'}`}
                          onMouseEnter={(e) => exchange === 'HyperLiquid' && handleMouseEnter(e, rates[exchange])}
                          onMouseLeave={handleMouseLeave}
                        >
                          {rates[exchange] ? `${rates[exchange]}%` : '-'}
                          {exchange === 'HyperLiquid' && rates[exchange] && (
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
        </div>
      )}

      <style jsx>{`
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
          gap: 16px;
          align-items: center;
        }

        .select-control {
          padding: 8px;
          border-radius: 4px;
          border: 1px solid #ddd;
        }

        .time-range {
          display: flex;
          gap: 8px;
        }

        .time-range button {
          padding: 8px 16px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
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
          border: 1px solid #ddd;  // 邊框樣式
          border-radius: 4px;  // 圓角
          background: white;  // 背景色
          // box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);  // 陰影效果
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
          border: 1px solid #ddd;
          text-align: center;
          min-width: 100px;
        }

        th {
          background: #f8f9fa;
          position: sticky;
          top: 0;
        }

        td:first-child {
          position: sticky;
          left: 0;
          background: #f8f9fa;
          z-index: 1;
        }

        .positive-rate {
          color: #4caf50;
        }

        .negative-rate {
          color: #f44336;
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
          color: #666;
        }

        .tooltip {
          position: fixed;
          transform: translate(-50%, -100%);
          background: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 12px;
          line-height: 1.4;
          white-space: pre;
          z-index: 10000;
          pointer-events: none;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          max-width: 300px;
          margin-top: -8px;
        }

        .tooltip:after {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: rgba(0, 0, 0, 0.9);
        }

        // 移動端響應式
        // @media (max-width: 768px) {
        //   .chart-container {
        //     height: 350px;  // 移動端圖表高度
        //     padding: 15px;  // 移動端內邊距
        //   }
        // }
      `}</style>
    </div>
  );
} 