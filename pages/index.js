import React, { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  // 狀態管理
  const [fundingRates, setFundingRates] = useState([]); // 原始資金費率數據
  const [groupedRates, setGroupedRates] = useState({}); // 按幣種分組的資金費率
  const [exchanges, setExchanges] = useState([]); // 交易所列表
  const [isLoading, setIsLoading] = useState(true); // 載入狀態
  const [sortConfig, setSortConfig] = useState({ key: 'symbol', direction: 'asc' }); // 幣種排序配置
  const [exchangeSort, setExchangeSort] = useState({ exchange: null, direction: 'desc' }); // 交易所排序配置
  const [hourlyExchanges, setHourlyExchanges] = useState(new Set(['HyperLiquid'])); // 1小時結算的交易所集合
  const [isDarkMode, setIsDarkMode] = useState(false); // 深色模式狀態
  const [mounted, setMounted] = useState(false); // 組件掛載狀態，用於解決 SSR 問題
  const [isUpdating, setIsUpdating] = useState(false); // 添加更新狀態
  const [showInterval, setShowInterval] = useState(false); // 添加顯示模式狀態
  const [showNormalized, setShowNormalized] = useState(false); // 添加標準化顯示狀態
  const [selectedExchanges, setSelectedExchanges] = useState(new Set(['Binance', 'Bybit', 'OKX', 'Bitget', 'HyperLiquid']));
  const allExchanges = [
    { id: 'Binance', order: 1 },
    { id: 'Bybit', order: 2 },
    { id: 'Bitget', order: 3 },
    { id: 'OKX', order: 4 },
    { id: 'HyperLiquid', order: 5 }
  ];

  // 初始化主題設置
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        setIsDarkMode(savedTheme === 'dark');
      } else {
        setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
      }
    }
  }, []);

  // 監聽深色模式變化，更新 HTML class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [isDarkMode]);

  // 修改數據獲取邏輯
  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!isLoading) {
          setIsUpdating(true);
        }
        
        const response = await fetch('/api/funding-rates');
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data)) {
          // 只更新已選擇的交易所數據
          setFundingRates(prevRates => {
            const newRates = data.data.filter(rate => selectedExchanges.has(rate.exchange));
            if (JSON.stringify(prevRates) !== JSON.stringify(newRates)) {
              return newRates;
            }
            return prevRates;
          });

          // 同樣只分組已選擇的交易所數據
          setGroupedRates(prevGrouped => {
            const newGrouped = data.data
              .filter(rate => selectedExchanges.has(rate.exchange))
              .reduce((acc, rate) => {
                if (!acc[rate.symbol]) {
                  acc[rate.symbol] = {};
                }
                acc[rate.symbol][rate.exchange] = rate;
                return acc;
              }, {});

            if (JSON.stringify(prevGrouped) !== JSON.stringify(newGrouped)) {
              return newGrouped;
            }
            return prevGrouped;
          });
          
          // 設置 1 小時結算的交易所
          const hourlySet = new Set(['HyperLiquid']);
          if (data.data.some(rate => rate.exchange === 'Bybit' && rate.isHourly)) {
            hourlySet.add('Bybit');
          }
          setHourlyExchanges(hourlySet);
        }
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
        setIsUpdating(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [selectedExchanges]); // 添加 selectedExchanges 作為依賴

  // 處理幣種排序
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setExchangeSort({ exchange: null, direction: 'desc' });
  };

  // 處理交易所排序
  const handleExchangeSort = (exchange) => {
    setExchangeSort(prev => ({
      exchange,
      direction: prev.exchange === exchange && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
    setSortConfig({ key: null, direction: null });
  };

  // 排序邏輯
  const sortedSymbols = Object.keys(groupedRates).sort((a, b) => {
    // 檢查是否有數據
    const aHasData = exchangeSort.exchange ? 
      !!groupedRates[a][exchangeSort.exchange] : 
      exchanges.some(e => !!groupedRates[a][e]);
    
    const bHasData = exchangeSort.exchange ? 
      !!groupedRates[b][exchangeSort.exchange] : 
      exchanges.some(e => !!groupedRates[b][e]);

    // 有數據的排在前面
    if (aHasData !== bHasData) {
      return aHasData ? -1 : 1;
    }

    // 按幣種或費率排序
    if (sortConfig.key === 'symbol') {
      return sortConfig.direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
    } else if (exchangeSort.exchange) {
      const aRate = groupedRates[a][exchangeSort.exchange]?.currentRate.split('(')[0] || '-999';
      const bRate = groupedRates[b][exchangeSort.exchange]?.currentRate.split('(')[0] || '-999';
      return exchangeSort.direction === 'asc' ? 
        parseFloat(aRate) - parseFloat(bRate) : 
        parseFloat(bRate) - parseFloat(aRate);
    }
    return 0;
  });

  // 切換主題
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  // 處理交易所選擇
  const handleExchangeToggle = (exchangeId) => {
    setSelectedExchanges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(exchangeId)) {
        newSet.delete(exchangeId);
      } else {
        newSet.add(exchangeId);
      }
      return newSet;
    });
  };

  // 在 useEffect 中更新 exchanges，保持順序
  useEffect(() => {
    const sortedExchanges = allExchanges
      .filter(exchange => selectedExchanges.has(exchange.id))
      .sort((a, b) => a.order - b.order)
      .map(exchange => exchange.id);
    setExchanges(sortedExchanges);
  }, [selectedExchanges]);

  // 等待客戶端渲染
  if (!mounted) return null;

  return (
    <div className={`container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <Head>
        <title>永續合約資金費率比較</title>
        <meta name="description" content="永續合約資金費率比較" />
      </Head>

      <main>
        <div className="header-container">
          <div className="title-container">
            <h1>永續合約資金費率比較</h1>
          </div>
          <div className="controls">
            <div className="exchange-dropdown">
              <button className="dropdown-button">
                交易所選擇 ({selectedExchanges.size})
              </button>
              <div className="dropdown-content">
                {allExchanges.map(exchange => (
                  <label key={exchange.id} className="exchange-option">
                    <input
                      type="checkbox"
                      checked={selectedExchanges.has(exchange.id)}
                      onChange={() => handleExchangeToggle(exchange.id)}
                      disabled={selectedExchanges.size === 1 && selectedExchanges.has(exchange.id)}
                    />
                    {exchange.id}
                  </label>
                ))}
              </div>
            </div>
            <button 
              onClick={() => setShowInterval(!showInterval)}
              className={`display-toggle ${showInterval ? 'active' : ''}`}
              title={showInterval ? "切換為星號顯示" : "切換為小時顯示"}
            >
              {showInterval ? "星號" : "小時"}
            </button>
            <button 
              onClick={() => setShowNormalized(!showNormalized)}
              className={`display-toggle ${showNormalized ? 'active' : ''}`}
              title={showNormalized ? "顯示當前費率" : "顯示8小時費率"}
            >
              {showNormalized ? "當前" : "8 H"}
            </button>
            <button 
              onClick={toggleTheme}
              className="theme-toggle"
              title={isDarkMode ? "切換至淺色模式" : "切換至深色模式"}
            >
              {isDarkMode ? '🌞' : '🌙'}
            </button>
          </div>
        </div>
        
        <div className="rates-table">
          {isLoading ? (
            <div className="loading">載入中...</div>
          ) : (
            <>
              {isUpdating && (
                <div className="updating-indicator">
                  更新中...
                </div>
              )}
              <table className={isUpdating ? 'updating' : ''}>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('symbol')} className="sortable">
                      幣種 {sortConfig.key === 'symbol' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                    </th>
                    {exchanges.map(exchange => (
                      <th 
                        key={exchange} 
                        onClick={() => handleExchangeSort(exchange)} 
                        className="sortable"
                      >
                        {exchange}
                        {hourlyExchanges.has(exchange) && (
                          <span style={{ marginLeft: '4px', color: '#ffd700' }} title="每1小時結算">
                            ★1h
                          </span>
                        )}
                        {exchangeSort.exchange === exchange ? 
                          (exchangeSort.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedSymbols.map(symbol => (
                    <tr key={symbol}>
                      <td>{symbol}</td>
                      {exchanges.map(exchange => {
                        const data = groupedRates[symbol][exchange];
                        return (
                          <td 
                            key={`${symbol}-${exchange}`}
                            className={data && parseFloat(data.currentRate) > 0 ? 'positive-rate' : 'negative-rate'}
                            style={{ textAlign: 'center' }}
                          >
                            {data ? (
                              <>
                                {showNormalized && data.settlementInterval && data.settlementInterval !== 8 ? (
                                  // 標準化為8小時費率
                                  `${(parseFloat(data.currentRate) * (8 / data.settlementInterval)).toFixed(4)}%`
                                ) : (
                                  `${parseFloat(data.currentRate)}%`
                                )}
                                {data.isSpecialInterval && (
                                  <span 
                                    style={{ color: '#ffd700' }} 
                                    title={`每${data.settlementInterval}小時結算${showNormalized ? ' (已轉換為8小時)' : ''}`}
                                  >
                                    {showInterval ? `${data.settlementInterval}H` : '*'}
                                  </span>
                                )}
                              </>
                            ) : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </main>

      <style jsx global>{`
        :root {
          --bg-color: ${isDarkMode ? '#000000' : '#ffffff'};
          --text-color: ${isDarkMode ? '#ffffff' : '#000000'};
          --table-border: ${isDarkMode ? '#333333' : '#dddddd'};
          --hover-bg: ${isDarkMode ? '#2a2a2a' : '#f5f5f5'};
          --positive-color: ${isDarkMode ? '#4caf50' : '#4caf50'};
          --negative-color: ${isDarkMode ? '#f44336' : '#f44336'};
          --header-bg: ${isDarkMode ? '#000000' : '#f8f9fa'};
          --loading-bg: ${isDarkMode ? '#242424' : '#f8f9fa'};
          --th-bg: ${isDarkMode ? '#000000' : '#f8f9fa'};
          --td-bg: ${isDarkMode ? '#000000' : '#ffffff'};
        }

        body {
          background-color: var(--bg-color);
          color: var(--text-color);
          transition: background-color 0.3s, color 0.3s;
          margin: 0;
          padding: 0;
        }

        .container {
          min-height: 100vh;
          padding: 20px;
          background-color: var(--bg-color);
        }

        .header-container {
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 20px;
          position: relative;
        }

        .title-container {
          text-align: center;
          flex-grow: 1;
        }

        .controls {
          display: flex;
          gap: 10px;
          position: absolute;
          right: 0;
          align-items: center;
        }

        .display-toggle {
          padding: 5px 10px;
          border: 1px solid var(--table-border);
          border-radius: 4px;
          background: var(--bg-color);
          cursor: pointer;
          color: var(--text-color);
          transition: all 0.3s ease;
          min-width: 56px;
          text-align: center;
          display: inline-block;
          font-size: 14px;
          line-height: 1.5;
        }

        .display-toggle:hover {
          background: var(--hover-bg);
        }

        .display-toggle.active {
          background: var(--text-color);
          color: var(--bg-color);
          border-color: var(--text-color);
        }

        /* 深色模式適配 */
        :global(.dark-mode) .display-toggle.active {
          background: var(--text-color);
          color: var(--bg-color);
        }

        .theme-toggle {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: background-color 0.3s;
          color: var(--text-color);
        }

        .theme-toggle:hover {
          background-color: var(--hover-bg);
        }

        .loading {
          padding: 20px;
          text-align: center;
          background-color: var(--loading-bg);
          border-radius: 8px;
          color: var(--text-color);
        }

        table {
          width: 100%;
          border-collapse: collapse;
          background-color: var(--bg-color) !important;
          border: 1px solid var(--table-border);
        }

        th, td {
          padding: 12px;
          text-align: center !important;
          border: 1px solid var(--table-border);
          color: var(--text-color);
          background-color: var(--td-bg) !important;
        }

        th {
          background-color: var(--th-bg) !important;
          font-weight: bold;
        }

        tr {
          background-color: var(--td-bg) !important;
        }

        tr:hover td {
          background-color: var(--hover-bg) !important;
        }

        .positive-rate {
          color: var(--positive-color) !important;
        }

        .negative-rate {
          color: var(--negative-color) !important;
        }

        .sortable {
          cursor: pointer;
          user-select: none;
        }

        .sortable:hover {
          background-color: var(--hover-bg);
        }

        h1 {
          margin: 0;
          color: var(--text-color);
        }

        .dark-mode {
          background-color: var(--bg-color) !important;
        }

        td:first-child {
          text-align: center !important;
          font-weight: bold;
        }

        .updating-indicator {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 8px 16px;
          background-color: var(--header-bg);
          border-radius: 4px;
          opacity: 0.8;
          transition: opacity 0.3s;
        }

        .updating {
          transition: opacity 0.3s;
        }

        /* 數據變化時的過渡效果 */
        td {
          transition: background-color 0.3s, color 0.3s;
        }

        .positive-rate, .negative-rate {
          transition: color 0.3s;
        }

        /* 確保更新時不會有跳動 */
        table {
          table-layout: fixed;
          width: 100%;
        }

        td, th {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .exchange-dropdown {
          position: relative;
          display: inline-block;
        }

        .dropdown-button {
          padding: 5px 10px;
          border: 1px solid var(--table-border);
          border-radius: 4px;
          background: var(--bg-color);
          color: var(--text-color);
          cursor: pointer;
          min-width: 120px;
        }

        .dropdown-content {
          display: none;
          position: absolute;
          right: 0;
          background-color: var(--bg-color);
          min-width: 160px;
          box-shadow: 0 8px 16px rgba(0,0,0,0.2);
          padding: 8px;
          border-radius: 4px;
          border: 1px solid var(--table-border);
          z-index: 1;
        }

        .exchange-dropdown:hover .dropdown-content {
          display: block;
        }

        .exchange-option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          cursor: pointer;
          white-space: nowrap;
        }

        .exchange-option:hover {
          background-color: var(--hover-bg);
        }

        .exchange-option input {
          cursor: pointer;
        }

        .exchange-option input:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        /* 深色模式適配 */
        :global(.dark-mode) .dropdown-content {
          box-shadow: 0 8px 16px rgba(255,255,255,0.1);
        }
      `}</style>
    </div>
  );
} 