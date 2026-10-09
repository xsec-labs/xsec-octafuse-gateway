# 工具调用记录公共 UI

/gateway/tools/invocations 使用公共 PageHeader、Section、Field、Select、ControlButton、Table、Drawer、Tabs、Badge、Spinner、EmptyState 与 ShellError。筛选与详情统一明暗主题、44px 控件、焦点、间距和窄屏布局。表格在自身区域横向滚动；窄屏详情纵向展示请求、结果列表及 JSON。金额说明提示保留，standard/charged/metered/profit 的计算与格式保持。公共时间控件由请求日志与调用记录共享；共享响应解析器原样移到 lib/gateway-log-api.ts。

URL 查询先校验再发出一次列表读取：工具别名规范到 id，状态仅接受已声明值，页码必须为安全正整数，重复参数及非法 UTC 日期明确失败。空或单边时间范围保持查询语义，链接到请求日志保留 model/status/UTC 范围并从第一页开始。业务墙钟应用后只转换一次 UTC，反向自定义范围关联错误并聚焦起点。列表和币种各有独立所有者、取消及 20 秒完整正文预算；切换筛选先清除旧结果并取消旧读，迟到的响应无法覆盖新结果。离页取消，401 交给既有会话所有者。读取失败显示显式错误及重新读取操作；币种失败暂停金额展示。实际 GET500 从基线空列表改为读取错误。

详情使用明确按钮、公共 Drawer 与 Tabs；键盘 Enter 打开，方向键移动 Tab 焦点、Enter 激活，Escape 关闭并恢复触发器焦点。损坏的存储 JSON 和非法摘要结构显示错误并保留内容，合法旧引擎字段与单页抓取摘要保持。结果链接校验 HTTP/HTTPS，其他协议保留可读文本并显示反馈。列表拥有稳定组件身份，确认行与币种变化时更新；详情交互复用确认列表，避免重复渲染和解析全部行。四语言各新增八项反馈，原有 1559 项译文叶子、包与锁保持；新增依赖零。

统一入口 rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-tool-invocations-ui/run.mjs validation-v3 validate.mjs --wait-slot，依次运行 core NodeJS、受影响 ESLint、Next16.2.3 webpack 生产、standalone、TypeScript、真实流程、生命周期、视觉与性能。14 项真实流程、7 项生命周期及 40 组 320/390/768/1280/1440px、明暗与四语言通过。隔离 PostgreSQL 包含 61 条真实日志、50/11 分页、筛选、损坏存储、数据库表暂时改名造成 GET500、币种错误及实际会话失效。loopback 代理验证读取消、迟到实际响应、完整正文超时；浏览器实际离线后可显式回读。请求日志共享解析/时间控件和真实详情回归通过。公共 Select/Drawer Portal 边界、焦点恢复、Tab 面板、44px 目标和文字最低 5.30:1 通过；最终桌面及手机样张已查看，正常页面 console/pageerror 零。

性能采用 4 预热/32 正式 ABBA/BAAB，新上下文、禁缓存、GC，同一实际数据库与会话。首屏等同一查询的 50 条记录及确认币种；详情等同一行请求与三个结果，基线展开行和候选 Drawer 从实际鼠标操作开始计时；筛选从 native change/公共 option click 到 15 条实际记录，选项获取不计入。时间 ms，heap/gzip bytes。

| 指标 | 基线 → 候选 | 变化 |
| --- | --- | --- |
| readyMs | 115.55 → 114.10 | -1.25% |
| heap | 5101516.00 → 5336576.00 | 4.61% |
| detailOpenMs | 10.90 → 18.80 | 72.48% |
| detailHeap | 5996862.00 → 6656430.00 | 11.00% |
| filterMs | 25.90 → 33.15 | 27.99% |
| filterHeap | 5893214.00 → 7325440.00 | 24.30% |
| scrollP95 | 16.70 → 16.75 | 0.30% |
| firstPageGzip | 226986.00 → 238862.00 | 5.23% |

全部静态 gzip 720721→726901（0.86%）。性能状态 INVESTIGATE，本批成本决定 PENDING。首轮成本与列表渲染优化的对照见 performance-investigation.json；连续每版 48 轮详情打开/JSON/关闭及两次筛选后 GC，后 16 轮 heap before 7199544–7373312 bytes，波动 2.41%；after 9551308–9698136 bytes，波动 1.54%。DOM、监听器及快照构造器比较见 retention-v1-retention.json。该有限场景只说明实际观察到的留存，其他操作另行验证。

证据目录 /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-tool-invocations-ui 包含源码、候选与父运行 SHA、验收、视觉审查、性能调查及资源报告。最终整套 105.51s，峰值 RSS 2936668160 bytes；swap、卷级磁盘增量及共享缓存见资源报告。复用 735 项依赖链接、webpack 缓存与父运行，下载零。运行数据库、秘密、进程与租约已清理。候选及必要父基线保留用于待决集成，共享缓存按引用保持。认证/导航、供应商、API 密钥、用户列表、用户详情及模型用量六批仍各自待决；审计日志、可靠性与工具配置已接受。当前产品候选待集成。

回滚本批 UI 提交并重建，可恢复原调用记录页；本批保持 API 和持久化格式。D1/MySQL/Docker、其他平台/浏览器、读屏/触屏/IME/缩放/显示密度、移动性能、真实供应商及部署另行验收。
