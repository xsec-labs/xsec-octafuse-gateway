# 模型用量公共 UI

范围为 /gateway/analytics/models 的时间范围、Token 显示、17 列聚合表、供应商明细、TTFT 详情及 28 列 CSV。共享 PageHeader、ControlButton、Field/Input、Table、Badge、Spinner、Dialog 与 ShellError 统一层级、主题和反馈。业务统计、列精度、缓存/成功率档位、排序、模型与路由分组及日志过滤继续由应用维护。新增依赖为 0，包清单和锁文件保持。

聚合、币种和当前展开的供应商明细各自拥有取消与 20 秒完整正文预算。范围读取期间隐藏旧表，成功后更新，失败清除结果；范围变更保留排序并关闭旧明细。收起、换模型和退出页面均取消明细读取。所有重读由用户操作触发。币种未确认时暂停金额和财务导出，其余指标仍可读。响应检查有限数值、计数、百分比、持续时间、身份与唯一键。模型/路由组合使用 JSON 数组键，保留合法 __proto__ 身份。

TTFT 保留原主指标选择和鼠标悬停文本。点击或键盘打开共享详情 Dialog，展示六项计时/覆盖率，Close、Escape 和背景关闭后恢复焦点。公共表头排序保持组件身份、aria-sort 与键盘焦点。主题、44px 操作目标、窄屏横向滚动及错误/空态使用统一语义样式。

独立 UTC 修复候选 dc09bfbe5dcc8f97cadcc02d65616c956f72e871 已本地集成为 ab6ab24ec4282086ce6eeae1a79afe68fa4362ef。真实 PostgreSQL 上海连接复现无偏移 SQL 边界被按本地时区解释；修复仅归一化模型聚合和供应商明细的绑定值。回归覆盖 UTC、上海、洛杉矶连接，SQL/ISO/明确偏移/毫秒、包含边界及 tag/user/provider/route 筛选。原实现失败、修复后与主仓回归通过。用户聚合查询保持独立范围。

实际命令：受影响 ESLint；Next 16.2.3 webpack 生产构建；standalone 链接检查；npm run typecheck；tsx --test 的真实 PostgreSQL 回归；统一资源入口运行 /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-model-analytics-ui/run.mjs 的浏览器脚本。构建、类型、19 项页面流程、8 项生命周期及24 组视觉检查通过。Chromium 153 验收 320/390/768/1024/1440px、明暗、四语言和真实滚轮；最低对比度 5.36:1。人工复核最终桌面与手机 Dialog 截图。console 仅有刻意使数据库表不可用时的 HTTP 500，pageerror 为0。生命周期对应 final-v1；后续变更为按钮色调和截图/鼠标验证，读取所有权代码保持。

性能使用同一 62 条真实记录、40 行模型、4预热/32正式 ABBA/BAAB，新 Chromium 上下文、禁缓存与GC后heap，七天范围须在真实 DOM 从请求数2显示为3。JS heap 单位为bytes，其余时间为ms，gzip为bytes。

| 指标 | 基线 → 候选 | 变化 | 技术状态 |
| --- | --- | --- | --- |
| readyMs | 124.75 → 127.55 | 2.24% | PASS |
| heap | 5580670.00 → 5861068.00 | 5.02% | PASS |
| rangeMs | 70.75 → 70.65 | -0.14% | PASS |
| rangeHeap | 6318924.00 → 6880360.00 | 8.88% | PASS |
| expandMs | 48.20 → 56.30 | 16.80% | INVESTIGATE |
| expandHeap | 6379234.00 → 7007572.00 | 9.85% | PASS |
| closeHeap | 6436870.00 → 7004632.00 | 8.82% | PASS |
| scrollP95 | 16.75 → 16.80 | 0.30% | PASS |
| firstPageGzip | 228334.00 → 232659.00 | 1.89% | PASS |

完整静态 gzip 715558 → 717547（0.28%）。每个计时单元格常驻 Tooltip 改为共享 Dialog 后，列表内存增幅从24.52%降到5.02%。最终供应商明细冷打开多 8.10ms（16.80%），保持 INVESTIGATE；分段观测保存在 performance-investigation.json。成本接受按本批独立记录，公共UI集成同时依赖认证/导航、供应商、API密钥、用户列表和详情的待决成本；审计日志与可靠性已各自接受。

证据和源码/运行/脚本指纹位于 /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-model-analytics-ui。每次验证前记录 status 和 changed/base plan，经单共享槽执行；复用735项依赖链接和webpack缓存，下载0。资源报告保存实际耗时、RSS、swap、卷级增量与共享缓存位置；卷级变化可能包含其他进程。运行数据库、秘密、进程和租约均清理，候选与必要基线保留供决定和集成复验。

回滚 UI 提交后重建恢复父批模型页面；UTC 修复通过 rtk git revert ab6ab24ec4282086ce6eeae1a79afe68fa4362ef 独立回滚。此批页面仅执行读取和本地 CSV，验证写入限隔离数据库。D1/MySQL/Docker、Windows/Linux/Intel macOS、Safari/Firefox、读屏/触屏/IME/缩放、移动性能、真实供应商执行和部署分别验收。
