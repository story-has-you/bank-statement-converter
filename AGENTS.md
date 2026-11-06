# 页面组件拆分

- 页面按内聚的最小功能区域拆分；`page.tsx` 只负责布局与组件编排，不放业务文案、状态、判断或事件处理。
- 页眉、页脚、标题与说明等区域由各自组件承载；相关标题合成一个区域，不按行数或单个标签机械拆分。
- 交互状态放在最近的客户端组件中，静态区域保持服务端组件。

# 国际化

- 今后开发或修改功能和页面时，所有面向用户的文案都使用 `next-intl` 国际化，包括可见文字、提示、错误信息、无障碍标签和页面 metadata。
- 中文文案统一写入 `messages/zh-CN.json`，组件和业务代码中不要硬编码面向用户的中文文案。

# UI 修改与验证

- UI 修改完成后不需要由代理验证，由用户自行验证；除非用户明确要求，不主动运行浏览器检查、截图、测试、lint、类型检查或构建来验证 UI 改动。

# Git 工作树

- 新建工作树默认放在主仓库根目录的 `worktrees/<名称>/`，创建前确认 `/worktrees/` 已被 Git 忽略；已处于工作树时复用当前工作区。
- 原生工作树工具无法指定该目录时，使用 `git worktree add`。
- 新建工作树后、安装依赖和运行检查前，将主仓库根目录的 `.env.local` 复制到新工作树根目录；保持 Git 忽略，不输出文件内容。
- 工作树首次启动前安装根目录 pnpm 依赖；开发和构建命令会准备同版本 PDF.js 静态资源。

# 其他说明
- 开发调试默认使用专用本地 Supabase 实例 `bank-statement-converter`（`http://127.0.0.1:56321`），由 `/Users/fangxi/Independent.localized/docker/bank-statement-converter` 管理；项目 `.env.local` 只使用该实例的本地地址和密钥。未经用户明确要求，不关联或操作云端 Supabase。
- 在本项目目录使用 `supabase db push --dry-run` 预览迁移，再用 `supabase db push` 应用到专用本地实例；不要执行 `db reset` 或删除数据卷，启停统一使用上述实例目录的 `make start` / `make stop`。
- 复用已有 3000 端口的 Next.js 服务；常规解析在浏览器执行，AI 解析由 Next.js 服务端处理。
- Supabase 操作使用 CLI：优先使用 `supabase`，未全局安装时使用 `npx supabase`；执行前通过 `--help` 确认命令和参数。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
