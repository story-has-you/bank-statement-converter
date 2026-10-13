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

转换结果只在当前标签页完成一次临时交接，并在结果页内存中预览；PDF、解析结果和所有导出文件不写入数据库、对象存储或持久化文件历史。multipart 请求解析可能短暂使用内存或系统临时文件，处理结束后关闭并清理，不提供再次下载的文件。

## 结果下载格式

结果页保留“下载 Excel”按钮，按钮右侧的下拉箭头支持 CSV、JSON、Markdown、TSV 和 HTML。所有文件由浏览器根据本次最终解析结果生成，不增加解析请求或转换用量。

- Excel 沿用每个逻辑表一个工作表；CSV、TSV 每表一个文件，多表时文件名增加表序号，浏览器可能需要允许多个文件下载；页面同时提供逐表下载入口。
- CSV、TSV 采用 UTF-8 BOM，保留原始列、状态、核对提示、来源页码和行号，并附页面风险及表格提示列。空表若有风险，仅输出一行流水字段为空的提示记录。
- JSON 包含完整 `ParseResponse`，保留原始状态、风险代码及参数、表结构、摘要和来源信息；JSON 的键和代码不随界面语言变化。
- Markdown、HTML 各用一个文件包含全部逻辑表、页面风险及表格提示；HTML 可离线打开。

至少存在一行有效或带警告的交易且结果未失败时才开放下载。导出保留原始单元格文本；用电子表格软件打开 CSV、TSV 时，软件可能自行将文本识别为数字或日期。

## 套餐与额度配置

在 [`src/config/plans.ts`](src/config/plans.ts) 统一调整套餐规则：

- `freeQuotaConfig`：匿名与登录免费用户的每日页数，当前分别为 1 页和 5 页，按 UTC 日重置。
- `subscriptionConfig`：各套餐的 `monthlyPrice`（美元月费）、`pages`（每个 Creem 计费周期的额度）和 `qwenFallback`（是否允许 Python 失败后回退到 Qwen）。当前 Standard 为 $19.90 / 500 页，Professional 为 $49.90 / 1,000 页，Enterprise 为 $79.90 / 2,000 页。

首页、结构化数据、GEO 文档、条款、账户额度和转换接口都读取这些配置。服务端根据有效订阅选择套餐上限，转换前检查剩余额度，解析完成后检查 PDF 页数，后台原子扣减 RPC 使用同一上限；订阅额度替代免费额度。调整页数不重置当前已用页数，已有有效订阅也会按新上限计算剩余额度。

这些是代码配置，修改后需要重新发布才能在已部署环境生效。修改 `monthlyPrice` 不会自动修改 Creem 的实际扣款金额；若今后改价，需要同步调整 Creem 产品价格及其环境变量映射，付款校验也使用该月价。仅修改页数额度不需要调整 Creem 产品价格或 ID。

## 单文件转换限制

在 [`services/parser/app/conversion-limits.json`](services/parser/app/conversion-limits.json) 统一调整 `megabytes`（单文件大小，按 1 MB = 1024 × 1024 字节校验）和 `pages`（原始 PDF 最大页数），当前为 4 MB、50 页。

Next.js 上传校验、Python 文件与页数校验、Qwen 返回页数检查、浏览器流式结果校验、上传提示和错误文案、GEO 说明都读取同一配置。JSON 随 Python 包和 Docker 的 `app` 目录发布；修改后需重新发布 Next.js 和 Python 服务，Python 进程重启后加载新值。解析响应的 4 MB 上限独立于上传文件大小，不随此配置变化。

## Creem 订阅配置

订阅使用 Creem 托管结账。服务端环境变量模板见 [`docs/creem-test.env.example`](docs/creem-test.env.example)，接口与付款验收说明见 [Creem 支付接入](docs/creem-billing.md)。

`CREEM_PAYMENT_ENABLED` 控制是否接受新建支付：未设置时默认开启；已设置时仅 `true` 开启（忽略首尾空白和大小写），其他值关闭。关闭时隐藏购买按钮，新建订阅返回 HTTP 503。开启但凭据或套餐配置不完整时显示禁用按钮，通过无障碍标签和 title 提示不可用原因。已有订阅的确认、回调与取消继续处理。

新建结账要求 Supabase 登录。只有验签并核实远端付款证据的回调才能写入订阅权益，付款返回页只确认已落库状态。公开 Webhook 地址为 `https://<your-domain>/api/billing/webhooks/creem`，本地联调需要公开 HTTPS 地址。

本地环境变量修改后需重启现有 Next.js 进程，Vercel 修改后需重新部署。发布前的数据库约束调整见 [计费切换与验收](docs/billing-provider-cutover.md)。

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
CREEM_PAYMENT_ENABLED=true
CREEM_API_KEY
CREEM_ENVIRONMENT=production
CREEM_PRODUCT_ID_STANDARD
CREEM_PRODUCT_ID_PROFESSIONAL
CREEM_PRODUCT_ID_ENTERPRISE
CREEM_WEBHOOK_SECRET
PARSER_SERVICE_URL=https://parser.bankstatementconverter.xyz
PARSER_SHARED_SECRET
```

将 `bankstatementconverter.xyz` 添加为 Vercel Production Domain。Supabase Auth 回调地址为：

```text
https://bankstatementconverter.xyz/api/auth/callback
```

Creem Webhook 地址为：

```text
https://bankstatementconverter.xyz/api/billing/webhooks/creem
```

不要把 `SUPABASE_SERVICE_ROLE_KEY`、`CREEM_API_KEY`、`CREEM_WEBHOOK_SECRET` 或 `PARSER_SHARED_SECRET` 放入 `NEXT_PUBLIC_*` 变量或提交到 Git。

### Qwen 自动回退与流式预览

Professional 和 Enterprise 使用资格有效时，转换优先调用 Python；Python 服务不可用或无法产出可核对交易时，Next.js 使用 `openai` 官方 SDK 的 Chat Completions 调用 `qwen3.8-flash`。有效计费周期内已取消续费的高阶订阅也保留此能力。扫描件可进入大模型回退，匿名、免费和 Standard 仍只支持文字型 PDF。Python 的可用部分结果直接返回，不触发二次解析。

在根目录 `.env.local` 和相应的 Vercel 环境中配置仅服务端使用的 `QWEN_API_KEY`。模型 API 地址固定为 `https://maas.qianwenaiapi.com/compatible-mode/v1`；不使用 `DASHSCOPE_API_KEY` 或 `NEXT_PUBLIC_*` 密钥。缺少 Qwen 密钥只影响回退，不影响 Python 正常转换。千问的 PDF 理解当前不支持 Responses API，因此采用 Chat Completions。PDF 在内存中编码为 Base64 发送至千问，不使用 Files API 或持久化存储。

浏览器通过 `Accept: text/event-stream` 请求 `/api/convert`，开始转换后立即进入结果页，依次接收 `status`、`table`、`rows`，在完整 JSON 校验和请求开始时的剩余额度检查通过后接收 `complete`；流开始后的失败通过 `error` 事件传递。最终事件只包含版本、文件名、页数、统计和页面错误，不重复发送全部交易行。未请求 SSE 的调用方仍接收原有完整 `ParseResponse` JSON。

模型调用设置 `enable_thinking: false`、`include_tool_usage: true` 和 `stream_options.include_usage: true`。Qwen 的权威扣减页数来自 `usage.x_tools.pdf_page_parser.count`，覆盖模型内容中的 `pageCount`；缺失或无效页数、超过 50 页、无可核对交易、截断或无效 JSON 都不进入扣减。文件仍限制 4 MB，解析内容限制 4 MB。接口时限为 300 秒，Python 为 55 秒，Qwen 为 230 秒，SDK 不自动重试。

流式表格仅存在于当前页面内存，下载在最终校验和已知剩余额度检查通过后开放。额度通过 Next.js `after()` 在响应结束后异步扣减，只调用一次原子 RPC；仅保留后台扣额拒绝和失败的错误码日志。并发快照可能过期，后台拒绝或失败不撤回已返回结果、不自动重试，且受接口最大时长与进程生命周期限制。完成后沿用浏览器会话结果交接，生成途中刷新、离开结果页或切换语言会中断，不恢复后台转换。成功扣减后若浏览器断开或无法保存结果，不增加自动回滚或重试机制。

高阶套餐回退会将对账单发送至千问处理，适用千问的服务条款和隐私政策。本网站不持久化 PDF、Excel 或交易明细，也不对供应商的数据保存政策作额外承诺。真实千问效果及额度写入需要使用获准的脱敏样本单独验收。
