# 高阶套餐采用千问回退及结果页流式预览

Professional 和 Enterprise 在有效权益周期内优先使用 Python；仅服务失败或没有可核对交易时，Next.js 回退至 `qwen3.8-flash`，并允许扫描件进入回退。Python 的可用部分结果直接保留。千问当前的 [PDF 理解文档](https://platform.qianwenai.com/docs/developer-guides/tool-calling/pdf-understanding)明确不支持 Responses API 传 PDF，因此使用 OpenAI 官方 SDK 的 Chat Completions；服务端密钥为 `QWEN_API_KEY`，PDF 以 Base64 在内存中传输，不使用上传文件存储。

模型的 JSON Object 输出经增量解析后，通过 SSE 发送已闭合并通过字段校验的表头与交易行；最终仍需完整契约校验，不能将流式预览视为转换成功。客户端转换状态放在首页与结果页共享的 Provider，支持开始后立即进入结果页；未请求 SSE 的调用方保留完整 JSON 接口。生成过程只保留在内存中，不增加后台任务、文件历史或断点续传。

模型生成的页数可能与实际解析用量不一致，因此最终页数和扣减以 `usage.x_tools.pdf_page_parser.count` 为准，并开启 `include_tool_usage`。权威页数缺失、超过 50 页、无可核对交易、无效或不完整 JSON 均不扣减；验证成功后只调用现有额度 RPC 一次，成功扣减才发送完成事件并开放下载。SDK 不自动重试，避免隐式重复模型调用。已成功扣减后的浏览器断开或存储失败不增加自动回滚机制。

回退会把 PDF 发送至千问处理，页面及隐私政策明确说明供应商及其处理条款。本网站维持不持久化 PDF、Excel 和交易明细的边界，不额外承诺供应商的保存政策或扫描件准确率。
