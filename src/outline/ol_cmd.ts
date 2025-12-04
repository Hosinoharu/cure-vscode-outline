/**
 * @module olcmds
 * @description 实现 `outline tree view` 的命令
 */

import * as vscode from "vscode";
import { CureSymbolTreeItem, CureSymbolTreeItemHandler, CureSymbolTreeProvider } from "./ol_view";
import { debounce, throttle } from "../common";
import { HighlightItems, OutlineSortType, SwitchCmdType } from "../types/symbol";

/** 关于 SymboolTreeView 视图的命令的实现与注册，需要传入控制的 tree view 哟 */
export class CureSymbolTreeViewCMD {
    private static instance?: CureSymbolTreeViewCMD;
    private readonly item_handler: CureSymbolTreeItemHandler;

    private constructor(
        private readonly provider: CureSymbolTreeProvider,
        private readonly view: vscode.TreeView<CureSymbolTreeItem>
    ) {
        if (CureSymbolTreeViewCMD.instance) {
            throw new Error("CureTreeViewCMD is already initialized!");
        }
        CureSymbolTreeViewCMD.instance = this;
        CureSymbolTreeItemHandler.register(provider, view);
        this.item_handler = CureSymbolTreeItemHandler.Instance;
    }

    /** 获取单例 */
    public static get Instance() {
        if (!this.instance) {
            throw new Error("CureTreeViewCMD is not initialized!");
        }
        return this.instance;
    }

    /** 注册所有此类的命令 */
    public static register(
        ctx: vscode.ExtensionContext,
        provider: CureSymbolTreeProvider,
        view: vscode.TreeView<CureSymbolTreeItem>
    ) {
        const self = new CureSymbolTreeViewCMD(provider, view);
        self.init_all_context();
        const commands = [
            self.register_reload_symbol(),

            // 开关类命令的注册
            self.register_expand_all(),
            self.register_expand_all_off(),

            self.register_sort_by_position(),
            self.register_sort_by_position_off(),

            self.register_sort_by_name(),
            self.register_sort_by_name_off(),

            self.register_sort_by_kind(),
            self.register_sort_by_kind_off(),

            self.register_filter_no_local_var(),
            self.register_filter_no_local_var_off(),

            self.register_filter_no_global_var(),
            self.register_filter_no_global_var_off(),

            self.register_follow_cursor(),
            self.register_follow_cursor_off(),

            self.register_follow_viewport(),
            self.register_follow_viewport_off(),
        ];
        ctx.subscriptions.push(...commands);
        return self;
    }

    // #region 注册：重新加载当前文件的符号

    private readonly cmd_reload_symbol = "cure-outline.reload-symbol";

    private register_reload_symbol() {
        return vscode.commands.registerCommand(this.cmd_reload_symbol, async () => {
            // 获取当前打开的文档 uri
            const uri = vscode.window.activeTextEditor?.document.uri;
            if (uri) {
                await this.provider.reload_symbol(uri);
            }
        });
    }

    // #endregion

    // ==================================
    //       下面是开关类命令的注册
    // ==================================

    //#region 开关式命令的上下文管理

    // 开关式命令：具备【开启、关闭】两种状态的命令，比如【全部折叠、全部展开】就是【一对开关命令】
    // 开关式上下文是为了在菜单中可以显示【已启用、未启用】两种状态
    // 上下文的命名格式如下：加入 `expand-all` 是开关命令，那么 `expand-off` 就是关闭命令
    // 那么上下文 `cure-outline-is-expand-all` 就是开关式上下文
    // 注意：在执行开关类命令的时候，需要【更新上下文】哟

    private init_all_context() {
        // 默认情况下不展开
        this.update_switch_context("expand-all-off");
        this.update_switch_context("expand-only-one-off");
        // 默认排序方式为 position
        this.update_sort_context("position");
    }

    /** 更新开关式命令的上下文，此类上下文命名格式：`cure-outline-is-xxx`
     * - 比如传入 `expand-all`，这说明上下文 `ure-outline-is-expand-all` 为 `true`
     * - 比如传入 `expand-all-off`，这说明上下文 `ure-outline-is-expand-all` 为 `false`
     */
    private update_switch_context(type: SwitchCmdType) {
        const index = type.indexOf("-off");
        const is_on = index < 0;
        const name = is_on ? type : type.slice(0, index);

        vscode.commands.executeCommand("setContext", `cure-outline-is-${name}`, is_on);
    }

    /** 更新排序的上下文。 只有在切换排序方式的时候，才需要更新上下文！
     *
     * 将另外两个排序的上下文设置为 `false` 就可以不显示那两个了
     */
    private update_sort_context(type: OutlineSortType) {
        // 修改其它排序方式的上下文
        const sorts: OutlineSortType[] = ["position", "name", "kind"];
        sorts.forEach((v) => {
            if (v !== type) {
                vscode.commands.executeCommand("setContext", `cure-outline-is-sort-by-${v}`, false);
            } else {
                // 别忘了把自己给设置
                vscode.commands.executeCommand("setContext", `cure-outline-is-sort-by-${v}`, true);
            }
        });
    }

    //#endregion

    //#region 注册：折叠与展开全部

    private readonly cmd_expand_all = "cure-outline.expand-all";
    private readonly cmd_expand_all_off = "cure-outline.expand-all-off";

    private register_expand_all() {
        return vscode.commands.registerCommand(this.cmd_expand_all, () => {
            this.update_switch_context("expand-all");
            this.item_handler.expand_all(true);
        });
    }

    private register_expand_all_off() {
        return vscode.commands.registerCommand(this.cmd_expand_all_off, () => {
            this.update_switch_context("expand-all-off");
            this.item_handler.expand_all(false);
        });
    }

    //#endregion

    // #region 注册：符号的排序
    // 其实排序的 -off 命令什么都不需要做啦，但必须要有，否则点击时会报错

    private readonly cmd_sort_by_position = "cure-outline.sort-by-position";
    private readonly cmd_sort_by_position_off = "cure-outline.sort-by-position-off";

    private register_sort_by_position() {
        return vscode.commands.registerCommand(this.cmd_sort_by_position, () => {
            this.update_sort_context("position");
            this.provider.sort_by("position");
        });
    }

    private register_sort_by_position_off() {
        return vscode.commands.registerCommand(this.cmd_sort_by_position_off, () => {});
    }

    private readonly cmd_sort_by_name = "cure-outline.sort-by-name";
    private readonly cmd_sort_by_name_off = "cure-outline.sort-by-name-off";

    private register_sort_by_name() {
        return vscode.commands.registerCommand(this.cmd_sort_by_name, () => {
            this.update_sort_context("name");
            this.provider.sort_by("name");
        });
    }

    private register_sort_by_name_off() {
        return vscode.commands.registerCommand(this.cmd_sort_by_name_off, () => {});
    }

    private readonly cmd_sort_by_kind = "cure-outline.sort-by-kind";
    private readonly cmd_sort_by_kind_off = "cure-outline.sort-by-kind-off";

    private register_sort_by_kind() {
        return vscode.commands.registerCommand(this.cmd_sort_by_kind, () => {
            this.update_sort_context("kind");
            this.provider.sort_by("kind");
        });
    }

    private register_sort_by_kind_off() {
        return vscode.commands.registerCommand(this.cmd_sort_by_kind_off, () => {});
    }

    //#endregion

    //#region 注册：符号的过滤

    private readonly cmd_filter_no_local_var = "cure-outline.filter-no-local-var";
    private readonly cmd_filter_no_local_var_off = "cure-outline.filter-no-local-var-off";

    private register_filter_no_local_var() {
        return vscode.commands.registerCommand(this.cmd_filter_no_local_var, () => {
            this.update_switch_context("filter-no-local-var");
            this.provider.filter_by("no_local_var");
        });
    }

    private register_filter_no_local_var_off() {
        return vscode.commands.registerCommand(this.cmd_filter_no_local_var_off, () => {
            this.update_switch_context("filter-no-local-var-off");
            this.provider.filter_by("no_local_var");
        });
    }

    private readonly cmd_filter_no_global_var = "cure-outline.filter-no-global-var";
    private readonly cmd_filter_no_global_var_off = "cure-outline.filter-no-global-var-off";

    private register_filter_no_global_var() {
        return vscode.commands.registerCommand(this.cmd_filter_no_global_var, () => {
            this.update_switch_context("filter-no-global-var");
            this.provider.filter_by("no_global_var");
        });
    }

    private register_filter_no_global_var_off() {
        return vscode.commands.registerCommand(this.cmd_filter_no_global_var_off, () => {
            this.update_switch_context("filter-no-global-var-off");
            this.provider.filter_by("no_global_var");
        });
    }

    //#endregion

    //#region 注册：follow cursor

    private readonly cmd_follow_cursor = "cure-outline.follow-cursor";
    private readonly cmd_follow_cursor_off = "cure-outline.follow-cursor-off";

    /** 根据行、列，查找距离它最近的 tree item
     * - 如果 line、col 正好在某个 tree item 的位置，则返回该 item
     * - 否则，返回距离它最近的两个 item，向上、向下一个，说明它在两个 item 之间
     * @returns 返回数组
     * - 只有一个元素，则说明位于该 item 中
     * - 有两个元素，则说明位于两个 item 之间
     * - 没有元素
     */
    private get_closer_item(
        _items: CureSymbolTreeItem[],
        range: vscode.Range
    ): HighlightItems<CureSymbolTreeItem> {
        // 需要先对 items 进行复制，然后按位置排序
        // 因为 items 是引用，如果直接对 items 排序，那么排序后的结果会影响到原始的 items
        const items = [..._items].sort((a, b) => (a.is_before(b) ? -1 : 1));

        /** 向上看，最靠近的 item */
        let up_closer_item: CureSymbolTreeItem = items[0];
        /** 向下看，最靠近的 item */
        let down_closer_item: CureSymbolTreeItem = items[items.length - 1];

        // 比第一个符号还靠前、比最后一个符号还靠后，那就不展示了
        if (up_closer_item.is_after(range) || down_closer_item.is_before(range)) {
            return {};
        }

        for (const item of items) {
            // 这说明在 item 的内部！
            if (item.is_contains(range, false)) {
                // 继续向下查看是在哪个子元素中
                if (item.Children.length > 0) {
                    const sub_result = this.get_closer_item(item.Children, range);
                    return sub_result.first === undefined ? { first: item } : sub_result;
                }
                return { first: item };
            }
            // 更新最靠近的 item 咯
            else {
                // 更新向上看最靠近的 item
                // 如果它在 target 前面、在 up_closer_item 后面，则更新 up_closer_item
                if (item.is_before(range) && item.is_after(up_closer_item)) {
                    up_closer_item = item;
                }

                // 更新向下看最靠近的 item
                if (item.is_after(range) && item.is_before(down_closer_item)) {
                    down_closer_item = item;
                }
            }
        }

        return up_closer_item.equal(down_closer_item)
            ? { first: up_closer_item }
            : { first: up_closer_item, second: down_closer_item };
    }

    /** 根据鼠标位置，高亮其所在的符号、或者最靠近鼠标的上下两个符号 */
    private async follow_cursor(editor: vscode.TextEditor) {
        const position = editor.selection.active;
        const line = position.line;
        const col = position.character;
        const closer_item = this.get_closer_item(
            this.provider.Items,
            new vscode.Range(line, col, line, col)
        );
        // 至少有一个，同时需要更新才能继续
        if (!closer_item.first) {
            return this.item_handler.unhilight();
        }
        if (!this.item_handler.check_update_highlight(closer_item)) {
            return;
        }

        let { first, second } = closer_item;
        // 都具备 parent 但不是相同层级！那么将 second 作废吧
        if (first.parent && second?.parent && !first.parent.equal(second.parent)) {
            console.log("[warn] follow_cursor: parent not equal:", first.name, " - ", second.name);
            second = undefined;
        }
        if (second) {
            // console.log("follow_cursor", first.name, " - ", second.name);
            this.item_handler.highlight(first, second);
        } else {
            // console.log("follow_cursor:", first.name);
            this.item_handler.highlight(first);
        }
    }

    private cancel_follow_cursor?: vscode.Disposable;

    private register_follow_cursor() {
        const debounce_follow_cursor = debounce(this.follow_cursor.bind(this), 200);
        return vscode.commands.registerCommand(this.cmd_follow_cursor, () => {
            this.update_switch_context("follow-cursor");
            // 先折叠所有，然后根据当前鼠标位置，展开最近的 item
            this.update_switch_context("expand-all-off");
            this.item_handler.expand_all(false);
            const editor = vscode.window.activeTextEditor;
            editor && debounce_follow_cursor(editor);

            this.cancel_follow_cursor = vscode.window.onDidChangeTextEditorSelection((e) => {
                if (this.view.visible) {
                    debounce_follow_cursor(e.textEditor);
                }
            });
        });
    }

    private register_follow_cursor_off() {
        return vscode.commands.registerCommand(this.cmd_follow_cursor_off, () => {
            this.update_switch_context("follow-cursor-off");
            this.cancel_follow_cursor?.dispose();
        });
    }

    //#endregion

    // #region 注册：follow viewport

    private readonly cmd_follow_viewport = "cure-outline.follow-viewport";
    private readonly cmd_follow_viewport_off = "cure-outline.follow-viewport-off";
    private cancel_follow_viewport?: vscode.Disposable;

    private async follow_viewport(editor: vscode.TextEditor) {
        const ranges = editor.visibleRanges;
        if (ranges.length === 0) {
            return;
        }
        const bottom_line = ranges[0].end.line;
        // 获取最靠近这一行的 item
        const closer_item = this.get_closer_item(
            this.provider.Items,
            new vscode.Range(bottom_line, 0, bottom_line, 0)
        );
        // if (closer_item.length === 1) {
        //     // console.log("follow_viewport:", closer_item[0].name);
        //     await this.item_handler.highlight(closer_item[0]);
        // } else if (closer_item.length === 2) {
        //     await this.item_handler.highlight(closer_item[1]);
        // }
    }

    private register_follow_viewport() {
        const throttle_follow_viewport = throttle(this.follow_viewport.bind(this), 200);
        return vscode.commands.registerCommand(this.cmd_follow_viewport, () => {
            this.update_switch_context("follow-viewport");
            // 先折叠所有，然后根据当前位置，展开最近的 item
            this.update_switch_context("expand-all-off");
            this.item_handler.expand_all(false);
            const editor = vscode.window.activeTextEditor;
            editor && throttle_follow_viewport(editor);

            // 监听编辑器滚动，当【点击符号】跳转时，也会触发滚动事件
            this.cancel_follow_viewport = vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
                if (this.view.visible && this.item_handler.is_follow_viewport_ok) {
                    throttle_follow_viewport(e.textEditor);
                }
            });
        });
    }

    private register_follow_viewport_off() {
        return vscode.commands.registerCommand(this.cmd_follow_viewport_off, () => {
            this.update_switch_context("follow-viewport-off");
            this.cancel_follow_viewport?.dispose();
        });
    }

    //#endregion
}
