import React, { useEffect, useRef, memo } from 'react';

function TradingViewWidget({ symbol }) {
  const container = useRef();

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = `
      {
        "autosize": true,
        "symbol": "BINANCE:${symbol}USDT.P",
        "interval": "60",
        "timezone": "Asia/Taipei",
        "theme": "light",
        "style": "1",
        "locale": "zh_TW",
        "enable_publishing": false,
        "hide_top_toolbar": false,
        "hide_legend": true,
        "save_image": false,
        "container_id": "tradingview_${symbol}"
      }`;
    container.current.appendChild(script);

    return () => {
      if (container.current) {
        container.current.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container" ref={container}>
      <div id={`tradingview_${symbol}`} style={{ height: "400px" }} />
    </div>
  );
}

export default memo(TradingViewWidget); 