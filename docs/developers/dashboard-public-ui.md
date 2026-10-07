# 总览公共 UI

/dashboard 使用公共PageHeader、ControlButton、Field/Input、Table、Badge、Spinner及ShellError，统一8张KPI卡片、模型/用户分布、Token趋势、近期请求/错误和时间范围。卡片采用语义surface、border、radius及文字token；保留Recharts、四位金额、Token、延迟、8项KPI及全部操作入口。分布表保留4列，桌面图表与表格按完整宽度排列，窄视口使用表格内部横向滚动。近期5项日志和5项错误保持全局近期口径；success/error/incomplete/cancelled使用独立状态tone。

统计和币种分别拥有取消与完整正文20秒预算。新范围隐藏旧统计并保留分布视图的组件身份；成功提交新数据，失败清除结果。离页和替换范围取消所属请求，用户显式重新读取。币种未确认时暂停所有财务金额。响应校验当前端点的完整KPI、行身份与唯一键、计数、有限财务、百分比、时间及延迟。初始Today范围采用已确认的业务时区日界，自定义墙钟转换为UTC，非法或倒序输入在请求前反馈。成功空范围仍保留今日及全局近期信息，范围图表使用空状态。

图表采用明暗主题分类色、语义轴与网格及主题Tooltip。图表动效为200ms，并响应公共减少动态效果设置；用户/模型切换提供pressed状态和焦点保持，趋势图支持键盘访问实际Tooltip。最终五视口320/390/768/1024/1440px、明暗主题和四语言共34组验收通过，实际文字最低5.16:1、图表扇区最低5.47:1。桌面、中文手机的卡片、图表和近期日志样张已人工查看。四语言各新增4项读取/范围提示，原译文保持，新增依赖0。

PostgreSQL UTC查询修复独立集成到主仓4b1d918d0d45367e52ea9d47d2bb080fddf841f7：范围聚合、活跃用户、时序和吞吐量使用UTC instant，小时/日bucket采用UTC，与连接时区解耦。原基线61条真实日志的模型分布完整，而KPI为0、趋势为空；真实三种连接时区回归与主仓6项相关回归通过。原UI连同该修复冻结为性能基线，详情见dashboard-postgres-utc.md。

实际入口为rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-dashboard-ui/run.mjs <阶段> <脚本> --wait-slot。candidate-build-v2/build.mjs完成core NodeJS、受影响ESLint、Next16.2.3 webpack生产、standalone及TypeScript。calendar-evidence-v1/candidate.mjs完成19项真实页面，覆盖KPI、表格/图表、业务日界与自定义UTC、5项近期日志/错误、真实HTTP500、非法币种/延迟、空范围、显式重读、保留身份及实际日志路由。lifecycle-v2/lifecycle.mjs完成5项真实loopback代理生命周期，覆盖离页/范围取消、两读取20秒正文预算和真实401。最终pageerror0，HTTP500的控制性失败日志保留。

性能使用62条真实日志、10个模型、12行用户分布，4预热/32正式ABBA/BAAB、新上下文、禁缓存及GC。两侧包含相同UTC修复；范围实际请求数61→62，用户/模型切换采用相同键盘流程。首屏计时到10行及确认币种，图表扇区完成另行检查后采样列表heap；候选响应减少动态效果，原图表使用既有Recharts动效。单位：时间ms，heap/gzip bytes。

| 指标 | 基线 → 候选 | 变化 | 技术状态 |
| --- | --- | --- | --- |
| readyMs | 136.00 → 140.15 | 3.05% | PASS |
| heap | 7434012.00 → 7010506.00 | -5.70% | PASS |
| rangeMs | 62.95 → 54.50 | -13.42% | PASS |
| rangeHeap | 7844994.00 → 7385508.00 | -5.86% | PASS |
| userViewMs | 4.10 → 3.20 | -21.95% | PASS |
| userHeap | 7921460.00 → 7844826.00 | -0.97% | PASS |
| modelViewMs | 3.85 → 3.10 | -19.48% | PASS |
| modelHeap | 7969196.00 → 7894388.00 | -0.94% | PASS |
| scrollP95 | 16.75 → 16.70 | -0.30% | PASS |
| firstPageGzip | 337074.00 → 338104.00 | 0.31% | PASS |

全静态gzip 720774→721808（0.14%）。本批性能PASS，全部指标在10%调查线内。UI集成依赖认证/导航、供应商管理、API密钥、用户列表、用户详情及模型用量分析各自的独立待决成本；审计日志和可靠性已各自接受，用户与供应商用量批次性能PASS。

证据、源码/运行/脚本指纹及资源报告为/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-dashboard-ui。复用735项依赖链接及webpack缓存，下载0；资源报告记录实际命令、档位、输出/缓存位置、耗时、峰值RSS、swap和卷级磁盘变化。运行数据库、秘密、进程与租约清理通过，候选和必要基线保留供集成。回滚UI候选提交并重建恢复原总览页；UTC修复按其独立提交回滚，持久化业务记录保持。D1/MySQL/Docker、其他平台/浏览器、读屏/触屏/IME/缩放/显示密度、移动性能、真实供应商与部署分别验收。
