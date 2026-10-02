# 页面组件拆分

- 页面按内聚的最小功能区域拆分；`page.tsx` 只负责布局与组件编排，不放业务文案、状态、判断或事件处理。
- 页眉、页脚、标题与说明等区域由各自组件承载；相关标题合成一个区域，不按行数或单个标签机械拆分。
- 交互状态放在最近的客户端组件中，静态区域保持服务端组件。

# 国际化

- 今后开发或修改功能和页面时，所有面向用户的文案都使用 `next-intl` 国际化，包括可见文字、提示、错误信息、无障碍标签和页面 metadata。
- 中文文案统一写入 `messages/zh-CN.json`，组件和业务代码中不要硬编码面向用户的中文文案。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
