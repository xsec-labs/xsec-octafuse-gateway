# 工具配置公共 UI

本页保存该批候选阶段的实现、测量和验收档案。当前产品的 24 批公共 UI 已于 2026-10-10 本地合入 `master`（`90c8f942be5389ec3686011888dbfd2bda5e7248`）；成本决定、主仓复验与资源清理以[公共 UI 集成记录](public-ui-integration.md)及其证据收据为准。


/gateway/tools 使用公共 PageHeader、Section、Field、Input、Select、ControlButton、Spinner、Dialog、Badge 与 ShellError。搜索、抓取、深度搜索和 AI 检测按统一分组展示；供应商、standard/charged/metered 三价格及凭据在桌面采用行布局，窄屏纵向排列。亏损使用 warning 色，凭据初始隐藏。供应商需显式启用，缺少必需凭据的选项禁用。指南拥有独立开关状态和稳定组件身份。四语言各新增三项反馈，原有1556项译文叶子、包和锁文件保持，新增依赖零。

单次配置读取同时取得币种，并校验完整行、唯一键、目录、active、价格及凭据类型。core目录解析维护合法旧cost与缺省价格语义，搜索/抓取支持合法旧三键配置。非法已存值显式失败并移除可写表单。实际GET500从基线的空可编辑表单变为公共读取错误；显式重新读取采用已确认服务器值。

每次保存冻结控件并阻止重复提交。价格、凭据与AI计费字符数错误由公共Field关联aria-describedby/aria-invalid、就近宣布并聚焦。目录和active按顺序逐项保存，第二项失败显示已确认目录键。失败后必须显式回读，页面说明草稿将被服务器值替换。连接故障、完整正文超时和HTTP5xx保留结果不确定提示，编辑草稿不解除保存阻止。读取和保存各有请求所有者、取消与20秒完整正文预算；离页取消，组件释放后不启动后续写入，真实401交给现有会话所有者。持久化格式、单键PUT与供应商调用契约沿用当前版本。

统一入口：rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-tools-ui/run.mjs validation-v3 final-validation.mjs --wait-slot。同一资源槽和固定源码完成core NodeJS、受影响ESLint、Next16.2.3 webpack生产、standalone、TypeScript；17项真实流程、6项生命周期、40组320/390/768/1280/1440px、明暗与四语言验收通过。真实隔离PostgreSQL包括四目录/active保存、合法旧配置、非法目录/active/凭据、GET500、第二次写入数据库拒绝、离页取消、重复提交、未完成正文、离线和已失效会话。公共Portal边界、Escape、焦点恢复、44px目标及文字最低5.30:1通过；实际最终桌面与手机样张已查看，正常页面console/pageerror零。运行环境为macOS Apple Silicon、Chromium153、生产Next与独立PostgreSQL，供应商凭据为隔离测试值。

性能采用4预热/32正式ABBA/BAAB、新上下文、禁缓存、GC和同一真实数据库/会话。首屏等已确认测试凭据填入；指南等两版触发器进入视口、按Enter并显示四供应商；保存等第二次真实PUT成功与反馈，再SQL回读。时间ms、heap/gzip bytes。

| 指标 | 基线 → 候选 | 变化 |
| --- | --- | --- |
| readyMs | 132.70 → 132.45 | -0.19% |
| heap | 5267174.00 → 5768528.00 | 9.52% |
| guideOpenMs | 7.10 → 7.30 | 2.82% |
| guideHeap | 5642874.00 → 6221636.00 | 10.26% |
| saveMs | 60.75 → 64.10 | 5.51% |
| saveHeap | 5811160.00 → 6506512.00 | 11.97% |
| scrollP95 | 16.70 → 16.80 | 0.60% |
| firstPageGzip | 226909.00 → 229748.00 | 1.25% |

全部静态gzip 721805→720721（-0.15%）。本批性能状态INVESTIGATE，成本决定PENDING。内存调查在每版连续48轮真实指南开关、价格修改及双PUT保存后GC；后16轮heap范围为before 6448004–6515196bytes（波动1.04%）、after 7619764–7827552bytes（波动2.73%），DOM节点和监听器数量稳定，已关闭Dialog及过渡节点为零；12至48轮的普通Object/Array构造器及closure数量保持，新增快照存储主要位于V8 code类别。heap仍有小幅增长，详见retention-investigation.json。只保存内存中分析的构造器计数，原始heap快照未存储。公共字段与选择器的稳定态成本仍需按本批测量决定；此有界场景不能证明所有操作都没有泄漏。认证/导航、供应商、API密钥、用户列表、详情和模型用量各自待决成本继续约束本地集成；审计日志和可靠性成本已接受。

证据目录/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-tools-ui，包含当前源码/运行冻结SHA、验收结果、视觉审查与资源报告。最终整套128.27s、峰值RSS2949021696bytes；swap与卷级磁盘变化见validation-v3-report.json。复用735项依赖链接、webpack缓存与311项父运行文件，下载零。运行数据库、秘密、进程和租约已清理；候选与必要父基线用于待决集成，共享缓存按引用保留。

回滚本批UI提交并重建恢复原工具配置页；已确认配置值保留，可通过原页面按键显式修改。数据格式保持。D1/MySQL/Docker、其他平台/浏览器、读屏/触屏/IME/缩放/显示密度、移动性能、真实供应商及部署另行验收。
