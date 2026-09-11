// Cloudflare Pages Function —— 大模型转发代理
// 路径：functions/api/[[path]].js  →  自动处理网站所有 /api/* 请求
// 密钥存放在 Pages 项目环境变量 API_KEY 中（设置 → 环境变量 → 加密）
// 用法：网页请求 /api/chat/completions → 转发到阿里云 MaaS 同路径

const UPSTREAM = "https://ws-m29xor7tp236yo4w.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

async function forward(request, env) {
  if (!env.API_KEY) {
    return new Response(JSON.stringify({ error: { message: "Worker 未配置 API_KEY 环境变量" } }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } });
  }
  const url = new URL(request.url);
  // /api/xxx → 上游 /v1/xxx（去掉 /api 前缀，拼到上游 /v1 之后）
  const target = UPSTREAM.replace(/\/+$/, "") + url.pathname.replace(/^\/api/, "") + url.search;

  const headers = new Headers();
  headers.set("Content-Type", request.headers.get("Content-Type") || "application/json");
  headers.set("Authorization", "Bearer " + env.API_KEY);

  const upstreamResp = await fetch(target, {
    method: request.method,
    headers: headers,
    body: (request.method === "GET" || request.method === "HEAD") ? undefined : request.body,
  });

  // 流式透传（SSE 逐字输出）
  const resp = new Response(upstreamResp.body, upstreamResp);
  for (const [k, v] of Object.entries(CORS)) resp.headers.set(k, v);
  resp.headers.set("Content-Type", upstreamResp.headers.get("Content-Type") || "application/json");
  resp.headers.delete("Content-Length");
  return resp;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  try {
    return await forward(request, env);
  } catch (e) {
    return new Response(JSON.stringify({ error: { message: "代理转发失败: " + e.message } }),
      { status: 502, headers: { "Content-Type": "application/json", ...CORS } });
  }
}
