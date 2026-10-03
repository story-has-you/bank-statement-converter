# Python 解析服务

本目录是独立于仓库根目录 Next.js 应用的 Python 服务。当前只处理存在真实文字层的电子版 PDF，返回保留原始表头和单元格文本的 JSON，不使用 OCR、不生成 Excel，也不持久化 PDF 或解析结果。

使用 Python 3.14 或更新版本，在本目录创建虚拟环境、安装依赖并启动：

```bash
python3.14 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/python -m uvicorn app.main:app --reload
```

## HTTP 接口

`GET /health` 返回服务状态：

```json
{"status":"ok"}
```

`POST /parse` 接收一个名为 `file` 的 `multipart/form-data` PDF：

```bash
curl -s \
  -F "file=@/path/to/statement.pdf" \
  http://127.0.0.1:8000/parse
```

服务限制单个文件不超过 20 MB、最多 50 页。响应中的 `tables[].columns` 保留 PDF 表头顺序，`rows[].values` 保留原始单元格文本，并提供原始页码和行号。部分行无法对齐时仍返回已识别数据，并将结果标记为 `partial`。

扫描图片 PDF、密码保护 PDF、无可用表格的 PDF 会返回带有 `code` 和 `message` 的 JSON 错误。当前没有绑定具体银行，实际支持范围需要使用脱敏电子版样本逐家验收。

## 已验证的公开样本

- [Carson Bank Sample Statement](https://www.carsonbank.com/wp-content/uploads/2021/01/Sample-Statement.pdf)（美国）：6 页；第 1-2 页支票账户交易区提取为 47 行，保留 `Date`、`Description`、`Debits`、`Credits`、`Balance`，并合并换行的交易摘要。支票清单、每日余额汇总及授信页不作为同一交易表返回。
- [BHW Jahreskontoauszüge 2024](https://www.bhw.de/dam/bhwde/pdf/Jahreskontoauszuege_koop_2024.pdf)（德国）：公开说明材料的第 12 页包含独立的模拟账单；单独解析该页得到 30 行，保留 `Wertstellung`、`Jahreskontoauszug 2024`、`Lastschrift in €`、`Gutschrift in €`。整份 PDF 是多账户示例和说明材料，不应当当作一份个人账单。

这些结果只证明所列电子版样本及对应版式通过了人工核对，不代表支持上述银行的所有账单版本或其他国家的任意账单。
