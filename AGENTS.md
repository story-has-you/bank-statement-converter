# 页面组件拆分

- 页面按内聚的最小功能区域拆分；`page.tsx` 只负责布局与组件编排，不放业务文案、状态、判断或事件处理。
- 页眉、页脚、标题与说明等区域由各自组件承载；相关标题合成一个区域，不按行数或单个标签机械拆分。
- 交互状态放在最近的客户端组件中，静态区域保持服务端组件。

# 国际化

- 今后开发或修改功能和页面时，所有面向用户的文案都使用 `next-intl` 国际化，包括可见文字、提示、错误信息、无障碍标签和页面 metadata。
- 中文文案统一写入 `messages/zh-CN.json`，组件和业务代码中不要硬编码面向用户的中文文案。

# Git 工作树

- 新建工作树默认放在主仓库根目录的 `worktrees/<名称>/`，创建前确认 `/worktrees/` 已被 Git 忽略；已处于工作树时复用当前工作区。
- 原生工作树工具无法指定该目录时，使用 `git worktree add`。
- 新建工作树后、安装依赖和运行检查前，将主仓库根目录的 `.env.local` 复制到新工作树根目录；保持 Git 忽略，不输出文件内容。
- 工作树首次启动前，安装根目录 pnpm 依赖，并在 `services/parser/` 创建独立 `.venv`，执行 `.venv/bin/python -m pip install -r requirements.lock -e .` 安装解析依赖。

# 其他说明
- 服务都会启动在 3000 端口，Python 服务也会自动在 8000 端口，不需要启动新的服务。
- Supabase 操作使用 CLI：优先使用 `supabase`，未全局安装时使用 `npx supabase`；执行前通过 `--help` 确认命令和参数。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues and specs live in GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five canonical triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo; use the root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.
