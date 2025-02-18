# 加密貨幣資金費率監控

實時監控主要加密貨幣交易所的資金費率，幫助用戶找到最佳的交易機會。

## 最新更新 (v2.0.5)

### 新功能
- 優化 HyperLiquid 當前費率顯示
- 改進資金費率歷史詳情頁面的懸浮提示
- 優化數據顯示和排序邏輯
- 改進用戶界面交互體驗

### 改進
- 資金費率顯示優化
  - 修復 HyperLiquid 當前費率顯示問題
  - 優化懸浮提示框位置和樣式
  - 改進數據更新機制
  - 優化時間顯示格式
- 用戶界面優化
  - 改進表格樣式和響應式設計
  - 優化懸浮提示框視覺效果
  - 添加數據加載指示器
  - 改進錯誤處理和提示
- 數據處理優化
  - 改進數據驗證和過濾邏輯
  - 優化數據排序機制
  - 提升數據更新效率
  - 改進緩存處理
- 性能優化
  - 減少不必要的 API 請求
  - 優化數據處理效率
  - 改進內存使用
  - 提升頁面加載速度

### 支援的交易所
- Binance (8小時結算)
- Bybit (8小時結算)
- OKX (8小時結算)
- Bitget (8小時結算)
- HyperLiquid (1小時結算)

## 功能特點

- 實時資金費率監控
- 歷史資金費率查詢
- 多交易所數據比較
- 自適應圖表顯示
- 詳細費率記錄查看
- 支援移動端訪問
- 穩定的實時更新機制
- 智能數據驗證
- 優化的用戶界面

## 技術棧

- Next.js
- Chart.js
- Socket.IO
- REST APIs
- WebSocket
- Vercel 部署

## 使用說明

1. 主頁面顯示所有交易所的當前資金費率
2. 點擊幣種可查看詳細歷史數據
3. 支援按交易所篩選
4. 支援 24H/7D/30D 時間範圍切換
5. 滑鼠懸停可查看詳細費率信息
6. 資金費率實時自動更新
7. 支援數據導出和分析

## 更新日誌

### v2.0.5 (當前版本)
- 修復 HyperLiquid 當前費率顯示問題
- 優化懸浮提示框位置和樣式
- 改進數據更新機制
- 優化時間顯示格式

### v2.0.4
- 修復 Socket.IO 連接問題
- 優化 WebSocket 初始化流程
- 改進實時數據推送機制
- 添加連接自動重試功能
- 優化錯誤處理機制

### v2.0.3
- 更新 Bitget API 到 v2 版本
- 修復 Bitget USDT 永續合約數據獲取問題
- 優化 API 錯誤處理機制
- 改進數據驗證流程

### v2.0.2
- 改進 API 數據處理邏輯
- 優化錯誤處理機制
- 添加特殊幣種處理
- 改進數據驗證流程

### v2.0.1
- 優化圖表顯示效果
- 改進數據點大小和懸停效果
- 優化數據線連接邏輯
- 改進圖表可讀性

### v2.0.0
- 新增 HyperLiquid 交易所支援
- 添加歷史資金費率查詢功能
- 實現自動結算時間檢測
- 優化圖表顯示效果
- 添加詳細費率記錄查看

### v1.3.1
- 修復 HyperLiquid 1小時結算標準化顯示
- 優化費率排序邏輯，支持標準化後排序
- 改進按鈕樣式，固定寬度避免抖動
- 修復數據更新時的顯示問題

### v1.3.0
- 新增資金費率8小時標準化顯示功能
- 新增交易所顯示選擇功能
- 優化按鈕樣式和交互
- 改進交易所排序邏輯
- 修復數據更新時的顯示問題

### v1.2.0
- 新增 OKX 交易所支持
- 新增結算週期顯示切換功能（星號/小時）
- 優化結算週期檢測邏輯
- 改進 UI/UX 設計
- 修復已知問題

### v1.1.0
- 添加深色模式支持
- 優化數據更新機制
- 添加更新狀態指示器
- 改進排序功能
- 修復顯示問題

### v1.0.0
- 初始版本發布
- 基礎功能實現
- 多交易所支持
- UI/UX 優化

## 開發計劃

- [ ] 添加更多交易所支援
- [ ] 實現費率提醒功能
- [ ] 添加用戶自定義設置
- [ ] 支援更多時間週期顯示
- [ ] 添加數據分析工具
- [ ] 優化移動端體驗
- [ ] 添加暗色主題支持
- [ ] 實現數據導出功能

## 部署

項目使用 Vercel 部署，支援自動化部署流程。

## 貢獻

歡迎提交 Issue 和 Pull Request。

## 許可證

MIT License


