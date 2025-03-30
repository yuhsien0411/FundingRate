export default async function handler(req, res) {
  const { symbol } = req.query;

  if (!symbol) {
    return res.status(400).json({
      success: false,
      error: '缺少 symbol 參數'
    });
  }

  try {
    const response = await fetch(
      `https://api.gateio.ws/api/v4/futures/usdt/contracts/${symbol}_USDT`,
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Gate.io API 返回錯誤: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.funding_rate) {
      const rate = parseFloat(data.funding_rate);
      if (!isNaN(rate)) {
        return res.status(200).json({
          success: true,
          rate: (rate * 100).toFixed(4)
        });
      }
    }

    return res.status(200).json({
      success: false,
      error: '無法獲取有效的資金費率'
    });

  } catch (error) {
    console.error('Gate.io API 錯誤:', error);
    return res.status(500).json({
      success: false,
      error: '獲取 Gate.io 資金費率失敗'
    });
  }
} 