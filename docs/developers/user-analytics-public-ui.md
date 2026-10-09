# 用户用量公共 UI

范围为 /gateway/analytics/users 的时间范围、Token 显示、11 列用户聚合、11 列模型明细及16 列CSV。公共PageHeader、ControlButton、Field/Input、Table、Badge、Spinner和ShellError统一页面层级、主题与反馈。预算使用率保持80%警告、100%危险档位；成功率保持95%成功、80%警告档位。金额保留四/六位精度，预算为当前用户累计快照，聚合指标与日志链接采用已提交的UTC范围。四语言各新增六项提示并更新用户说明，其他原译文保持；新增依赖0，包清单及锁文件保持。

用户聚合、币种和当前展开用户的模型明细分别拥有取消和完整正文20秒预算。范围更新隐藏旧表，成功提交后保留排序并关闭旧明细；失败清除结果。模型收起、换用户及离页取消请求，手动展开重新读取当前数据。币种未确认时暂停金额与财务导出。响应边界检查身份、唯一键、有限金额/预算、计数、百分比、日期及延迟；预算允许大于100%，无限预算显示无数据标记。模型/路由键使用JSON数组，真实__proto__用户和模型身份通过。模型明细的失败、成功空结果和加载分别呈现。

真实基线证明展开按钮中央点击会触发其内嵌日志链接，见baseline-v2-nested-link-probe.json。公共展开按钮与日志链接分别提供鼠标/键盘操作；aria-expanded、aria-controls及表头aria-sort随状态更新，排序与收起保留焦点。表格支持真实横向滚轮和窄视口，通用控件及链接高度至少44px。深色总金额文字通过语义颜色映射校正；final-v2-visual-visual.json检查实际金额、Token、按钮及表格文字，最低对比度5.30:1。最终桌面、中文手机与展开样张已人工查看。

独立UTC修复候选b7a37b23461ac85ee0601595edf3f76ef2bba1da已本地集成为be68e281ba0fd9bdbdeaa4b5c9e903327bc196d7。真实PostgreSQL上海连接对无偏移SQL范围得到0行，显式UTC/偏移对照通过。修复只归一化queryUserAnalytics的筛选与非筛选两个分支。真实回归覆盖UTC/上海/洛杉矶连接、SQL/ISO/明确偏移/毫秒、包含边界、邮箱筛选、空邮箱排除、Token/金额/预算及最近活跃时间。旧实现失败，修复和主仓扩展用户/模型/可靠性三项回归通过。

实际统一命令为rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-user-analytics-ui/run.mjs <阶段> <脚本> --wait-slot。candidate-build-v3/build.mjs完成core Node JS、受影响ESLint、Next16.2.3 webpack生产、standalone和npm run typecheck。final-v2/final-validation.mjs完成23项真实页面、24组五视口/明暗/四语言视觉和最终性能；lifecycle-v1/lifecycle.mjs完成8项真实生命周期；core-main-v1/core-expanded.mjs经tsx --test --test-concurrency=1执行主仓真实PostgreSQL回归。生命周期对应未变化的读取逻辑，后续修改为四语言说明与颜色。console仅有故意让隔离数据库表不可用时的HTTP500，pageerror0。

性能使用同一62条真实记录、40行用户、4预热/32正式ABBA/BAAB，两侧包含同一UTC修复，新上下文、禁缓存和GC后heap。范围切换等实际请求数2→3；冷展开采用双方均正确执行的键盘流程，候选鼠标操作另行验收。heap与gzip单位为bytes，时间为ms。

| 指标 | 基线 → 候选 | 变化 | 技术状态 |
| --- | --- | --- | --- |
| readyMs | 120.60 → 121.85 | 1.04% | PASS |
| heap | 5544098.00 → 5726268.00 | 3.29% | PASS |
| rangeMs | 63.05 → 68.55 | 8.72% | PASS |
| rangeHeap | 6210948.00 → 6467522.00 | 4.13% | PASS |
| expandMs | 27.45 → 25.15 | -8.38% | PASS |
| expandHeap | 6236070.00 → 6504776.00 | 4.31% | PASS |
| closeHeap | 6250530.00 → 6490166.00 | 3.83% | PASS |
| scrollP95 | 16.70 → 16.80 | 0.60% | PASS |
| firstPageGzip | 227973.00 → 227456.00 | -0.23% | PASS |

全静态gzip 719527→720007（0.07%）。最终性能技术状态PASS；本批成本在10%调查线内。UI集成依赖认证/导航、供应商、API密钥、用户列表、用户详情与模型用量分析的独立待决成本；审计日志和可靠性已各自接受。

证据、源码/运行/脚本指纹和资源报告位于/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-user-analytics-ui。735项共享依赖链接、webpack缓存复用，下载0。每次验证先记录status和changed/base plan并经单共享槽执行；报告保留实际命令、耗时、RSS、swap、卷级磁盘变化及缓存位置，卷级增量可能包含其他进程。基线、候选源码和运行文件冻结；运行数据库、秘密、进程与租约清理通过，必要候选/基线保留供集成。早期基线鼠标失败、空态断言误计Next读屏公告及初版深色金额检查范围保留诊断与修正证据。

回滚UI候选提交并重建恢复父批用户用量页；独立UTC修复通过rtk git revert be68e281ba0fd9bdbdeaa4b5c9e903327bc196d7回滚，业务记录保持。页面执行读取与本地CSV，验证写入只在隔离数据库。D1/MySQL/Docker、Windows/Linux/Intel macOS、Safari/Firefox、读屏/触屏/IME/缩放/显示密度、移动性能、真实供应商与部署分别验收。
