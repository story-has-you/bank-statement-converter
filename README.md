This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

银行对账单 PDF 解析与导出工具。内部文档保存在本地 `docs/` 目录，不纳入版本控制。

## Getting Started

```bash
pnpm install
pnpm dev
```

开发和构建命令自动从锁定版本的 `pdfjs-dist` 准备 Worker、CMaps、字体和 WASM 静态资源，不使用 CDN。开发服务只需 Next.js，默认端口 3000。

打开 [http://localhost:3000/zh-CN](http://localhost:3000/zh-CN) 使用中文页面。

选择文件后本地读取页数，通过 `/api/convert/quota` 查询额度，不上传 PDF、不扣额度。默认常规解析在浏览器内执行，生成可用结果后只向 `POST /api/convert/quota` 提交 `{ pageCount }` 扣额，成功后开放下载。服务端不接收或核实 PDF 与流水内容，页数采用客户端报告值；修改客户端可绕过此计费边界。额度接口保留正整数及现有身份、周期、余额约束，扣额失败不交付最终结果。

Professional 和 Enterprise 可在转换前主动选择 AI。只有 AI 模式通过 `/api/convert` 上传原始 PDF，并由服务端复核使用资格；常规失败或部分成功均不自动请求 AI。

当前标签页的会话存储临时保存文件名、最终解析结果和商户归一化映射，供预览、刷新恢复和下载；重新转换或清理结果时一并清除，不跨文件复用。PDF、解析结果和所有导出文件不写入数据库、对象存储或持久化文件历史。multipart 请求解析可能短暂使用内存或系统临时文件，处理结束后关闭并清理，不提供再次下载的文件。

## 结果下载格式

结果页保留“下载 Excel”按钮，按钮右侧的下拉箭头支持 CSV、JSON、Markdown、TSV 和 HTML。所有文件由浏览器根据本次最终解析结果生成，不增加解析请求或转换用量。

- Excel 沿用每个逻辑表一个工作表；CSV、TSV 每表一个文件，多表时文件名增加表序号，浏览器可能需要允许多个文件下载；页面同时提供逐表下载入口。
- CSV、TSV 采用 UTF-8 BOM，保留原始列、状态、核对提示、来源页码和行号，并附页面风险及表格提示列。空表若有风险，仅输出一行流水字段为空的提示记录。
- JSON 包含完整 `ParseResponse`，保留原始状态、风险代码及参数、表结构、摘要和来源信息；JSON 的键和代码不随界面语言变化。
- Markdown、HTML 各用一个文件包含全部逻辑表、页面风险及表格提示；HTML 可离线打开。

至少存在一行有效或带警告的交易且结果未失败时才开放下载。CSV、TSV 会给疑似公式文本添加单引号（`'`）前缀，覆盖列名、原始单元格、手动商户名和风险提示；单引号可能在电子表格中显示。检测时跳过前导空白、控制字符和不可见格式字符，识别 `=`、`+`、`-`、`@` 及对应全角字符；原文中的这些字符保持原样。纯 ASCII 有符号十进制金额（如 `-10.00`、`+.50`）不加前缀，`(10.00)` 也保持原样；其他负号开头的表达式、分组金额或带额外字符的值按文本保护。JSON 保留未转义的原始证据和手动商户名，XLSX 继续使用文本单元格保存公式形态原文。

CSV/TSV 防护已在 LibreOffice Calc 26.8 中验证，包含启用公式计算的导入方式。CSV 可直接打开；TSV 请在“文本导入”中选择制表符分隔、双引号文本分隔符，当前测试版本自动打开 TSV 时未正确识别分隔符。其他软件建议使用 Excel（`.xlsx`）；电子表格重新保存 CSV/TSV 可能移除防护前缀，再次打开前应重新核对。CSV/TSV 的普通文本仍可能被软件自动识别为数字或日期。可复现的验证命令、确切版本与显示结果见 [`tests/README.md`](tests/README.md)。

结果页支持按风险筛选预览，并在本次文件内手动选择名称或描述列、跨表确认商户别名。归一化仅按原始文本精确分组，不推断商户身份，也不额外调用模型；原文、来源和提取风险保持不变。确认名称后，六种导出格式都带有标准商户名及归一化状态，JSON 字段为 `merchantName` 和 `merchantNormalizationStatus`。风险筛选不改变导出的完整交易范围。

## 套餐与额度配置

在 [`src/config/plans.ts`](src/config/plans.ts) 统一调整套餐规则：

- `freeQuotaConfig`：匿名与登录免费用户的每日页数，当前分别为 1 页和 5 页，按 UTC 日重置。
- `subscriptionConfig`：各套餐的 `monthlyPrice`（美元月费）、`pages`（每个支付渠道计费周期的额度）和 `aiParsing`（是否允许用户主动选择 AI 解析）。当前 Standard 为 $9.90 / 500 页，Professional 为 $49.90 / 1,000 页，Enterprise 为 $79.90 / 2,000 页。

首页、结构化数据、GEO 文档、条款、账户额度和转换接口都读取这些配置。服务端根据有效订阅选择套餐上限，转换前检查剩余额度，解析完成后检查 PDF 页数，现有 CAS 扣减使用同一上限；订阅额度替代免费额度。调整页数不重置当前已用页数，已有有效订阅也会按新上限计算剩余额度。

订阅已接入 Creem、PayPal 和 Waffo，可用渠道以购买入口和环境配置为准。三档套餐均按月自动续费；Waffo 展示税前价，税费和最终总额以结账页为准。取消自动续费后，已付权益保留至确认的账期结束。订阅购买及续费不支持退款，适用法律另有强制规定的除外。

这些是代码配置，修改后需要重新发布才能在已部署环境生效。修改 `monthlyPrice` 不会自动修改渠道的实际扣款金额；若今后改价，需要同步调整所有已启用渠道的产品或计划价格及其环境变量映射，付款校验也使用该月价。仅修改页数额度不需要调整渠道产品价格或 ID。部署后需分别验证真实付款、权益入库与运行结果。

## 单文件转换限制

在 [`src/config/conversion.ts`](src/config/conversion.ts) 统一调整 `megabytes` 和 `pages`，当前为 4 MB、50 页。客户端常规解析、AI 上传校验、Qwen 返回页数检查、预览校验和国际化说明共用配置。解析结果的 4 MB 上限独立于文件大小。

## 订阅配置

订阅支持 Creem、PayPal 和 Waffo 托管结账。服务端环境变量见本文的 [Vercel Next.js 配置](#vercel-nextjs)，各渠道需配置自己的凭据、产品及 Webhook。Waffo 价格为税前价，适用税费在结账时计算。

`CREEM_PAYMENT_ENABLED` 控制是否接受新建支付：未设置时默认开启；已设置时仅 `true` 开启（忽略首尾空白和大小写），其他值关闭。关闭时隐藏购买按钮，新建订阅返回 HTTP 503。开启但凭据或套餐配置不完整时显示禁用按钮，通过无障碍标签和 title 提示不可用原因。已有订阅的确认、回调与取消继续处理。

新建结账要求 Supabase 登录。只有验签并核实远端付款证据的回调才能写入订阅权益，付款返回页只确认已落库状态。公开 Webhook 地址为 `https://<your-domain>/api/billing/webhooks/creem`，本地联调需要公开 HTTPS 地址。

本地环境变量修改后需重启现有 Next.js 进程，Vercel 修改后需重新部署。

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

根目录 Next.js 可部署到 Vercel，不再需要 Python 服务或 Cloudflare Containers。现有线上容器、域名和密钥资源不由本次代码改动删除，切换部署后可由管理员另行清理。

[`.github/workflows/ci-parser.yml`](.github/workflows/ci-parser.yml) 在 `master` 推送及 Pull Request 时检查类型、既有集成检查、Lint 和构建，不再部署解析容器。

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
```

将自己的域名添加为 Vercel Production Domain。Supabase Auth 回调地址示例：

```text
https://example.com/api/auth/callback
```

Creem Webhook 地址示例：

```text
https://example.com/api/billing/webhooks/creem
```

不要把 `SUPABASE_SERVICE_ROLE_KEY`、`CREEM_API_KEY`、`CREEM_WEBHOOK_SECRET` 放入 `NEXT_PUBLIC_*` 变量或提交到 Git。

### 主动选择 Qwen 与流式预览

Professional 和 Enterprise 使用资格有效时可主动选择 AI 解析，包括尝试扫描件。有效计费周期内已取消续费的高阶订阅也保留此能力。默认常规解析不请求 AI，匿名、免费和 Standard 只可使用常规解析。

在根目录 `.env.local` 和相应的 Vercel 环境中配置仅服务端使用的 `QWEN_API_KEY`。模型 API 地址固定为 `https://maas.qianwenaiapi.com/compatible-mode/v1`；不使用 `DASHSCOPE_API_KEY` 或 `NEXT_PUBLIC_*` 密钥。缺少 Qwen 密钥只影响 AI，不影响浏览器常规解析。千问的 PDF 理解当前不支持 Responses API，因此采用 Chat Completions。PDF 在内存中编码为 Base64 发送至千问，不使用 Files API 或持久化存储。

浏览器通过 `Accept: text/event-stream` 请求 `/api/convert`（multipart 中显式携带 `method=llm`），开始转换后立即进入结果页，依次接收 `status`、`table`、`rows`，在完整 JSON 校验和请求开始时的剩余额度检查通过后接收 `complete`；流开始后的失败通过 `error` 事件传递。最终事件只包含版本、文件名、页数、统计和页面错误，不重复发送全部交易行。未请求 SSE 的调用方仍接收原有完整 `ParseResponse` JSON。

模型调用设置 `enable_thinking: false`、`include_tool_usage: true` 和 `stream_options.include_usage: true`。Qwen 的权威扣减页数来自 `usage.x_tools.pdf_page_parser.count`，覆盖模型内容中的 `pageCount`；缺失或无效页数、超过 50 页、无可核对交易、截断或无效 JSON 都不进入扣减。文件仍限制 4 MB，解析内容限制 4 MB。接口时限为 300 秒，Qwen 为 230 秒，SDK 不自动重试。

流式表格仅存在于当前页面内存，下载在最终校验和已知剩余额度检查通过后开放。额度通过 Next.js `after()` 在响应结束后异步扣减，执行现有 CAS 扣减；仅保留后台扣额拒绝和失败的错误码日志。并发快照可能过期，后台拒绝或失败不撤回已返回结果、不自动重试，且受接口最大时长与进程生命周期限制。完成后沿用浏览器会话结果交接，生成途中刷新、离开结果页或切换语言会中断，不恢复后台转换。成功扣减后若浏览器断开或无法保存结果，不增加自动回滚或重试机制。

用户主动选择 AI 后会将对账单发送至千问处理，适用千问的服务条款和隐私政策。本网站不持久化 PDF、Excel 或交易明细，也不对供应商的数据保存政策作额外承诺。真实千问效果及额度写入需要使用获准的脱敏样本单独验收。

## 迁移验证

`pnpm verify:pdfjs` 使用内存生成的 PDF 验证自动表格提取和异常场景；`pnpm verify:conversion` 使用隔离接口替身验证扣额及 AI 请求资格，不连接真实数据库或模型。两项均在 CI 执行，不新增单元测试。

可使用本地获准样本和已有 Python 对照 JSON 执行逐单元格比较：

```bash
pnpm verify:pdfjs /absolute/path/statement.pdf /absolute/path/python-baseline.json
```

此可选对照使用迁移时的 8 页、112 行样本；真实 PDF 和对照结果仅保存在忽略的本地目录中，不提交 Git。历史公开基准保留原解析器及测量时间，不代表 PDF.js 当前效果。
