This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

产品当前功能范围见 [产品边界](docs/product-boundary.md)。

## Getting Started

首次开发先安装 Python 解析服务依赖：

```bash
cd services/parser
python3.14 -m venv .venv
.venv/bin/python -m pip install -e .
cd ../..
```

```bash
pnpm install
pnpm dev --port 3000
```

在仓库根目录 `.env.local` 配置 `PARSER_SHARED_SECRET`，本地 `PARSER_SERVICE_URL` 使用 `http://127.0.0.1:8000`。`pnpm dev` 会自动加载根目录开发环境配置，启动 8000 端口的 Python 解析服务，确认服务和认证就绪后启动 3000 端口的 Next.js。已有可用的解析服务会直接复用；退出开发命令会关闭本次启动的两个服务。配置远程解析地址时只启动 Next.js。

打开 [http://localhost:3000/zh-CN](http://localhost:3000/zh-CN) 使用中文页面。

浏览器只请求 Next.js 的同源 `/api/convert`，Next.js 服务端再调用 Python 的 `http://127.0.0.1:8000/parse`，因此不需要为 Python 服务开放浏览器 CORS。默认解析地址可以通过仅服务端使用的 `PARSER_SERVICE_URL` 覆盖。

转换结果只在当前标签页完成一次临时交接，并在结果页内存中预览；PDF、解析结果和 Excel 不写入数据库、对象存储或持久化文件历史。multipart 请求解析可能短暂使用内存或系统临时文件，处理结束后关闭并清理，不提供再次下载的文件。

## PayPal Sandbox 订阅配置

会员方案使用 PayPal Sandbox 自动续费订阅。环境变量模板见
[`docs/paypal-sandbox.env.example`](docs/paypal-sandbox.env.example)。复制需要的配置到本地环境文件，并补充 PayPal Client ID、Secret 和 Supabase Service Role Key；Secret 和 Service Role Key 只能放在服务端环境变量中。

执行 Supabase migration 后，将 PayPal Sandbox Webhook 的公开地址配置为：

```text
https://<your-domain>/api/paypal/webhooks
```

本地开发需要使用 PayPal 可访问的 HTTPS 隧道。支付激活接口要求用户先完成 Supabase 登录，并会在服务端重新查询 PayPal 订阅后写入会员状态。

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production deployment

生产环境使用两个服务：根目录 Next.js 部署到 Vercel，`services/parser/` 的 Python 3.14 FastAPI 服务部署到 Cloudflare Containers。浏览器只请求 Next.js 的同源 API，Next.js 服务端再通过共享密钥调用 parser。

正式地址：

```text
https://bankstatementconverter.xyz
https://parser.bankstatementconverter.xyz
```

### Cloudflare parser

在 `services/parser` 目录执行：

```bash
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler secret put PARSER_SHARED_SECRET
pnpm exec wrangler deploy
```

`wrangler.jsonc` 已配置 `parser.bankstatementconverter.xyz` Custom Domain、Container 端口 `8080` 和 `/health` readiness 检查。部署前需要 Docker 可用；Cloudflare 会构建 `services/parser/Dockerfile`。

#### GitHub Actions 自动部署

仓库已配置 `.github/workflows/deploy-parser.yml`。向 `master` 推送提交后，GitHub Actions 会在 `services/parser` 目录执行 `wrangler deploy`，自动更新 Cloudflare Worker 和 Parser Container。工作流使用仓库 Secrets 中的以下配置：

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
```

`CLOUDFLARE_API_TOKEN` 需要具备目标 Cloudflare 账户的 Worker 部署权限。`PARSER_SHARED_SECRET` 不放入 GitHub Actions 配置；请先在 Cloudflare 中执行一次 `pnpm exec wrangler secret put PARSER_SHARED_SECRET`，后续自动部署会保留该 Worker Secret。

### Vercel Next.js

将仓库根目录连接到 Vercel，使用 `pnpm install --frozen-lockfile` 和 `pnpm build`。Production 环境需要配置：

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_PAYPAL_CLIENT_ID
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_ENVIRONMENT=sandbox
PAYPAL_PLAN_ID_STANDARD
PAYPAL_PLAN_ID_PROFESSIONAL
PAYPAL_PLAN_ID_ENTERPRISE
PAYPAL_WEBHOOK_ID
PARSER_SERVICE_URL=https://parser.bankstatementconverter.xyz
PARSER_SHARED_SECRET
```

将 `bankstatementconverter.xyz` 添加为 Vercel Production Domain。Supabase Auth 回调地址为：

```text
https://bankstatementconverter.xyz/api/auth/callback
```

PayPal Sandbox Webhook 地址为：

```text
https://bankstatementconverter.xyz/api/paypal/webhooks
```

不要把 `SUPABASE_SERVICE_ROLE_KEY`、`PAYPAL_CLIENT_SECRET` 或 `PARSER_SHARED_SECRET` 放入 `NEXT_PUBLIC_*` 变量或提交到 Git。

### Qwen 自动回退与流式预览

Professional 和 Enterprise 使用资格有效时，转换优先调用 Python；Python 服务不可用或无法产出可核对交易时，Next.js 使用 `openai` 官方 SDK 的 Chat Completions 调用 `qwen3.8-flash`。有效计费周期内已取消续费的高阶订阅也保留此能力。扫描件可进入大模型回退，匿名、免费和 Standard 仍只支持文字型 PDF。Python 的可用部分结果直接返回，不触发二次解析。

在根目录 `.env.local` 和相应的 Vercel 环境中配置仅服务端使用的 `QWEN_API_KEY`。模型 API 地址固定为 `https://maas.qianwenaiapi.com/compatible-mode/v1`；不使用 `DASHSCOPE_API_KEY` 或 `NEXT_PUBLIC_*` 密钥。缺少 Qwen 密钥只影响回退，不影响 Python 正常转换。千问的 PDF 理解当前不支持 Responses API，因此采用 Chat Completions。PDF 在内存中编码为 Base64 发送至千问，不使用 Files API 或持久化存储。

浏览器通过 `Accept: text/event-stream` 请求 `/api/convert`，开始转换后立即进入结果页，依次接收 `status`、`table`、`rows`，在完整 JSON 校验和额度扣减成功后接收 `complete`；流开始后的失败通过 `error` 事件传递。最终事件只包含版本、文件名、页数、统计和页面错误，不重复发送全部交易行。未请求 SSE 的调用方仍接收原有完整 `ParseResponse` JSON。

模型调用设置 `include_tool_usage: true` 和 `stream_options.include_usage: true`。Qwen 的权威扣减页数来自 `usage.x_tools.pdf_page_parser.count`，覆盖模型内容中的 `pageCount`；缺失或无效页数、超过 50 页、无可核对交易、截断或无效 JSON 都不进入扣减。文件仍限制 4 MB，解析内容限制 4 MB。接口时限为 300 秒，Python 为 55 秒，Qwen 为 230 秒，SDK 不自动重试。

流式表格仅存在于当前页面内存，下载在最终校验和额度扣减成功后开放。完成后沿用浏览器会话结果交接，生成途中刷新、离开结果页或切换语言会中断，不恢复后台转换。成功扣减后若浏览器断开或无法保存结果，不增加自动回滚或重试机制。

高阶套餐回退会将对账单发送至千问处理，适用千问的服务条款和隐私政策。本网站不持久化 PDF、Excel 或交易明细，也不对供应商的数据保存政策作额外承诺。真实千问效果及额度写入需要使用获准的脱敏样本单独验收。
