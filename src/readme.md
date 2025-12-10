目录结构：

-   `/outline`: 实现 `outline tree view`
-   `/bookmark`: 实现 `bookmark tree view`

因为上述目录中存在同名文件，为了便于在 `IDE` 中区分，所以有了下面的约定：

-   文件以 `ol_` 开头表示其位于 `outline`
-   文件以 `bm_` 开头表示其位于 `bookmark`

# 关于命令的注册与调用

使用 `CMD` 类来管理命令的实现与注册，具体见各种 `cmd` 结尾的文件。

其编写规范如下：

-   全都以单例模式实现
-   提供一个 `static register` 方法，用于注册命令，只能在这里初始化单例

在内部实现命令时，以 `xxx` 命令为例：

-   提供一个 `private readonly cmd_xxx` 成员记录命令的名称
-   根据需要，提供一个 `public run_xxx` 方法，用于执行一次该命令的主要功能
    如果插件内部需要调用命令，首先用这个 API！
-   根据需要，如果命令中会修改配置项，则提供一个 `public core_xxx` 方法
    -   它包含该命令的全部实现 —— 除了修改配置项
    -   这样做的用处是：当监听到配置项修改时，就调用 `core_xxx` 方法来执行，而不是调用命令 —— 那就会导致循环啦
    -   注意**在其内部判断是否需要重复执行命令**，可以根据临时保存的配置项来判断。
    -   如果该命令中不会添加事件也不担心重复执行，那该 API 可以整合到 `run_xxx` 中
-   提供一个 `private register_xxx` 方法用于注册命令，内部调用上面的 `core_xxx` 方法，同时可修改配置项
-   根据需要，提供一个 `public execute_xxx` 方法，使用 `vscode.commands.executeCommand` 来调用命令
-   根据需要，提供一个 `public create_xxx` 方法，用于创建 `Command` 类型

举例说明。

```js
// 1. 有一个 `reload_symbol` 命令重新加载文档符号，因为插件内部也会调用该命令，所以提供了 `run_xxx` 方法
public async run_reload_symbol();
// 然后注册命令时，调用 `run_xxx` 方法
private register_reload_symbol() {
    return vscode.commands.registerCommand(this.cmd_reload_symbol, async () => {
        this.run_reload_symbol();
    });
}



// 2. follow viewport 功能会监听文档滚动，来实时高亮 Tree Item
// 提供该 API 在指定文档中执行 follow viewport
private _run_follow_viewport(editor: vscode.TextEditor);
// 但是第一次启用功能的时候，需要触发一次当前文档的 follow viewport
// 同时，插件其它地方也需要执行该功能，所以才有了这个 API
private run_follow_viewport();
// 然后该命令触发时会修改配置项，所以有了 core_xxx API
// 在监听到配置项修改时，也会调用该 API，该 API 增加判断性代码避免重复调用！
public core_follow_viewport() {
    if (this.cancel_follow_viewport !== undefined) { return; }
    // 先在当前文档执行一次
    this.run_follow_viewport();
    // 然后监听文档变化，实时高亮 Tree Item
    this.cancel_follow_viewport = vscode.window.onDidChangeTextEditorVisibleRanges((e) =>
        this._run_follow_viewport(e.textEditor)
    );
}
// 那么注册的命令中只需要修改配置项了
 private register_follow_viewport() {
    return vscode.commands.registerCommand(this.cmd_follow_viewport, () => {
        // ...
        olstorage.toggle_follow_viewport(true);
        this.core_follow_viewport();
    });
}



// 3. 在切换排序方式时，会禁用 follow viewport 功能，所以有了这个 API
// 因为我希望禁用 API 的时候能实时更新配置项，所以没有调用 `core_xxx` API，而是直接执行命令
private execute_follow_viewport_off() {
    vscode.commands.executeCommand(this.cmd_follow_viewport_off);
}
```
