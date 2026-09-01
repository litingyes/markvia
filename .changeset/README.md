# Changesets

为公开包的 API、功能或行为变更创建 changeset：

```bash
pnpm changeset
```

选择实际发生变更的公开包，并选择 `patch`、`minor` 或 `major`。五个公开包会按统一版本一起升级。

以下变更不需要 changeset：

- 仅文档变更
- 仅测试变更
- 仅 CI 或开发工具变更

Changeset 文件应与代码变更一起提交到 Pull Request，不要手动修改版本号或 CHANGELOG。
