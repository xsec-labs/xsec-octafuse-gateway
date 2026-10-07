# 总览 PostgreSQL 时间范围

总览 KPI、活跃用户、请求/用户 Token 时序和最近一分钟吞吐量按 UTC instant 查询。API 的无偏移 `YYYY-MM-DD HH:mm:ss` 边界先声明为 UTC，ISO 时间与显式偏移保持其含义。时序 bucket 采用 UTC 小时/日期，与 D1 时间串契约一致；业务时区仍负责今日窗口与页面自定义时间输入。

真实 PostgreSQL 基线使用 Asia/Shanghai 连接：61 条实际请求在模型分布中完整返回，而总览 KPI 为 0、趋势为空。范围聚合和时序曾直接把无偏移边界传入 TIMESTAMPTZ 比较，数据库按连接时区解释；bucket 的 timestamp 转换也采用连接时区。

回归位于 `packages/core/src/db/postgres/dashboard-utc-range.integration.test.ts`。向已迁移的隔离 PostgreSQL 设置 DATABASE_URL 后，运行 `rtk npx --no-install tsx --test packages/core/src/db/postgres/dashboard-utc-range.integration.test.ts`。覆盖 UTC、Asia/Shanghai、America/Los_Angeles，SQL/ISO/显式偏移、包含与排除结束边界、跨 UTC 日界的小时/日 bucket、使用量/金额/活跃用户和真实最近一分钟吞吐量。旧实现在 Asia/Shanghai 的包含边界读取 0 而预期 2；修复后通过。

查询修复保留数据库记录、API 结构、金额精度和其他驱动。回滚该提交并重建恢复原查询行为。D1、MySQL、Docker 和其他平台未在本次 PostgreSQL 回归中运行。
