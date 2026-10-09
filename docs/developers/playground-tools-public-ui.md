# Playground 工具与模式公共 UI

/gateway/playground 的模式按钮、工具与引擎选择、模板、JSON编辑、发送反馈及响应使用公共ControlButton、Section、Field、Select、Input、Textarea、ErrorState、Badge、Spinner和EmptyState。明暗主题、44px目标、键盘焦点、Select Portal、响应式双列/单列和可展开实际请求正文统一。模式aria-pressed表达当前选择，原链接与配置入口保持。合法默认工具为ai-detection；工具/供应商输入依据既有白名单验证。工具与供应商由单一selection对象持有，事件中更新及清除旧响应。

真实生产浏览器基线复现三项行为：切换模式及SPA离页后等待返回的工具POST在一秒预算内仍连接；发送时切换工具将旧AI结果显示在web-search选择下。原实现缺少发送取消所有者，且发送期间工具、引擎、模板与JSON仍可修改。现在首个await前同步ref认领单次发送，AbortController覆盖HTTP与完整正文，控件在发送中锁定。用户取消、模式卸载和离页终止浏览器操作，迟到结果不回写；1–3600整数秒总时限默认300秒，实际POST401通知既有会话所有者。

错误按body/timeout/send归属，合法JSON在传输失败时保持有效。完整响应先保存真实原文，再依据application/json解析；损坏JSON及请求正文头编码/JSON显式失败。取消和失败释放发送所有者，保留已收到状态和内容。发送按钮在可选取消按钮之前，原生双击维持同一目标；验收发现的插入位置取消问题已修复。服务端供应商执行取消传播尚未验证，本批只证明浏览器至管理接口的连接及所有权。

工具选择区域使用memo和稳定options/callback作为输入编辑的渲染边界。新增依赖零；四语言各新增一条工具响应时限提示，原1581项叶子保持。路由sender字节级保持，目录、路由请求/响应组件、FileReader helper、包锁经preservation.json比对保持；API、账单、调用日志和持久化格式保持。

实际统一入口命令：rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-tools-ui/run.mjs baseline-v1 baseline.mjs --wait-slot；rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-tools-ui/run.mjs build-v4 build.mjs --wait-slot；rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-tools-ui/run.mjs validation-v3 qa.mjs --wait-slot。基线复现三项；core Node JS、受影响ESLint、Next16.2.3 webpack生产、standalone与TypeScript通过。真实PostgreSQL/生产Next/Chromium153.0.8010.12完成15项工具流程（十种工具/引擎实际缺配置503）、9项工具生命周期、15项目录/协议/媒体回归、8项路由请求流程、10项路由发送生命周期。原生双击单POST、取消/模式/SPA离页、完整正文超时、实际正文断连、401及账单/日志保持通过。loopback代理只持有、截取或中断真实网关503字节；未配置外部供应商凭据。

40组视觉为五视口320/390/768/1280/1440px×明暗×四语言，共240状态，工具/引擎、JSON错误、Portal及Escape焦点、真实503、展开wire JSON、44px与溢出通过。最低文字对比度5.30:1；最终桌面、320px英文与390px中文暗色截图已查看，SHA在visual-review.json。Base UI1px、aria-hidden、tabindex=-1隐藏表单输入按依赖语义排除可见溢出检查。正常pageerror/警告零，真实503网络错误独立记录。

性能基线为已验证请求/响应候选91eb2064f66157388149823081ad5a57a717e786，其工具面板保持原实现。同机器、实际数据库/会话及payload，禁缓存、GC、新context，4预热/32正式ABBA/BAAB。时间ms，heap/gzip bytes。

| 指标 | 基线 → 候选 | 变化 |
| --- | --- | --- |
| readyMs | 87.35 → 87.85 | 0.57% |
| initialHeap | 4587904.00 → 4909662.00 | 7.01% |
| selectionMs | 1.50 → 6.00 | 300.00% |
| selectionHeap | 5285572.00 → 6824664.00 | 29.12% |
| inputFrameMs | 13.30 → 13.40 | 0.75% |
| inputHeap | 5315604.00 → 6825050.00 | 28.40% |
| refusalMs | 33.15 → 19.15 | -42.23% |
| refusalHeap | 5488254.00 → 6933876.00 | 26.34% |
| scrollP95 | 16.70 → 16.70 | 0.00% |
| firstPageGzip | 260390.00 → 260158.00 | -0.09% |

全部静态gzip729477→729315（-0.02%），测量状态INVESTIGATE。Select选择从native change/公共option click至同一web-search模板，菜单获取不计入。inputFrame为真实input到下一rAF，含浏览器任务间隔；React纯渲染成本未量化。稳定选择边界优化后的固定公共控件成本按performance-investigation.json保留，超过10%的本批成本决定PENDING。前次测量与失败完整保留。

两版各48轮实际503发送，采样在发送已释放、下一rAF和GC后。后16轮同状态观察：before {"nodes":[340],"listeners":[357],"attached":[193]}；heap5793208→5871060bytes（1.34%）；after {"nodes":[331],"listeners":[360],"attached":[213]}；heap6348084→6402156bytes（0.85%）。残余堆增长归因未定，有限DOM/监听器结果支持本次观察，长期留存另行验证。

证据/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-tools-ui包含源码/运行冻结、生产验收、成本与留存、原始失败和资源报告。构建16.796s、RSS2994356224bytes，套件92.457s、RSS1012662272bytes。swap0→0、卷级磁盘增量/缓存位置见resource-summary.json；复用735项依赖链接与共享webpack缓存，下载零，预算4GiB。运行、数据库、秘密与本任务租约已清理。候选与必要父运行按待决成本和集成引用保留。

请求/响应、目录与认证/导航、供应商、API密钥、用户列表、用户详情、模型用量六批各自待决，审计/可靠性/工具配置/调用记录已各自接受。工具成本接受只用于本批，候选链决定满足后本地集成并清理。simulator为后续范围。真实供应商成功、服务器至供应商取消、D1/MySQL/Docker、其他平台/浏览器、读屏/触屏/IME/缩放/密度、移动性能、非法链接的全页错误视觉及部署未验证。回滚本批UI/生命周期提交并重建恢复请求/响应基线中的旧工具面板；数据格式保持。
