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
-   提供一个 `private register_xxx` 方法用于注册命令
-   根据需要，提供一个 `public create_xxx` 方法，用于创建 `Command` 类型
-   根据需要，提供一个 `public run_xxx` 方法，用于运行命令
