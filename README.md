# 永續合約資金費率比較

一個即時比較各大交易所永續合約資金費率的工具。

## 功能特點

### 已完成功能
- ✅ 支持多個主流交易所
  - Binance
  - Bybit
  - Bitget
  - OKX
  - HyperLiquid
- ✅ 資金費率顯示
  - 即時更新（30秒自動刷新）
  - 顯示百分比
  - 支持正負值
  - 支持8小時標準化顯示
- ✅ 特殊結算週期標記
  - 支持星號(*)或小時(4H)顯示模式
  - 懸停顯示具體結算時間
  - 自動檢測非標準結算週期
  - 可轉換為8小時等值費率
- ✅ 排序功能
  - 按幣種名稱排序
  - 按資金費率排序（支持標準化後排序）
  - 支持升序/降序
- ✅ 介面優化
  - 深色/淺色模式切換
  - 響應式設計
  - 更新狀態指示
  - 標題置中顯示
  - 控制按鈕優化
  - 交易所顯示選擇

### 開發中功能
- 🚧 歷史資金費率查詢
- 🚧 費率異常提醒
- 🚧 自選幣種關注
- 🚧 數據導出功能

### 計劃功能
- 📝 更多交易所支持
- 📝 圖表分析功能
- 📝 API 文檔
- 📝 移動端優化

## 技術棧
- Next.js
- React
- JavaScript/CSS
- RESTful APIs

## 更新日誌

### v1.3.1 (當前版本)
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

## 使用說明

1. 安裝依賴
```bash
npm install
```

2. 運行開發服務器
```bash
npm run dev
```

3. 訪問 http://localhost:3000

## 貢獻指南

歡迎提交 Issue 和 Pull Request

## 許可證

MIT License


