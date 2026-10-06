# Octafuse 公共认证与导航 UI

登录表单、四语言选择器、桌面导航、移动抽屉和错误反馈使用版本化公共 tokens 0.1.2 / UI React 0.1.5。NextIntl继续维护en/zh/ja/ko文案与NEXT_LOCALE Cookie；公共主题对应zh-CN，跟随系统明暗和减少动效，Portal继承同一设置。17个导航入口和19个Admin路由消费根布局；业务页控件继续按页面迁移。

## 行为与生命周期

会话读取失败显示独立错误和重新读取入口。登录及退出仅在取得HTTP成功与完整success确认后改变认证状态。语言写入核对HTTP、success及已选locale，再刷新服务端文案。读取与写入采用各自请求所有者、20秒完整body预算、替换/卸载取消及单次写入保护；用户明确重新读取或重提。已经到达服务器的写入可能在客户端取得确认前生效，界面展示当前确认边界，并提供会话或语言状态读取。

业务时区只有在取得成功结构及有效IANA值后才开放相关业务页。读取失败时导航和退出仍可使用，业务内容等待主动重读。首次确认后，刷新期间保留页面实例和未提交草稿，隐藏业务内容并将Context标记为加载；成功后使用新确认时区显示页面，失败时显示独立错误。真实配置页验证保存时区、完整响应延迟、socket失败和主动重读均保留另一字段草稿，且该草稿未写入数据库。401保留既有会话失效事件入口；客户端收到权限拒绝后更新认证状态。该事件拥有明确的Host根布局消费方，沿用既有API消费者。

桌面256px侧栏在767px及以下切换到顶栏与公共Drawer。Base UI负责焦点陷阱、Escape、关闭恢复和嵌套Select；跨布局切换解除模态状态。公共操作目标至少44px，跳至内容链接支持键盘导航。五视口主内容宽度分别为1184/768/564/390/320px，页面根宽度匹配视口。供应商业务页在320px仍有标题区主操作内部裁切，该业务页完整迁移另行处理。

## 分发与验证

vendor/xsec-ui内两个tgz与release.json保存公开编译JavaScript、声明、CSS、许可证和SHA256。新增15项包记录；996项现有安装记录的版本与integrity保持，四语言旧值保持且新键同构。复用既有React19.2.5、React DOM、类型包和其余依赖；新增公共依赖单独缓存，React真实解析位置一致。Docker的Admin/Proxy/迁移依赖阶段在npm ci前取得固定vendor包。

候选受影响ESLint、Next webpack生产构建、standalone产物检查和类型通过。真实PostgreSQL/Next/透明HTTP代理/Chromium153通过16类流程和5视口；pageerror0，错误凭据401一次、预期socket错误三次、真实缺表500一次分别保留。实际登录和退出的成功响应只传输首字节、延迟余下body，客户端20秒后提示未确认；读取服务端实际会话分别确认已登录和已撤销。退出会取消尚在等待的时区读取。

最终64项正式采样及8项预热采用1440×600、40供应商、同Asia/Shanghai时区、同服务端会话、新浏览器上下文、禁用缓存、GC后堆内存、ABBA/BAAB顺序。结果为成本待决定：登录就绪63.75→64.75ms（+1.57%）；语言下拉冷打开32.25→62.75ms；供应商就绪71.15→117.60ms（+65.28%）；登录堆3,357,600→3,939,918bytes（+17.34%）；供应商堆4,383,436→4,964,344bytes（+13.25%）；首屏gzip185,780→235,273bytes（+26.64%）；完整gzip610,155→675,041bytes（+10.63%）；滚动P95为16.8→16.7ms。

网络时间记录确认旧版的时区与供应商读取并行；候选在时区确认后启动供应商生命周期，因此页面就绪包含确认顺序和组件成本。含Base UI/Floating标记的初始chunk为148,432raw /50,266gzip bytes；V8初始运行和下拉打开均记录执行活动。该证据提供运行线索，模块精确归属仍需编译stats。移动Drawer按需加载。

最终构建17.140s，峰值RSS2,973,745,152bytes，swap0→0，控制器记录磁盘增量51,167,232bytes；完整浏览器验收66.935s，峰值RSS907,018,240bytes；最终性能67.743s，峰值RSS944,635,904bytes。控制器分配共享target b27abc052fc82fd663abf2de544f62647354f97863b0f2e84f2f7411b472e557；实际Next输出与缓存位于任务worktree的packages/admin/.next，基线输出位于证据目录before/packages/admin/.next。依赖通过链接复用主仓node_modules，公共增量依赖位于证据目录public-dependencies/node_modules。当前状态为候选已验收、等待本产品成本决定；主仓保持34e643f12d557a774a86c14bd9602bbef0b264b5。主仓回读和资源回收按本地集成后的验收记录补充。证据目录为 /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-public-auth-navigation-ui。类型/构建入口为run.mjs candidate-build-v9 candidate-build.mjs --wait-slot，真实UI为candidate-browser-final candidate-browser.mjs --wait-slot，补充回归为timezone-draft-final timezone-preservation.mjs，性能为perf-final performance.mjs，归因为chunk-coverage-final chunk-coverage.mjs；均以rtk node执行并带--wait-slot，先status/changed计划后使用共享单槽。

## 回滚与验证范围

回滚本批UI提交并重建可以恢复前一版布局；同时恢复vendor和锁文件。服务端会话认证契约保留，已执行的登录/退出和审计事件按真实数据库状态处理。Windows/Linux/Intel macOS、Safari/Firefox、读屏/触屏/输入法、移动性能、Docker镜像运行、云OpenNext与生产部署分别验收。
