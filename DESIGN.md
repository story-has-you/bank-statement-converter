---
name: "StatementXL"
description: "以现代年报的排版与账簿细线承载可核对的银行流水转换。"
colors:
  background: "#ffffff"
  foreground: "#272c32"
  card: "#ffffff"
  popover: "#ffffff"
  primary: "#8e3438"
  primary-foreground: "#ffffff"
  secondary: "#f8efd9"
  secondary-foreground: "#755116"
  muted: "#f5f4f1"
  muted-foreground: "#64686b"
  accent: "#f1e8e7"
  accent-foreground: "#7e2d32"
  destructive: "#b42330"
  border: "#dadbd7"
  input: "#b4b3af"
  ring: "#8e3438"
  dark-background: "#1e2023"
  dark-foreground: "#eeece8"
  dark-card: "#242629"
  dark-popover: "#292b2e"
  dark-primary: "#e4a29e"
  dark-primary-foreground: "#2d181b"
  dark-secondary: "#40341f"
  dark-secondary-foreground: "#e9cc91"
  dark-muted: "#2b2d30"
  dark-muted-foreground: "#b5b4b1"
  dark-accent: "#433035"
  dark-accent-foreground: "#edb8b4"
  dark-destructive: "#f29c9c"
  dark-border: "#45474a"
  dark-input: "#747477"
  dark-ring: "#e4a29e"
typography:
  display:
    fontFamily: 'Newsreader, "Noto Serif SC", serif'
    fontSize: "clamp(2.25rem, 4.2vw, 3.75rem)"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  headline:
    fontFamily: 'Newsreader, "Noto Serif SC", serif'
    fontSize: "2.25rem"
    fontWeight: 500
    lineHeight: "2.5rem"
  title:
    fontFamily: 'Newsreader, "Noto Serif SC", serif'
    fontSize: "1.5rem"
    fontWeight: 500
    lineHeight: "2rem"
  body:
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5rem"
  label:
    fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  sm: "0.15rem"
  md: "0.2rem"
  lg: "0.25rem"
spacing:
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
  "12": "3rem"
  "16": "4rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  button-primary-hover:
    backgroundColor: "color-mix(in oklab, var(--primary) 80%, transparent)"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  button-destructive:
    backgroundColor: "color-mix(in oklab, var(--destructive) 10%, transparent)"
    textColor: "{colors.destructive}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "0 1rem"
    height: "2.5rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
  badge:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "0.125rem 0.5rem"
    height: "1.25rem"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "1rem 0"
  navigation:
    textColor: "{colors.muted-foreground}"
  upload-dropzone:
    backgroundColor: "color-mix(in oklab, var(--muted) 60%, transparent)"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "1.25rem 1rem"
---

# Design System: StatementXL

## Overview

**Creative North Star: "The Modern Annual Report / 现代年报"**

像一份可阅读、可核对的现代年报：白色文档地承载石墨文字，低饱和酒红只在操作与交互提示中发声。衬线标题负责节奏，中性无衬线负责说明与控制，细线把内容组织成连续的行列。

信息密度来自共同对齐和清楚分组。首页与结果工作区以通栏表格、连续分隔和紧凑操作区呈现内容，避免重复卡片堆叠、零散留白与通用模板配色。现有 StatementXL 标识保留；风险和来源始终清楚可见。

**Key Characteristics:**

- 白色纸面、石墨文字、克制的酒红操作色。
- 衬线标题配中性无衬线控制与正文。
- 连续细线、对齐行列与可横向滚动的账簿。
- 浅色与深色共用语义角色，小圆角保持精确感。

## Colors

前置 token 是实际 `globals.css` 的规范色值；同名语义角色的深色值以 `dark-` 前缀记录。组件继续引用运行时 CSS 变量，以便主题切换。

### Primary

- **Muted Oxblood / 克制酒红**（`primary`）：主要转换、下载与返回操作，以及链接、上传交互和焦点。
- **Oxblood Wash / 酒红浅底**（`accent` / `accent-foreground`）：次级交互表面的柔和反馈。

### Neutral

- **Document White / 文档白**（`background`、`card`、`popover`）：页面和内容底，浮层另按实际组件提供阴影。
- **Graphite Ink / 石墨墨色**（`foreground`）：正文、标题和主要规则线。
- **Warm Gray / 暖灰**（`muted` / `muted-foreground`）：表头、轻底色区域与次要说明。
- **Quiet Rules / 安静分隔线**（`border`）：连续分组线；输入控件使用较强的 `input` 边框。
- **Night Paper / 夜间纸面**（`dark-background`、`dark-card`、`dark-popover`）：深色分层表面，文字和操作色同步使用深色对应值。

暖金 `secondary` 与红色 `destructive` 为警告和错误语义，并非额外品牌主色。风险同时提供文字或图标，不能只靠底色。

**The Action Ink Rule.** 酒红服务于操作、链接与交互状态；警告使用独立的暖金语义，不把品牌色铺成大面积装饰底。

## Typography

**Display Font:** Newsreader，中文由 Noto Serif SC 承接，serif 回退。Noto Serif SC 加载 500、600 字重。

**Body Font:** Inter，中文回退 PingFang SC、Microsoft YaHei，最后 sans-serif。

**Label/Mono Font:** 标签沿用正文无衬线；项目另配置 Geist Mono 供代码样式使用，不用于替代财务表格的正文。

衬线让标题与关键文件名获得年报的阅读节奏；控制和明细保持清晰、平静。前置层级记录实际角色，不将每个一次性字号升格为新 token。

- **Display**：首页响应式主标题，使用前置 display 的 clamp、行高与紧字距。
- **Headline**：大屏章节标题与结果文件名；小屏常从 1.875rem 起，大屏使用前置 headline。
- **Title**：上传工作区、示例和实际结果表标题。
- **Body**：常见说明为前置 body；首页说明在 sm 起使用 1rem / 2rem 行高，默认 0.875rem / 1.75rem。
- **Label**：表头、额度、状态与辅助说明；普通辅助文本可为 400 字重。

**The Editorial Division Rule.** 衬线用于标题、价格与文件名；操作、说明、状态和数据保持无衬线，数字使用等宽数字特性。

## Layout

共享页眉与示例的内容宽度上限为 76rem；主体使用 80rem 容器并配两侧内边距，小屏 1.25rem，sm 起 2rem。首页大屏介绍与上传区的列比例为 `minmax(0,1fr) minmax(22rem,0.72fr)`，间距从 2.25rem 到 lg 的 4rem。功能与 FAQ 采用 0.7fr / 1.3fr 的连续分栏。

常用节奏基于 Tailwind 实际 0.25rem 步长；区块上下留白多为 3rem，sm 起 4rem，组内常用 0.75rem、1rem、1.5rem。保留段落和操作之间的关系，不机械把每一组包成容器。

sm 为 40rem、md 为 48rem、lg 为 64rem：手机纵向组织介绍与上传；页眉导航在 md 以下独立成行，可横向滚动；套餐在 lg 起为三列连续网格。实际结果表保持最小 80rem 宽度并横向滚动，状态列粘在左侧。合成示例的金额右对齐，表格和统计数字使用 tabular-nums。

## Elevation & Depth

主体是平面文档：用实线、表头浅底和语义底色分层，不为整页内容添加悬浮阴影。现有 Card 原语保留前景色 10% 的细 ring，用于确需独立容器的其他页面，不恢复首页卡片骨架。下拉菜单仍使用 Tailwind 的 md / lg 环境阴影；这是浮层层级，具体值见 sidecar。

**The Ruled Surface Rule.** 内容区通过分隔线与轻微底色建立层级；浮层才使用环境阴影，页面主体保持平面。

交互反馈主要是颜色变化：按钮 150ms、上传区 200ms、下拉开合 100ms。按压按钮可下移 1px。全局尊重 prefers-reduced-motion，将过渡与动画缩至 0.01ms，并关闭平滑滚动。

## Shapes

`--radius` 为 0.25rem；sm 与 md 分别取其 0.6 与 0.8 倍，lg 及更大的命名均保持基准值。按钮与标签使用 sm，输入和现有 Card 使用 lg；这是精确的小圆角，不是胶囊卡片语言。

连续内容区以顶部、底部或行间的 1px 实线组织，上传工作区顶部用 2px 操作色规则线。上传目标保留虚线边界，表达拖放可操作性；不把虚线扩展成普通内容容器装饰。

## Components

### Buttons

主要按钮为酒红底与反白文字，默认高 2.5rem、水平内边距 1rem、sm 圆角、0.875rem / 500。默认 hover 使用主色 80% 透明度；禁用改为 muted 底与 muted-foreground，保持可辨认。outline 是边框次级操作，ghost 是低权重动作，link 是文本操作；secondary 与 destructive 服务对应语义。小按钮高 1.75rem，大按钮高 2.75rem。

focus-visible 使用 ring 边框与 3px 半透明 ring；全局键盘焦点为 2px 轮廓、3px 偏移。无弹出菜单的按钮按下位移 1px。状态与尺寸沿用现有 Button API。

### Chips

Badge 默认为暖灰底、石墨字、细边框与 sm 圆角，高 1.25rem。警告使用 secondary，无法核对的行使用 outline 并显示相应文本和图标；有效行的中性 badge 不宣称人工核对准确。

### Cards / Containers

现有 Card 原语保留小圆角、card 语义底和 10% 前景 ring；默认上下内边距与内部水平内边距为 1rem，紧凑尺寸为 0.75rem。首页与转换主工作区采用连续规则线与网格，Card 不作为默认页面骨架。

### Inputs / Fields

现有 Input 高 2rem、水平内边距 0.625rem、垂直 0.25rem，透明底和 input 边框；手机文字 1rem，md 起 0.875rem。焦点为 ring 边框与 3px 半透明 ring；错误使用 destructive 边框与 ring，禁用使用 input 浅底及 50% 不透明度。深色默认底为 input 的 30%。

### Navigation

页眉使用石墨底线与中性品牌字；导航默认 muted-foreground，hover 变 foreground，无装饰性胶囊。小屏是 0.75rem 字号并独立一行，md 起为 0.875rem 的横向主行；语言、主题、账号操作沿用共享控件。

### Upload & Ledger

上传目标高至少 9rem，暖灰 60% 底与次要文字 60% 虚线边框；hover 改为主色边框与 5% 主色底，拖入状态为 10% 主色底。聚焦可见 2px 轮廓与 4px 偏移。文件选择后展示真实文件元数据与移除操作。

账簿使用暖灰表头、细行分隔与左右对齐；实际结果以原始数据、风险和来源页/行为主体，警告与失败行使用对应语义底色。保留可键盘聚焦的横向滚动区域，不通过缩小数据字号塞进手机。

## Do's and Don'ts

### Do:

- Do 用连续规则线与共同对齐组织信息，让表格、状态与来源容易逐项核对。
- Do 复用语义色、字体角色和小圆角；深色模式使用对应的 dark token。
- Do 保留键盘焦点、文本风险标识与横向滚动表格；所有产品文案通过 next-intl。

### Don't:

- Don't 将首页和转换工作区恢复为重复的圆角卡片堆叠。
- Don't 为装饰加入未经确认的渐变、纹理、硬阴影或无功能的留白。
- Don't 只用颜色区分风险，或把成功状态包装成准确率保证。

本记录依据 `src/app/globals.css`、locale 字体配置及首页、共享、转换与 UI 原语源码提取；产品事实以 PRODUCT.md 为准。sidecar 的 tonalRamp 是按格式要求合成的预览色阶，不是新增运行时 token，也不授权改变现有调色板。
