# Playground 路由目录公共 UI

/gateway/playground 的页面标题、目录读取、联动筛选、路由选择与详情使用公共 PageHeader、Section、Field、Select、RadioGroup、Badge、EmptyState、Spinner、ControlButton 与 ShellError。控件统一明暗主题、44px 目标、焦点、间距和窄屏布局。完整路由 ID 与状态可读；公开入口、custom_params、price_override 收入默认折叠的原生路由配置区域。请求/响应、发送函数和工具面板保留原实现，本批契约限定为目录。

三个真实 GET 并行读取并复用模型、供应商、路由的现有解析器，通过各自 catalog.ts 公共入口消费。任一读取、正文或引用完整性失败使整个目录显式失败；20 秒预算覆盖完整正文，失败取消其余读取，离页取消，迟到响应无法覆盖新页面所有者。用户可显式重新读取；401 通知既有会话所有者。缺失模型或供应商引用属于 INVALID_RESPONSE。联动筛选在事件中归一化：兼容过滤值和已编辑请求保持，冲突值及不可见选择清除；类型切换清除选择、媒体与响应状态，新路由使用对应协议模板。

目录使用稳定 options/callback 与 memo 边界；当前证据未包含请求输入的专门 render profiler，相关收益尚未量化。四语言各新增 7 项目录文案，原有 1567 项译文叶子保持。包、锁文件、发送函数、请求/响应 JSX 及工具面板经 preservation.json 比对保持；新增依赖零。

统一入口实际命令：rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-ui/run.mjs build-v4 build.mjs --wait-slot；rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-ui/run.mjs validation-v2 qa.mjs --wait-slot；rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-ui/run.mjs retention-v1 retention.mjs --wait-slot；rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-ui/run.mjs retention-directory-v1 retention-directory.mjs --wait-slot。core Node JS、受影响 ESLint、Next 16.2.3 webpack 生产、standalone 和 TypeScript 通过。validation-v2 的真实流程、生命周期、视觉、性能四个 worker 独立完成；整套命令在原始留存断言失败，原始结果保留。

15 项真实流程覆盖三协议模板、image/audio、兼容筛选、媒体清理、真实 127.0.0.1:9 连接拒绝及账单/日志保持、独立模型 GET500、损坏存储、空目录。7 项生命周期覆盖各 GET 离页取消、实际迟到响应、完整正文超时、真实断连和过期会话。隔离 PostgreSQL、生产 Next、loopback 代理、Chromium 153.0.8010.12 使用真实边界。40 组视觉覆盖 320/390/768/1280/1440px × 明暗 × 四语言；目录控件目标、Select Portal、焦点恢复、Radio 方向键、展开配置和溢出检查通过，范围内最低文字对比度 5.64:1。最终桌面、320px 和中文暗色手机样张已查看；正常流程 console/pageerror 零。

性能使用同机器、实际数据库/会话、五条路由及三条 LLM 选择，4 预热/32 正式 ABBA/BAAB，新上下文、禁缓存、GC。选择从 native change/公共 option click 至同一 OpenAI 路由与模板，筛选至 Anthropic 目录和选择清除，选项获取不计入。基线配置 JSON 默认展开，候选默认折叠；这是本批展示行为的差异。时间 ms，heap/gzip bytes。

| 指标 | 基线 → 候选 | 变化 |
| --- | --- | --- |
| readyMs | 109.70 → 132.55 | 20.83% |
| heap | 4398124.00 → 5524294.00 | 25.61% |
| selectionMs | 6.80 → 8.65 | 27.21% |
| selectionHeap | 5269984.00 → 6995420.00 | 32.74% |
| filterMs | 3.50 → 7.50 | 114.29% |
| filterHeap | 5420432.00 → 7483844.00 | 38.07% |
| scrollP95 | 16.70 → 16.70 | 0.00% |
| firstPageGzip | 237568.00 → 259809.00 | 9.36% |

全部静态 gzip 726901→728662（0.24%）。固定成本仍超过 10% 调查线，测量状态 INVESTIGATE，调查记录 performance-investigation.json 已完成，本批成本决定 PENDING。

留存调查分别执行两版各 48 轮选择/JSON 编辑/筛选，以及各 48 轮仅目录选择/筛选。两版编辑后所取样 Text 的强引用经 Blink RemoveNodeCommand/UndoStep、UndoStack、Editor、LocalFrame 到 C++ roots，说明这些样本文本由浏览器编辑撤销历史保留。仅目录循环后 16 轮按协议同状态分组，节点、已挂载元素与监听器稳定：基线奇/偶节点 439/437、监听器 355、已挂载元素 219；候选节点 435/433、监听器 815、已挂载元素 277。后 16 轮 JS heap before 6031768→6098352 bytes（1.10%）；after 9131832→9274040 bytes（1.56%），残余增长归因未定。该有限场景支持观察到的 DOM/监听器稳定性，其他操作和长时留存另行验证。

证据目录 /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-ui 包含冻结源码和运行 SHA、真实验收、视觉审查、性能调查与资源报告。最终构建 18.801s、峰值 RSS 3000532992 bytes；validation-v2 整套至留存失败 100.750s、峰值 1037549568 bytes；两次留存调查分别 20.731s/988708864 bytes、20.385s/983826432 bytes。各次 swap 0→0；卷级磁盘增量、共享缓存位置见 resource-summary.json。复用 735 项依赖链接、共享 webpack 缓存与父运行，下载零；内部盘容量充足，本批使用内部共享缓存。运行进程、数据库、秘密和租约已清理。候选及必要父运行保留供成本决定及后续集成。

认证/导航、供应商、API 密钥、用户列表、用户详情和模型用量六批各自待决；审计日志、可靠性、工具配置和调用记录的成本已各自接受。当前目录候选待决定与集成。请求/响应与工具面板为后续批次。回滚本批 UI 提交并重建恢复原目录；API 和持久化格式保持。D1/MySQL/Docker、其他平台/浏览器、读屏/触屏/IME/缩放/密度、移动性能、真实供应商成功响应及部署另行验收。
