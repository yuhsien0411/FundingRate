// 基本的 Worker 處理程序
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

/**
 * 處理請求並回應 HTML
 * @param {Request} request
 */
async function handleRequest(request) {
  return new Response(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Funding Rate Monitor</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      margin: 0;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div id="root">
    <h1>Funding Rate Monitor</h1>
    <p>This page is being served by Cloudflare Workers.</p>
    <p>Please wait while we redirect you to the application...</p>
  </div>
  <script>
    window.location.href = 'https://fundingrate.peterlin.xyz/';
  </script>
</body>
</html>`, {
    headers: {
      'content-type': 'text/html;charset=UTF-8',
    },
  });
} 