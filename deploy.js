// 直接部署腳本
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('開始自定義部署流程...');

// 檢查 worker.js 文件是否存在
if (!fs.existsSync(path.join(__dirname, 'worker.js'))) {
  console.error('錯誤: worker.js 文件不存在!');
  process.exit(1);
}

// 執行部署命令
try {
  console.log('開始部署 worker.js...');
  
  // 使用 wrangler CLI 進行部署
  execSync('npx wrangler deploy worker.js', { 
    stdio: 'inherit'
  });
  
  console.log('部署完成!');
} catch (error) {
  console.error('部署過程中出錯:', error.message);
  process.exit(1);
} 