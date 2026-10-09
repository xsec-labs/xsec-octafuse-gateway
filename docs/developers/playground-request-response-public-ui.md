# Playground 请求与响应公共 UI

本页保存该批候选阶段的实现、测量和验收档案。当前产品的 24 批公共 UI 已于 2026-10-10 本地合入 `master`（`90c8f942be5389ec3686011888dbfd2bda5e7248`）；成本决定、主仓复验与资源清理以[公共 UI 集成记录](public-ui-integration.md)及其证据收据为准。


/gateway/playground 的请求编辑、媒体输入、发送操作、错误反馈和响应使用公共 Section、Field、Input、Textarea、RadioGroup、ControlButton、ErrorState、Badge、Spinner 与 EmptyState。请求和响应在宽屏并列、窄屏单列，统一明暗主题、44px 控件、焦点、间距与可滚动代码块。JSON、总时限、文件与 Gemini 操作具有命名及错误关联。图像编辑展示全部已选文件，原有五张上限阻止超额发送。HTTP 错误展示真实原始正文，成功状态才展示合并内容。

发送失败由单一判别对象持有，JSON 校验关联编辑器，时限校验关联时限输入，传输失败在 ErrorState 展示，合法 JSON 保持有效状态。响应滚动尊重 prefers-reduced-motion。发送所有权沿用前置提交 43a9bcd14e7a7107a965404aa3e60807691bbe23：首次 await 前认领，AbortController 覆盖实际 FileReader、HTTP 和完整正文，用户取消、模式切换及离页终止操作，1–3600 整数秒总预算默认 300 秒，POST401 通知既有会话所有者。前置问题复现、实现和回滚见 playground-send-ownership.md。

本批在前置提交上仅为 sender 的三项校验增加错误目标参数。目录组件、读取和解析器、工具面板、FileReader helper、包与锁经 preservation.json 对比保持。四语言各新增两项反馈文案，原 1579 项译文叶子保持；连同前置生命周期提交各新增七项。新增依赖零，API、账单、请求日志和持久化格式保持。模式切换与工具面板公共 UI 为后续范围。

统一入口实际命令：

- rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-request-ui/run.mjs request-build-v3 build.mjs --wait-slot
- rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-request-ui/run.mjs request-validation-v1 qa.mjs --wait-slot
- rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-request-ui/run.mjs input-trace-v1 input-trace.mjs --wait-slot

core Node JS、受影响 ESLint、Next16.2.3 webpack生产、standalone及TypeScript通过。真实隔离PostgreSQL、生产Next、loopback代理及Chromium153.0.8010.12完成15项目录/协议/媒体回归、8项请求响应流程和10项发送生命周期检查。包括实际JSON错误、六文件超额及修正、音频清理、Gemini方向键、真实502及账单/日志保持、显式取消、模式切换和离页取消、完整正文超时、断连、24MiB WAV原生双击仅一个POST、真实FileReader单参数/取消、实际POST401。代理延迟或截取实际网关的502字节，供应商目标为127.0.0.1:9。完整套件六个worker执行成功，性能门槛结果单独记录。

40组视觉覆盖320/390/768/1280/1440px×明暗×四语言，共200个请求/502/图像/音频/Gemini状态，命名、错误归属、44px目标、焦点、Radio方向键和溢出检查通过。范围内最低文字对比度5.30:1；桌面、320px和中文暗色手机样张已查看。实际视口及main滚动所有者截图保留。Base UI 的1px隐藏表单radio按其aria-hidden和tabindex语义排除可见控件尺寸判断。正常流程console/pageerror零；实际502网络错误独立记录。

性能基线为目录候选2ad8a8476a5dc71c45fb85c2db449aae39707f2d，候选增量包含前置发送生命周期和本批请求/响应UI。同机器、真实数据库/会话及payload，新context、禁缓存、GC，4预热/32正式ABBA/BAAB。时间ms，heap/gzip bytes。

| 指标 | 基线 → 候选 | 变化 |
| --- | --- | --- |
| readyMs | 129.75 → 131.25 | 1.16% |
| initialHeap | 5547336.00 → 5553846.00 | 0.12% |
| selectionMs | 8.65 → 6.95 | -19.65% |
| selectionHeap | 6998418.00 → 6998302.00 | -0.00% |
| inputFrameMs | 10.30 → 12.05 | 16.99% |
| inputHeap | 7134104.00 → 7134378.00 | 0.00% |
| refusalMs | 19.15 → 19.35 | 1.04% |
| refusalHeap | 7294404.00 → 7325588.00 | 0.43% |
| scrollP95 | 16.70 → 16.80 | 0.60% |
| firstPageGzip | 259809.00 → 260390.00 | 0.22% |

全部静态gzip 728662→729477（0.11%）。inputFrameMs为实际input事件到下一rAF，10.30→12.05ms（+1.75ms，+16.99%），仍超过10%调查线，正式状态INVESTIGATE。该指标包含浏览器任务间隔和等帧。16个带追踪诊断样本的前/后中位数：输入事件分发0.43→0.46ms，裁剪合并RunTask覆盖1.00→1.01ms，未覆盖间隔1.66→2.89ms。这些时间受追踪开销影响，只支持测量边界分析；正式回退归因于React渲染尚未证实，成本保留。本批成本决定PENDING，目录及六个前序各自待决。

两版各48轮实际选择、发送及502；后16轮同状态DOM/监听器稳定：基线nodes504/listeners651/attached321，候选506/652/317。后16轮JS heap基线8325620→8533528 bytes（+207908，+2.50%），候选8357744→8555904 bytes（+198160，+2.37%）；残余增长归因未定。两版48轮后heap snapshot保存。该有限序列支持观察到的DOM/监听器稳定性，长期留存另行验证。

证据目录/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-request-ui保存冻结源码/运行、真实验收、性能调查、截图SHA和资源报告。最终构建16.415s、峰值RSS3023814656bytes、卷级磁盘增量−4796416bytes；完整套件118.723s、峰值1242857472bytes、磁盘增量44957696bytes；输入追踪7.730s、峰值992821248bytes、磁盘增量4726784bytes。三次swap0→0；预算4GiB，缓存位置见resource-summary.json。复用735项依赖链接和共享webpack缓存，下载零，内部盘容量充足。运行、数据库、临时媒体和本任务租约已清理；候选与必要父运行保留供独立成本决定和本地集成。

真实供应商成功、SSE成功/中断、D1/MySQL/Docker、其他平台/浏览器、读屏/触屏/IME/缩放/密度、移动性能和部署未验证。回滚本批UI提交并重建恢复前置生命周期版本；若同时回滚生命周期，按其契约单独回滚前置提交。数据格式保持。候选链集成依赖目录和前序各批决定，整体迁移继续。
