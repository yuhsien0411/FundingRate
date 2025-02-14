export default async function handler(req, res) {
  try {
    // 並行請求各交易所的 API
    const [
      binanceRatesRes, 
      binanceFundingInfoRes, 
      bybitRatesRes, 
      bybitInstrumentsRes,
      bitgetRatesRes, 
      bitgetContractsRes,
      okxTickersRes,  // 先獲取所有 USDT 永續合約
      okxInstrumentsRes,
      hyperliquidRes
    ] = await Promise.all([
      fetch('https://fapi.binance.com/fapi/v1/premiumIndex'),
      fetch('https://fapi.binance.com/fapi/v1/fundingInfo'),
      fetch('https://api.bybit.com/v5/market/tickers?category=linear'),
      fetch('https://api.bybit.com/v5/market/instruments-info?category=linear'),
      fetch('https://api.bitget.com/api/v2/mix/market/tickers?productType=USDT-FUTURES'),
      fetch('https://api.bitget.com/api/v2/mix/market/contracts?productType=usdt-futures'),
      fetch('https://www.okx.com/api/v5/market/tickers?instType=SWAP'),  // 獲取所有永續合約
      fetch('https://www.okx.com/api/v5/public/instruments?instType=SWAP'),
      fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' })
      })
    ]);

    const [
      binanceRatesData, 
      binanceFundingInfoData, 
      bybitRatesData, 
      bybitInstrumentsData,
      bitgetRatesData, 
      bitgetContractsData,
      okxTickersData,  // 先獲取所有 USDT 永續合約
      okxInstrumentsData,
      hyperliquidData
    ] = await Promise.all([
      binanceRatesRes.json(),
      binanceFundingInfoRes.json(),
      bybitRatesRes.json(),
      bybitInstrumentsRes.json(),
      bitgetRatesRes.json(),
      bitgetContractsRes.json(),
      okxTickersRes.json(),  // 先獲取所有 USDT 永續合約
      okxInstrumentsRes.json(),
      hyperliquidRes.json()
    ]);

    // 創建幣安結算週期映射
    const binanceIntervals = {};
    binanceFundingInfoData.forEach(info => {
      binanceIntervals[info.symbol] = parseInt(info.fundingIntervalHours) || 8;
    });

    // 創建 Bybit 結算週期映射
    const bybitIntervals = {};
    bybitInstrumentsData.result.list.forEach(instrument => {
      // 將分鐘轉換為小時
      bybitIntervals[instrument.symbol] = (parseInt(instrument.fundingInterval) || 480) / 60;
    });

    // 處理幣安數據
    const binanceRates = binanceRatesData
      .filter(item => item.symbol.endsWith('USDT'))
      .map(item => {
        const interval = binanceIntervals[item.symbol] || 8; // 使用合約信息中的結算週期
        
        return {
          symbol: item.symbol.replace('USDT', ''),
          exchange: 'Binance',
          currentRate: (parseFloat(item.lastFundingRate) * 100).toFixed(4),
          isSpecialInterval: interval !== 8,  // 如果不是8小時就標記
          settlementInterval: interval  // 使用實際的結算間隔
        };
      });

    // 創建 Bitget 合約結算週期映射
    const bitgetIntervals = {};
    bitgetContractsData.data.forEach(contract => {
      bitgetIntervals[contract.symbol] = parseInt(contract.fundInterval) || 8;
    });

    // 處理 HyperLiquid 數據
    // HyperLiquid 返回的是一個包含兩個元素的數組：[metadata, assetContexts]
    const [metadata, assetContexts] = hyperliquidData;
    const hyperliquidRates = metadata.universe.map((asset, index) => {
      const assetData = assetContexts[index];
      // 將資金費率轉換為百分比並保留4位小數
      const rate = (parseFloat(assetData.funding) * 100).toFixed(4);
      return {
        symbol: asset.name,
        exchange: 'HyperLiquid',
        currentRate: rate
      };
    });

    // 處理 Bybit 數據
    const bybitRates = bybitRatesData.result.list
      .filter(item => item.symbol.endsWith('USDT') && item.fundingRate)
      .map(item => {
        try {
          const interval = bybitIntervals[item.symbol] || 8; // 使用合約信息中的結算週期
          
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Bybit',
            currentRate: (parseFloat(item.fundingRate) * 100).toFixed(4),
            isSpecialInterval: interval !== 8,  // 如果不是8小時就標記
            settlementInterval: interval  // 使用實際的結算間隔
          };
        } catch (error) {
          console.error('Bybit data processing error:', error, item);
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Bybit',
            currentRate: (parseFloat(item.fundingRate) * 100).toFixed(4)
          };
        }
      });

    // 處理 Bitget 數據
    const bitgetRates = (bitgetRatesData.data || [])
      .filter(item => item.symbol && item.fundingRate)
      .map(item => {
        try {
          const interval = bitgetIntervals[item.symbol] || 8; // 使用合約信息中的結算週期
          
          return {
            symbol: item.symbol.replace('USDT', ''),
            exchange: 'Bitget',
            currentRate: (parseFloat(item.fundingRate) * 100).toFixed(4),
            isSpecialInterval: interval !== 8,  // 如果不是8小時就標記
            settlementInterval: interval  // 使用實際的結算間隔
          };
        } catch (error) {
          console.error('Bitget data processing error:', error, item);
          return null;
        }
      })
      .filter(item => item !== null);

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
            currentRate: (fundingRate * 100).toFixed(4),
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

    // 添加更詳細的調試日誌
    console.log('OKX Debug:', {
      contractsCount: okxUsdtContracts.length,
      ratesCount: okxFundingRatesData.length,
      processedCount: okxRates.length,
      sampleContract: okxUsdtContracts[0],
      sampleRate: okxFundingRatesData[0]?.data?.[0],
      sampleInterval: okxRates[0]?.settlementInterval
    });

    // 合併所有交易所的數據
    const allRates = [
      ...binanceRates,
      ...bybitRates,
      ...bitgetRates,
      ...okxRates,
      ...hyperliquidRates
    ].filter(item => {
      // 確保 item 和 currentRate 存在且為有效數值
      return item && 
        item.currentRate && 
        !isNaN(parseFloat(item.currentRate)) && 
        parseFloat(item.currentRate) !== 0;
    });

    // 返回成功響應
    res.status(200).json({
      success: true,
      data: allRates,
      // 添加調試信息，顯示各交易所的數據數量
      debug: {
        bitgetCount: bitgetRates.length,
        binanceCount: binanceRates.length,
        bybitCount: bybitRates.length,
        okxCount: okxRates.length,
        hyperliquidCount: hyperliquidRates.length
      }
    });
  } catch (error) {
    // 錯誤處理
    console.error('API Error:', error);
    res.status(500).json({ error: '獲取資料失敗', details: error.message });
  }
}