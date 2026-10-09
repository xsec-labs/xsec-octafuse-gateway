# 供应商用量公共 UI

本页保存该批候选阶段的实现、测量和验收档案。当前产品的 24 批公共 UI 已于 2026-10-10 本地合入 `master`（`90c8f942be5389ec3686011888dbfd2bda5e7248`）；成本决定、主仓复验与资源清理以[公共 UI 集成记录](public-ui-integration.md)及其证据收据为准。


范围为 /gateway/analytics/providers 的时间范围、Token 显示、16 列供应商聚合、15 列模型明细及28 列CSV。公共PageHeader、ControlButton、Field/Input、Table、Badge、Spinner、Dialog和ShellError统一页面层级、主题与反馈。金额保留四/六位精度，成功率保持95%成功、80%警告档位，缓存命中率保留六个档位。明细与日志链接采用已提交的UTC范围、供应商、模型和路由组。四语言各新增六项读取/范围/明细提示，原译文保持；新增依赖0，包清单及锁文件保持。

供应商聚合、币种和当前供应商的模型明细分别拥有取消和完整正文20秒预算。范围更新隐藏旧表，成功提交后保留排序并关闭旧明细；失败清除结果。收起、换供应商、新范围及离页取消模型请求；用户手动展开重新读取当前数据。币种未确认时暂停金额与财务导出。响应边界检查身份、唯一键、有限金额、计数、百分比及延迟；模型/路由键使用JSON数组，真实__proto__供应商和模型身份通过。模型失败、成功空结果和加载分别呈现。

供应商行与独立按钮可展开，aria-expanded/controls与表头aria-sort随状态更新；排序、收起和弹窗关闭保持对应焦点。聚合和模型首Token详情使用一个公共Dialog，支持鼠标、键盘、Escape和背景关闭；点击首Token按钮保持供应商的展开状态。详情按钮阻止行点击传播，深色展开背景采用语义token。表格支持真实横向滚轮，页面在320/390/768/1024/1440px明暗及四语言下保持布局。实际按钮、金额、Token、Badge、表格和链接最低对比度5.30:1；最终桌面、手机、展开和详情样张已人工查看。

实际统一命令为rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-provider-analytics-ui/run.mjs <阶段> <脚本> --wait-slot。baseline-v3/baseline.mjs直接复用已冻结父批运行，验证原供应商页与61条真实记录。candidate-build-v3/build.mjs完成core Node JS、受影响ESLint、Next16.2.3 webpack生产、standalone和npm run typecheck。final-v3/verify.mjs完成23项真实页面、34组五视口/明暗/四语言视觉和最终性能；lifecycle-v2/lifecycle.mjs完成10项真实生命周期。故意使隔离数据库表不可用时HTTP500及显式重读通过；pageerror0。

性能使用同一62条真实日志、40行供应商、4预热/32正式ABBA/BAAB，新上下文、禁缓存和GC后heap。范围切换等实际请求数2→3；冷展开采用双方均正确执行的键盘流程，候选鼠标操作另行验收。heap与gzip单位为bytes，时间为ms。

| 指标 | 基线 → 候选 | 变化 | 技术状态 |
| --- | --- | --- | --- |
| readyMs | 120.00 → 121.75 | 1.46% | PASS |
| heap | 5568498.00 → 5893100.00 | 5.83% | PASS |
| rangeMs | 71.40 → 72.45 | 1.47% | PASS |
| rangeHeap | 6298808.00 → 6899532.00 | 9.54% | PASS |
| expandMs | 14.70 → 14.20 | -3.40% | PASS |
| expandHeap | 6358096.00 → 6971822.00 | 9.65% | PASS |
| closeHeap | 6389016.00 → 6945442.00 | 8.71% | PASS |
| scrollP95 | 16.80 → 16.80 | 0.00% | PASS |
| firstPageGzip | 227784.00 → 232716.00 | 2.17% | PASS |

全静态gzip 720007→720772（0.11%）。首轮冷展开14.30→26.20ms，分段计时显示额外时间主要位于页面渲染；稳定汇总行的数据/范围/格式属性与回调后，最终技术状态PASS，所有指标均在10%调查线内。原始观测和优化记录保存于performance-investigation.json。本批UI集成依赖认证/导航、供应商管理、API密钥、用户列表、用户详情与模型用量分析的独立待决成本；审计日志和可靠性已各自接受。用户用量分析本批性能PASS。

证据、源码/运行/脚本指纹和资源报告位于/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-provider-analytics-ui。735项共享依赖链接、webpack缓存复用，下载0。每次验证先记录status和changed/base plan并经单共享槽执行；报告保留实际命令、耗时、RSS、swap、卷级磁盘变化及缓存位置，卷级增量可能包含其他进程。基线、候选源码和运行文件冻结；运行数据库、秘密、进程与租约清理通过，必要候选/基线保留供集成。

回滚本批UI提交后重建恢复父批供应商用量页，业务记录保持。页面执行读取与本地CSV，验证写入只在隔离数据库。D1/MySQL/Docker、Windows/Linux/Intel macOS、Safari/Firefox、读屏/触屏/IME/缩放/显示密度、移动性能、真实供应商与部署分别验收。
