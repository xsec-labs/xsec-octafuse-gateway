# Playground 发送生命周期

真实生产 Next、隔离 PostgreSQL 和浏览器基线复现了两项问题：SPA 离页后，等待返回的 Playground POST 在一秒观察预算内仍保持连接；读取 25165868 bytes 的真实 WAV 文件时，原生鼠标双击发送产生两次 POST。前者由发送请求缺少页面取消所有者导致，后者由发送状态在异步 FileReader 转换后才设定导致。

路由发送现在由一个 AbortController 拥有，从文件读取开始覆盖 HTTP 头、完整 JSON/文本正文及流读取。同步 ref 在首个 await 前认领操作，渲染状态锁定输入和目录。显式取消、模式切换、离页终止该操作，取消后的结果无法更新页面。用户取消显示独立状态；完整正文超时显示 REQUEST_TIMEOUT，失败保留已取得的响应状态和内容。流读取在 finally 释放 reader 锁。POST 401 通知已有会话所有者。

用户可设置 1–3600 的整数秒总时限，默认 300 秒，覆盖文件读取和完整响应。原实现等待时间无界；超过默认五分钟的供应商任务需要发送前调整时限。非法时限在发出请求前失败。发送和取消为显式用户动作。API、账单、日志与持久化格式保持。

readFileAsDataUrl 增加可选 AbortSignal，原有单参数调用保持。实际 FileReader 的完成、错误、同步读取错误和取消均移除 signal 监听器及 reader 处理器。媒体转换任一失败终止同一发送操作；请求对象使用转换完成后的媒体数据。

证据目录：/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-request-ui。

实际命令：

- `rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-request-ui/run.mjs baseline-v1 send-lifecycle-baseline.mjs --wait-slot`：两项真实基线复现，4.949s，峰值 RSS 1823260672 bytes。
- `rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-request-ui/run.mjs ownership-build-v2 build.mjs --wait-slot`：core Node JS、受影响 ESLint、Next 16.2.3 webpack 生产、standalone 和 TypeScript 通过，17.145s，峰值 RSS 2979102720 bytes。
- `rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-playground-request-ui/run.mjs ownership-checks-v1 ownership-checks.mjs --wait-slot`：10 项真实检查通过，6.028s，峰值 RSS 804945920 bytes。

检查包括非法时限不发送、显式取消及迟到响应、模式切换取消、SPA 离页取消、完整正文超时、断连后的所有者释放、显式再发送实际连接拒绝、24 MiB WAV 双击仅一次 POST、实际 FileReader 单参数与取消行为、实际 POST 401。超时检查设置一秒，实际 1334ms 显示失败并关闭响应。代理延迟或截取实际网关的 502 字节；供应商地址为 127.0.0.1:9。实际 api_key_request_logs 数量保持零，pageerror 零。

所有命令经统一资源入口记录 status、changed plan 和租约。复用 735 项依赖链接、共享 webpack 缓存与父运行，下载零。各次 swap 0→0；卷级磁盘增量及输出位置在各 run report。运行、数据库、临时 WAV、进程和本任务租约已清理。四语言各新增五项反馈，原译文叶子、包与锁保持；新增依赖零。

这是请求/响应公共 UI 迁移的生命周期前置提交。目录候选和六项前序成本决定保持各自范围；产品主分支集成等待该候选链的决定。请求/响应公共 UI 的后续候选及验收记录见 playground-request-response-public-ui.md；真实供应商成功返回、SSE 成功和流式中断路径、其他数据库/平台/浏览器及部署仍待验收。回滚本提交并重建恢复原发送行为；数据格式保持。
