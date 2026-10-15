# @standhigher/shopify-extension-kit

为 Shopify App Extensions 提供轻量、无运行时第三方依赖的基础能力。V0.1 只提供 `core` HTTP Client，不包含 Sidekick 或 Checkout 的具体 Runtime Adapter。

## 安装

```bash
npm install @standhigher/shopify-extension-kit
```

## 基本用法

```ts
import {
  createExtensionClient,
  type ExtensionRuntime,
} from '@standhigher/shopify-extension-kit/core';

const runtime: ExtensionRuntime = {
  async getAuthHeaders() {
    const token = await getTokenFromYourExtension();
    return { Authorization: `Bearer ${token}` };
  },
};

const client = createExtensionClient({
  baseUrl: 'https://api.example.com',
  runtime,
  timeoutMs: 5000,
});

interface Order {
  id: string;
  status: string;
}

const order = await client.get<Order>('/orders/123');
await client.post('/orders', { orderId: order.id });
await client.put(`/orders/${order.id}`, { status: 'updated' });
await client.delete<void>(`/orders/${order.id}`);
```

`getTokenFromYourExtension()` 由 Sidekick 或 Checkout Adapter 提供，core 不负责获取 Shopify Session Token。

## Runtime

Runtime 只需要实现可选的认证 Header 方法。返回值可以是同步对象或 Promise：

```ts
const runtime: ExtensionRuntime = {
  getAuthHeaders: () => ({ Authorization: 'Bearer token' }),
};
```

Runtime Header 会覆盖同名的普通业务 Header。每个请求自动带有唯一的 `X-Request-ID`。

## 请求配置

```ts
const client = createExtensionClient({
  baseUrl: 'https://api.example.com',
  headers: { 'X-App-Version': '0.1.0' },
  timeoutMs: 5000,
});

await client.get('/orders', {
  headers: { 'X-Feature': 'orders' },
  timeoutMs: 2000,
  signal: controller.signal,
});
```

POST 和 PUT 的 body 会自动序列化为 JSON，并在未提供时设置 `Content-Type: application/json`。也可以省略 `baseUrl`，直接使用相对路径。

## 响应和错误

成功响应需要符合后端协议：

```json
{
  "code": "SUCCESS",
  "message": "success",
  "traceId": "trace_123",
  "data": {}
}
```

成功时返回 `data`；204 或空成功响应返回 `undefined`。失败时抛出 `ExtensionError`，可读取：

- `code`: `NETWORK_ERROR`、`TIMEOUT`、`AUTH_ERROR`、`HTTP_ERROR`、`PARSE_ERROR`、`ABORTED` 或后端业务码
- `status`: HTTP 状态码（如果有）
- `requestId`: 本次请求 ID
- `traceId`: 后端返回的链路 ID（如果有）
- `businessCode`: HTTP 非 2xx 响应中的原始业务码（如果有）

## 开发

```bash
npm run typecheck
npm test
npm run build
npm run pack:dry
```

V0.1 不包含自动重试、中间件、Telemetry、GraphQL、Storage 或具体 Extension Runtime。
