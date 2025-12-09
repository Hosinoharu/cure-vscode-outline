这里定义了插件所需要的 `contributes` 配置。

**通过执行命令 `npm run gen` 生成 `package.json` 文件中的 `contributes` 配置项**。会将 `package.json` 中的 `main` 字段指向 `out/extension.js`，说明这是测试阶段开发

`npm run gen-package` 命令作用相同，但会将 `main` 字段指向 `dist/extension.js`，说明这是打包

`package-copy.json` 是原始 `package.json` 的备份且具备空的 `contributes` 字段 ，防止生成过程中出问题。

# 注意项

创建用于表示当前功能已经被选中的 `context` 上下文时，其规范：

```js
{
    command: "cure-outline.expand-all",
    // cure-outline-is- 是固定的形式，后面则是该命令的名称
    when: "!cure-outline-is-expand-all",
    group: "navigation",
}
{
    // 命令后面带有 off 表示取消该功能咯
    command: "cure-outline.expand-all-off",
    when: "cure-outline-is-expand-all",
    group: "navigation",
}
```
