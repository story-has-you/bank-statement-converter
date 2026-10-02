# Python 解析服务

本目录是独立于仓库根目录 Next.js 应用的 Python 服务。HTTP 入口位于 `app/main.py`；转换流程、OCR、银行版式解析和 Excel 导出分别放在同目录的对应模块中。

使用 Python 3.14 或更新版本，在本目录创建虚拟环境、安装依赖并启动：

```bash
python3.14 -m venv .venv
.venv/bin/python -m pip install -e .
.venv/bin/python -m uvicorn app.main:app --reload
```

目前只提供 `GET /health`。PDF 转换接口、OCR 引擎和 Next.js 调用方式将在实现转换功能时确定。
