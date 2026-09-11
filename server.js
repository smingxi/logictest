/* ============================================================
   逻辑铸基 · 本地代理服务器（零依赖，Node 18+）
   作用：
   1. 在 http://localhost:8787 提供网页服务
   2. 将浏览器的 /v1/* 请求转发到大模型 API，并在服务端注入密钥
   —— 密钥只保存在本文件中，index.html 内不含密钥，可放心分享
   ============================================================ */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

/* ---------------- 配置区：密钥只填在这里 ---------------- */
const CONFIG = {
  port: 8787,
  upstream: "https://ws-m29xor7tp236yo4w.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
  apiKey: "sk-ws-H.PDXREIH.S3XY.MEUCIB48-h3b1Uu7lMHBtovzfjdEMAdX9yCHyLdLPQDIqyBUAiEAyWrUlgbO5XiRvjtTsRFhKh882vvZhYdlvn6u8-YL7ZU"
};
/* ------------------------------------------------------- */

const INDEX_HTML = path.join(__dirname, "index.html");

function forward(req, res) {
  /* 浏览器请求 /v1/xxx -> 上游为 upstream(已含 /v1) + 去掉前缀后的路径 */
  const target = CONFIG.upstream.replace(/\/+$/, "") + req.url.replace(/^\/v1/, "");
  const headers = { "Content-Type": req.headers["content-type"] || "application/json" };
  headers["Authorization"] = "Bearer " + CONFIG.apiKey;

  const proxyReq = https.request(target, {
    method: req.method,
    headers: headers
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, {
      "Content-Type": proxyRes.headers["content-type"] || "application/json",
      "Cache-Control": "no-cache"
    });
    proxyRes.pipe(res); /* 流式透传（SSE 逐字输出） */
  });

  proxyReq.on("error", (e) => {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: { message: "代理无法连接上游 API: " + e.message } }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/v1/")) {
    return forward(req, res);
  }
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return fs.createReadStream(INDEX_HTML).pipe(res);
  }
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not Found");
});

server.listen(CONFIG.port, () => {
  console.log("==============================================");
  console.log("  逻辑铸基 · 就业顾问 服务已启动");
  console.log("  请在浏览器打开:  http://localhost:" + CONFIG.port);
  console.log("  （密钥仅保存在本文件中，请勿外传本文件）");
  console.log("  按 Ctrl+C 停止服务");
  console.log("==============================================");
});
