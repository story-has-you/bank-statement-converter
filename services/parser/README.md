# Python 解析服务

本目录是独立于仓库根目录 Next.js 应用的 Python 服务。当前只处理存在真实文字层的电子版 PDF，返回保留原始表头和单元格文本的 JSON，不使用 OCR、不生成 Excel，也不持久化 PDF 或解析结果。

使用 Python 3.14 或更新版本，在本目录创建虚拟环境、安装依赖：

```bash
python3.14 -m venv .venv
.venv/bin/python -m pip install -e .
```

日常开发在仓库根目录运行 `pnpm dev`，会自动启动本服务并加载根目录 `.env.local` 中的 `PARSER_SHARED_SECRET`。如需单独启动，在本目录设置与 Next.js 相同的共享密钥后运行 `.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`。

## HTTP 接口

`GET /health` 返回服务状态：

```json
{"status":"ok"}
```

`POST /parse` 接收一个名为 `file` 的 `multipart/form-data` PDF：

```bash
curl -s \
  -H "Authorization: Bearer $PARSER_SHARED_SECRET" \
  -F "file=@/path/to/statement.pdf" \
  http://127.0.0.1:8000/parse
```

所有环境的 `/parse` 都要求 `Authorization: Bearer <PARSER_SHARED_SECRET>`。单独本地启动时可以设置：

```bash
export PARSER_SHARED_SECRET=local-development-secret
```

`GET /health` 不需要认证，供 Cloudflare Container readiness 检查使用。容器部署文件位于本目录的 `Dockerfile`，生产监听端口为 `8080`。

服务的文件大小和页数上限统一配置在 [`app/conversion-limits.json`](app/conversion-limits.json)，当前为单文件 4 MB、50 页。Next.js 和 Python 读取同一份配置，修改后需同步发布两个服务；Python 进程重启后加载新值。`pageCount` 始终是原始 PDF 页数；相邻且表头兼容的表格可以合并为一个逻辑表，表格范围和 `rows[].source.page` 保留原始页码，方便核对。响应中的 `tables[].columns` 保留表头顺序，`rows[].values` 保留原始单元格文本，并提供原始页码和行号。部分行无法对齐时仍返回已识别数据，并将结果标记为 `partial`。

解析表格前会根据文字层中的字符样式、相对字号、旋转角度和页面覆盖范围识别重复覆盖文字，并过滤候选水印字符；识别不依赖固定银行名称、水印文案或固定坐标。图片型水印没有文字层，不会被当作流水文字参与表格解析。

扫描图片 PDF、密码保护 PDF、无可用表格的 PDF 会返回带有 `code` 和 `message` 的 JSON 错误。当前没有绑定具体银行，实际支持范围需要使用脱敏电子版样本逐家验收。

## 已验证的公开样本

- [Carson Bank Sample Statement](https://www.carsonbank.com/wp-content/uploads/2021/01/Sample-Statement.pdf)（美国）：6 页；第 1-2 页支票账户交易区提取为 47 行，保留 `Date`、`Description`、`Debits`、`Credits`、`Balance`，并合并换行的交易摘要。支票清单、每日余额汇总及授信页不作为同一交易表返回。
- [BHW Jahreskontoauszüge 2024](https://www.bhw.de/dam/bhwde/pdf/Jahreskontoauszuege_koop_2024.pdf)（德国）：公开说明材料的第 12 页包含独立的模拟账单；单独解析该页得到 30 行，保留 `Wertstellung`、`Jahreskontoauszug 2024`、`Lastschrift in €`、`Gutschrift in €`。整份 PDF 是多账户示例和说明材料，不应当当作一份个人账单。

这些结果只证明所列电子版样本及对应版式通过了人工核对，不代表支持上述银行的所有账单版本或其他国家的任意账单。
