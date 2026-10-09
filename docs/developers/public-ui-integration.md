# Octafuse 公共 UI 集成

2026-10-10，24 批已验收候选本地合入 `master`，产品合并提交为 `90c8f942be5389ec3686011888dbfd2bda5e7248`。合并起点为 `4b1d918d0d45367e52ea9d47d2bb080fddf841f7`，最终候选为 `85aa89dc2086870face54b52d3c95ac127e8047a`；实际主仓 tree 与候选相同，均为 `97d87fd90c954bb2fe64f78e72e12ed74d3cd37b`。主仓同期七项独立修复在候选链中已有等价代码，合并预演和结果均通过。

认证、语言切换、桌面/移动导航，以及 Dashboard、供应商、模型、路由、API 密钥、用户列表/详情、审计与请求日志、四类分析、系统配置、工具配置/调用、Playground 和 Simulator 使用同一公共控件与主题。`@xsec/ui-react` 0.1.6、`@xsec/design-tokens` 0.1.2 由锁文件和 vendor 制品固定，Docker 依赖阶段包含 vendor 输入。五个已退出渲染链路的旧 UI 模块已移除，退役核查和各页面的业务、请求、生命周期变化保存在对应工程档案。

## 验收和成本决定

各批真实边界、视觉、生命周期与性能记录保留原始技术状态。16 批记录中仍有超过 10% 调查线的指标，调查、优化及绝对成本已复核并接受；接受决定保存在 `cost-decisions.json`，技术状态 `INVESTIGATE` 保留。有限循环、V8 code 归属和浏览器输入历史的调查均保留各自限制，不能据此推断任意长时间使用情况。

主仓独立复验通过五个构建步骤：core 编译 `.js` 入口、五项真实路由算法契约、Next 生产 webpack 构建、standalone 链接和 TypeScript。实际命令为 `rtk npx --no-install esbuild src/index.ts --bundle --platform=node --format=esm --outfile=dist/index.js --packages=external`、`rtk npx --no-install tsx --test app/gateway/routes/route-utils.test.ts`、`rtk npx --no-install next build --webpack`、`rtk node scripts/link-standalone-next.mjs` 和 `rtk npm run typecheck`。生成声明的处理未改变已提交 tsconfig，主仓源码状态回读为空。

真实隔离 PostgreSQL、生产 Next 和 Chromium 通过八类流程，覆盖全部 18 个业务路由的标题、主题和有效内容，包含实际创建用户的详情。路由 LLM/图像/音频分类、优先级/权重保存及价格计划/自定义参数保持、策略保存、真实缺表 HTTP 500 展示和用户显式恢复通过。列表覆盖 1440、1024、820、390、320px，复核 390px 深色编辑器截图。页面错误为零；console 中的 500 对应已执行的故障注入。浏览器、生产服务和隔离数据库均已停止清理。

主仓 131 项静态/运行文件记录长度和 SHA-256，实际构建 ID、standalone、登录 API、core `.js` 入口及公共包版本/vendor SHA 均回读成功。详细功能的逐批验收继续作为本次集成证据；主仓导航覆盖不能替代未执行的每项业务路径。

## 资源与工作树

验证经共享资源控制器，执行前读取 status 和基于产品起点的 changed plan；Octafuse 显式验证 adapter 保留受影响 Admin/core 与消费者。档位 dev、预算 4 GiB，下载量为零。

| 阶段 | 资源 run ID | 耗时 | 峰值采样 RSS | 卷空间净增量 |
| --- | --- | --- | --- | --- |
| 主仓构建 | b7b60e6a-9f65-4793-883c-d8c3dad67b63 | 27.087 s | 3,382,640,640 B | 9,367,552 B |
| 主仓真实流程 | 1fda1451-b849-40f8-85d1-64158a79cc9b | 15.248 s | 1,047,347,200 B | 77,824 B |

两阶段 swap 使用量保持控制器记录的 59,894,661.12 B。卷读数包含同机活动，RSS 按控制器采样。共享 target 为 `/Users/xiaosong/dev/xsec-labs/.worktree-cache/build-resources/targets/b27abc052fc82fd663abf2de544f62647354f97863b0f2e84f2f7411b472e557`；webpack 和 Node 缓存移到 `/Users/xiaosong/dev/xsec-labs/.worktree-cache/octafuse-ui-integrated`，采用移动及链接，未复制大型缓存。公共增量包继续位于任务证据目录的稳定依赖缓存，主仓链接已核查不指向待清理工作树。原有依赖和 webpack 备份保存在集成证据目录。

24 个任务工作树的合并祖先、干净源码、分支归属和引用条件在清理前再次检查；执行结果以 `local-integration-final.json` 为准。逐批历史正文仍描述其候选阶段，当前产品状态以本记录和该最终收据为准。

## 边界与回滚

本次主仓复验使用 Apple Silicon macOS、Chromium、Node 和隔离 PostgreSQL。D1、MySQL、Docker、其他平台/浏览器、读屏、触屏、系统输入法、真实供应商成功请求、长时间性能及部署保留对应环境验收要求。正式部署需要其发布验证。

撤销整套 UI 可对产品合并提交执行 `rtk git revert -m 1 90c8f942be5389ec3686011888dbfd2bda5e7248`，恢复对应依赖并重建。该操作同时撤销候选链中的独立行为修复；需要保留 UTC、持久化错误和生命周期修复时，按各批档案选择 UI 提交回滚。当前改动没有新增数据迁移；代码回滚不撤销已确认的用户、路由、密钥、预算或设置写入，业务恢复通过其原有显式管理操作完成。

证据目录：`/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-local-integration`。预检的目录枚举、构建链接和 Node diff 缓冲区失败保留在 `preflight-failures.json`，修正后的 24 批预检通过。关键收据为 `preflight.json`、`merge-readback.json`、`cost-decisions.json`、`dependencies-stabilized.json`、`primary-build-v1-checks.json`、`primary-browser-v1-browser.json`、`primary-source-assets-readback.json`、`resource-summary.json` 和 `local-integration-final.json`。
