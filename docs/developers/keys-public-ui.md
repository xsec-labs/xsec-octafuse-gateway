# Octafuse API 密钥公共 UI

API 密钥列表、搜索、创建/编辑、状态开关、删除确认和复制采用 tokens 0.1.2 / UI React 0.1.5。公共标题、控件、表格、徽标、表单、弹窗及错误反馈共享主题、焦点、减少动效和窄屏规范。专业预算、时间、元数据摘要沿用原有业务 helper。en/zh/ja/ko 各新增 12 键，起点各 1476 项值保持，新增依赖 0。

## 行为与真实契约

真实起点 HTTP500 被显示为空表，列表读取缺少请求所有者，原生确认框和手写窗口各自维护交互。候选读取由 useShellRequest 管理：20 秒预算覆盖完整 JSON body，查询替换与离页取消所属请求，响应校验分页总数、唯一 ID 和实际字段。失败显示错误及明确重新读取，成功的零条结果显示空态。401 通知根会话失效并移除密钥详情与秘密。

邮箱/用户 ID 筛选、20 条分页、创建时间排序及原有默认倒序保留。表格在自身容器滚动，页面和窗口在 320px 至 1440px 宽度内显示。排序提供 aria-sort，编辑使用独立语义按钮，复制与编辑各自响应。末页最后一条删除后返回有效页码。

两种创建路径保留：关联已有用户，或按外部系统/用户对匹配或创建。真实数据库确认新外部用户预算为零，再次匹配沿用原邮箱。预算只从 users JOIN 读取，用户、套餐和预算由用户管理维护。创建 reason=gwui:new，编辑 gwui:edit，状态 gwui:st:active/revoked，物理删除的原有审计来源和事件保留。

元数据接受原有任意有效 JSON，包括对象、数组及标量。真实基线 PATCH metadata:null 不会清空字段；候选编辑发送服务端已有的 metadata_replace，真实 UI 空输入通过 metadata_replace:null 清空数据库值。非法 JSON 保留草稿并明确显示错误。未改变服务端格式或数据库 schema。

共享写入所有者保护同帧重复动作，写入期间阻止关闭，失败保留草稿。请求可能已提交时禁用再写，用户明确回读当前列表后继续。实际丢失 POST body 的场景只有一次创建，服务端提交后窗口显示不确定结果，回读确认密钥存在。删除确认由嵌套公共 Dialog 管理，取消恢复触发控件焦点，成功删除保留用户预算。

创建成功的完整秘密显示在可关闭的 banner；原有管理 API 的既有密钥读取与编辑复制契约保持。复制使用真实 Clipboard，失败显示反馈，反馈计时器和异步结果归属在控件卸载/替换时清理。验证脚本动态登记新密钥用于文本和日志脱敏，截图遮盖完整秘密。

## 验收与性能

证据目录：/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-keys-ui。Browser 插件不可用，复用已有 Playwright/Chromium 153。真实隔离 PostgreSQL、Next 生产运行、Clipboard 和 loopback 转发代理验证，未连接供应商端点。

最终 ESLint、Next webpack 生产构建、standalone 输出及类型检查通过。22 项实际页面流程、7 项请求生命周期及 1 项 V8 回归共 30 项检查通过，pageerror 为 0。控制台仅有主动故障场景的 HTTP400/500 资源日志；新建窗口的翻译键已修正并纳入控制台检查。

覆盖分页、排序、两类筛选、两类创建、外部身份匹配、真实 Clipboard/ID、JSON 数组/标量/清空、拒绝创建、吊销/恢复、实际删除、末页修正、数据库审计/预算、500 与主动恢复、查询替换/卸载取消、完整 body 超时、已提交 POST 部分响应、socket 断开和401。五种宽度×明暗共10组列表/编辑布局、四语言320px新建窗口通过。完整秘密截图遮盖。

初轮64个样本保留，汇总脚本命名遮蔽导致完整资产报告失败，原样本和失败记录保留；局部汇总显示列表/编辑/输入触及10%调查线。编辑草稿与表格数据分离，稳定回调及实际稳定 props 复用 KeyTable。真实 V8 覆盖计数确认20行/6字符输入表格 render 为0；状态变更实际触发3次更新。最终相同20密钥、实际会话、50预算、Asia/Shanghai、1440×900、禁用缓存/GC、16组ABBA/BAAB共64正式样本、4预热如下。耗时单位ms，heap与gzip单位bytes。

| 指标 | 起点 | 候选 | 变化 | 结果 |
| --- | ---: | ---: | ---: | --- |
| 列表就绪 | 102.6 | 101.6 | -0.97% | PASS |
| 列表 GC 后 JS heap | 5099678 | 5543838 | +8.71% | PASS |
| 滚动帧间隔 P95 | 16.75 | 16.8 | +0.30% | PASS |
| 冷打开编辑 | 61.05 | 65.8 | +7.78% | PASS |
| 编辑弹窗 JS heap | 5415744 | 6076362 | +12.20% | INVESTIGATE |
| 输入耗时 | 10.2 | 9.1 | -10.78% | PASS |
| 关闭后 JS heap | 5661934 | 6170254 | +8.98% | PASS |
| 首屏 JS/CSS gzip | 227372 | 236943 | +4.21% | PASS |
| 完整 Admin JS/CSS gzip | 699015 | 701944 | +0.42% | PASS |

弹窗 heap +12.20%（5415744→6076362bytes）仍需独立成本决定，其他指标在10%调查线内。冷打开、就绪包括真实浏览器 locator 观察；关闭后堆可保留已加载模块和交互状态。结果限定本机 Apple Silicon macOS、Chromium 桌面及当前数据输入，JS heap与进程树RSS分别记录。

## 命令与资源

每个阶段保存 status、changed/base 计划及明确 Admin validation adapter，经统一 dev 单构建槽执行：

```sh
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-keys-ui/run.mjs candidate-build-v7 candidate-build.mjs
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-keys-ui/run.mjs candidate-final-v2 final-ui-checks.mjs
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-keys-ui/run.mjs perf-v2 performance.mjs
```

| 阶段 | runId | 用时 | 峰值进程树 RSS | 卷级磁盘增量 | swap |
| --- | --- | ---: | ---: | ---: | ---: |
| candidate-build-v7 | 79f3c089-41ea-461c-b1f5-68a4c641b701 | 17.398s | 2976284672bytes | -4071424bytes | 0→0bytes |
| candidate-final-v2 | ad904b7a-0443-40d0-bb72-31b05be6b0c9 | 51.180s | 927514624bytes | -880640bytes | 0→0bytes |
| perf-v2 | 6a0a0405-a996-412c-befc-176b0889b120 | 87.073s | 976355328bytes | +1536000bytes | 0→0bytes |

三阶段源码指纹前后一致，卷级磁盘变化包含本机其他进程活动，独立本批磁盘增量未测量。738个浅层依赖链接和共享 core/webpack 缓存复用，下载0。manifest/锁文件/vendor六项字节与起点相同。258项路由起点运行资产逐项回读，最终脚本依赖6项冻结并回读。共享 dev target 为 b27abc052fc82fd663abf2de544f62647354f97863b0f2e84f2f7411b472e557；实际 .next 输出在本任务工作树 packages/admin/.next。运行数据、进程、数据库及租约清理以 candidate-acceptance-state.json 为准。

## 候选与回滚

起点为路由候选68ceacf0e0823805022cd3029681fc6a63e6b569，分支codex/octafuse-keys-ui。产品master保持34e643f12d557a774a86c14bd9602bbef0b264b5；API密钥成本、认证/导航和供应商成本分别记录，主仓集成依赖相应决定。完成集成验收后回收本批及父候选工作树，公共缓存按引用保留。冻结源码、运行资产、提交回读与台账记录在证据目录。

回滚本批 UI 提交并重建恢复起点展示；已经保存的密钥、元数据、状态、用户及审计记录按实际业务数据处理，代码回滚不会恢复已删除密钥或清空的元数据。Docker、Windows/Linux/Intel macOS、Safari/Firefox、屏幕阅读器/触屏/IME/缩放、移动性能及云OpenNext/生产部署需对应环境验收。其余Octafuse业务页和全工作区UI/UE统一继续推进。
