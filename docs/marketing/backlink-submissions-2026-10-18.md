# StatementXL 外链提交记录

日期：2026-10-18，Asia/Shanghai。产品官网：https://bankstatementconverter.xyz 。全部使用免费流程，未付款。本记录不重复将第三方清单中的 DR 数字作为实时核实值。

TinyLaunch 后台最终显示：若审核通过，将于 November 16, 2026 at midnight PT 上线；对应北京时间 **2026-11-16 16:00**。

## 当前结果

| 站点           | 实际完成状态                   | 结果、限制与后续步骤                                                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEV            | 已发布                         | [技术文章](https://dev.to/statementxl/bank-statement-pdf-parsing-make-each-exported-row-possible-to-check-53f7)。正文官网链接实测 `rel="noopener noreferrer"`，无 `nofollow`、`ugc`、`sponsored`。选择 Fully Autonomous 披露，并在正文说明产品关联和 AI 辅助。                                                  |
| Launching Next | 已提交，排队                   | [确认页](https://www.launchingnext.com/thanks/?i=162844)，编号 162844，`Submission Received` / `Status: In Queue (Estimated Wait: 4 Months)`。未购买 $99 加速；没有已上线外链证据。                                                                                                                             |
| PeerPush       | 已注册、已认领并加入免费队列   | [产品页](https://peerpush.com/p/statementxl)，队列 #6269，预计约 3 个月。页面明确说明排队期间不对社区、AI 助手和爬虫展示；尚不能作为已生效外链。旧 peerpush.net 已跳转 peerpush.com。                                                                                                                           |
| TinyLaunch     | 已完成免费排期，待审核         | 排期 2026-11-16，记录 #26058，[成功页](https://www.tinylaunch.com/dashboard/launches/26058/success)显示 `Launch Scheduled`、通常 24 小时内审核。未购买任何附加服务。当前免费方案明确要求排名前 3 且嵌入徽章，才提供高权重外链。                                                                                 |
| HackerNoon     | 已提交编辑审核                 | [稿件](https://app.hackernoon.com/drafts/6ad48a022dd1bbfb6dcab422)出现在 [投稿看板](https://app.hackernoon.com/writer/tracksubmissions) 的 `Stories in Editorial`，状态 `submitted`。正文、截图、说明、3 个标签、软件工程分类和 DEV 原始发布 URL 已填写；账号已标明代表品牌。尚未公开发布，最终链接属性待核实。 |
| Twelve Tools   | 产品资料已提交，回链验证未通过 | [当前步骤](https://twelve.tools/submit-your-tool?step=badge)。名称、描述、Accounting 分类、邮箱、自动官网截图和字母图标已保存。实际校验返回未检测到官网徽章或链接，须部署官网页脚链接后重新 Verify。                                                                                                            |
| Startup Fame   | 邮箱登录待继续                 | 已发起邮箱登录链接请求，当前受控浏览器未形成可用登录会话；不能算已提交。免费档要求首页徽章及人工审核。                                                                                                                                                                                                          |
| Fazier         | 按用户要求停在前置条件         | 已完成邮箱注册和登录，但没有提交产品。免费档现在要求 3 条有内容的产品评论、官网徽章、英文网站及官网 DR 大于 0。用户要求跳过评论前置流程，没有代发评论或虚假勾选条件。                                                                                                                                           |
| Tiny Startups  | 按用户要求跳过                 | 现流程强制公开收入状态，不能留空；没有申报收入，没有最终提交。                                                                                                                                                                                                                                                  |
| Microlaunch    | 未提交                         | 当前 New Launch 弹窗只显示 Pro Launch；Signup 仅提供 X/Google。没有找到清单描述中的邮箱免费提交流程，也未使用其他邮箱或购买套餐。                                                                                                                                                                               |

## 官网待发布改动

- `src/components/shared/home-footer.tsx`：加入 `https://twelve.tools` 普通 HTML 页脚链接，供站点验证；没有声称已经收录。
- 同一页脚加入 TinyLaunch Launching Soon 徽章，表示已排期而非已上线。资源保存在 `public/tinylaunch-launching-soon.svg`，基于 `https://tinylaunch.com/tinylaunch_badge_launching_soon.svg` 的官方图形重新排版为 250×54，与 Product Hunt 徽章比例一致。
- 后续按用户要求增加 Product Hunt 官方 Featured Badge，与 TinyLaunch 一并放在静态组件 `src/components/shared/footer-launch-links.tsx`，由 `HomeFooter` 引入。徽章和目标链接取自 [官方嵌入页](https://www.producthunt.com/products/statementxl/embed)，使用该次发布的 `post_id=1279950`，图片直接读取官方 SVG。
- 徽章区没有额外卡片边框，固定两列且等宽等高；窄屏同步缩小并保持同行。深色模式使用 Product Hunt 官方深色图片，TinyLaunch 黑白适配沿用现有 `.dark` 主题。已在现有本地服务核验桌面与 390px 窄屏的深浅色显示，图片加载正常且无横向溢出。
- 12 个语言文件新增 `HomeFooter.twelveTools`、`HomeFooter.tinyLaunchBadge`、`HomeFooter.productHuntBadge` 三个键；提交前须重新核对差异，不能混入其他功能改动。
- Git 提交不代表线上发布；尚未推送或部署。线上 Twelve Tools 验证仍待官网发布，当前本地改动不能作为线上回链证据。
- 不部署 Fazier 的 Launched/Featured 徽章，因为产品尚未通过它的前置条件。

## 账号和资料

- 注册/联系邮箱统一使用官网公开业务邮箱 `support@bankstatementconverter.xyz`。
- Fazier、TinyLaunch、DEV Community、HackerNoon 分别使用独立强密码，按本次用户明确授权保存在 Bitwarden。密码、验证码、认证状态和邮件登录链接不写入仓库。
- PeerPush 使用邮箱一次性验证码，无新增密码。
- 代码仓库当前为 Private；没有对外称为开源，也没有改成 Public。
- 文章归档：[bank-statement-parsing-article.md](bank-statement-parsing-article.md)。文章只含一个官网链接，不声称自动余额对账、通用银行兼容或准确率数字。

## 验证和证据

- 浏览器实际完成提交、注册、邮箱登录、文章发布、免费排期及投稿送审；不是仅保存本地表单。
- 对每项分别保留“已发布”“排队”“待审核”“待官网验证”和“未提交”的状态。
- TypeScript、页脚 ESLint、12 个语言 JSON 与新增键检查已执行；没有添加单元测试，没有启动新业务服务。
- 使用已有 localhost:3000 检查本地页脚，不执行 PDF 转换、数据库操作或付款。
- 浏览器已采集 DEV 发布、Launching Next 提交、PeerPush 排队、TinyLaunch 排期、HackerNoon 送审及本地页脚的截图；截图未纳入本次 Git 提交，后续状态通过上方结果链接核查。
