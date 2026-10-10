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
