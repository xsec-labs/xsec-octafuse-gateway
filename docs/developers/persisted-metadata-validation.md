# 持久化 metadata 读取校验

`getUserInfo` 和 `getKeyInfo` 在预算周期懒重置前解析持久化 metadata。损坏的 JSON 显式抛出 `INVALID_PERSISTED_METADATA`，附带 `ownerType`、`ownerId` 和固定的安全 SyntaxError cause。读取失败不会执行随后预算重置或新增重置审计。JSON 原文及可能引用它的解析器消息不进入该诊断。

起点 `d6d3ee45b1fdee45db0a416994878471fd8cb074` 将损坏 JSON 转为 null，并可能在读取过程中重置预算。真实 PostgreSQL 与 Next HTTP 对照确认起点为 HTTP200/null，修正后为 HTTP500。八类合法存储值保持响应契约：SQL null、空字符串、对象、数组、false、0、字符串和 JSON null。schema 与依赖保持。

证据目录：`/Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-user-detail-ui`。

```sh
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-user-detail-ui/run.mjs metadata-build-v1 candidate-build.mjs --wait-slot
rtk node /Users/xiaosong/.codex/visualizations/2026/10/02/01a0faad-6517-7cd3-90b5-b818bc64660d/octafuse-user-detail-ui/run.mjs metadata-regression-v2 metadata-regression.mjs --wait-slot
```

统一构建槽执行 core Node 公开入口编译、详情目录 ESLint、Next webpack 生产构建、standalone 与 TypeScript，五项通过。构建为21.739秒，峰值进程树RSS 3,124,936,704 bytes，swap 0→0，卷级磁盘增量23,429,120 bytes。

回归14项通过：真实PostgreSQL、Next HTTP、编译后的core Node公开导出和Chromium；损坏用户/密钥读取保留预算与审计，错误码与安全cause可回读，Next日志不含随机存储标记。浏览器显示读取失败，可写输入数0，pageerror 0。该运行7.549秒，峰值RSS 345,653,248 bytes，swap 0→0，卷级增量135,168 bytes，源码指纹保持。隔离数据库及服务进程已清理，统一租约已释放。

编译缓存复用`/Users/xiaosong/dev/xsec-labs/.worktree-cache`；core/dist为本任务独立副本，父候选运行资产保持。该修正仍位于用户详情候选链上。其他core调用者可能观察到损坏存储读取显式失败，需修复实际存储数据后主动重读。Cloud D1/OpenNext、Docker及其他平台尚需对应环境验证。

回滚本修正并重建恢复起点解析行为；Git回滚不修复持久化数据。该变更不迁移或覆盖业务数据。
