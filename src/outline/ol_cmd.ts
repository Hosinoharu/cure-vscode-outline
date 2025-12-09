/**
 * @module olcmds
 * @description 实现 `outline tree view` 的命令
 */

import * as vscode from "vscode";
import { CureSymbolTreeItem, CureSymbolTreeItemHandler, CureSymbolTreeProvider } from "./ol_view";
import { debounce } from "../common";
import { HighlightItems } from "../types/symbol";
import { follow_cursor_interval, follow_viewport_interval } from "../settings";
import * as olstorage from "./ol_storage";
import { CureOneSymbol } from "../symbol";

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
        olstorage.init_all_context();
        const commands = [
            self.register_reload_symbol(),

            // 开关类命令的注册
            self.register_expand_all(),
            self.register_expand_all_off(),

            self.register_expand_item_all(),
            self.register_expand_item_all_off(),

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
            const doc = vscode.window.activeTextEditor?.document;
            if (doc) {
                await this.provider.reload_symbol(doc);
            }
        });
    }

    public run_reload_symbol() {
        vscode.commands.executeCommand(this.cmd_reload_symbol);
    }

    // #endregion

    //#region 注册：折叠与展开全部

    private readonly cmd_expand_all = "cure-outline.expand-all";
    private readonly cmd_expand_all_off = "cure-outline.expand-all-off";

    private register_expand_all() {
        return vscode.commands.registerCommand(this.cmd_expand_all, () => {
            olstorage.update_switch_context("expand-all");
            this.item_handler.expand_all(true);
        });
    }

    private register_expand_all_off() {
        return vscode.commands.registerCommand(this.cmd_expand_all_off, () => {
            olstorage.update_switch_context("expand-all-off");
            this.item_handler.expand_all(false);
        });
    }

    //#endregion

    //#region 注册：折叠与展开一个item的全部层级

    private readonly cmd_expand_item_all = "cure-outline.expand-item-all";
    private readonly cmd_expand_item_all_off = "cure-outline.expand-item-all-off";

    private register_expand_item_all() {
        return vscode.commands.registerCommand(
            this.cmd_expand_item_all,
            (item: CureSymbolTreeItem) => this.item_handler.expand_item_all(item, true)
        );
    }

    private register_expand_item_all_off() {
        return vscode.commands.registerCommand(
            this.cmd_expand_item_all_off,
            (item: CureSymbolTreeItem) => this.item_handler.expand_item_all(item, false)
        );
    }

    //#endregion

    //#endregion

    // #region 注册：符号的排序
    // 其实排序的 -off 命令什么都不需要做啦，但必须要有，否则点击时会报错

    private readonly cmd_sort_by_position = "cure-outline.sort-by-position";
    private readonly cmd_sort_by_position_off = "cure-outline.sort-by-position-off";

    private register_sort_by_position() {
        return vscode.commands.registerCommand(this.cmd_sort_by_position, () => {
            this.provider.sort_by("position");
        });
    }

    private register_sort_by_position_off() {
        return vscode.commands.registerCommand(this.cmd_sort_by_position_off, () => {});
    }

    /** 取消 sort_by_position 时（也就是切换排序方式且不为 position 时）需要执行一些操作 */
    public when_sort_by_position_off() {
        // 需要取消 follow viewport 哟
        if (olstorage.get_follow_viewport()) {
            this.run_follow_viewport_off();
            return vscode.window.showInformationMessage(
                "Follow Viewport disabled, because sort type is not 'by position'"
            );
        }
    }

    private readonly cmd_sort_by_name = "cure-outline.sort-by-name";
    private readonly cmd_sort_by_name_off = "cure-outline.sort-by-name-off";

    private register_sort_by_name() {
        return vscode.commands.registerCommand(this.cmd_sort_by_name, () => {
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
            this.provider.filter_by("no-local-var");
        });
    }

    private register_filter_no_local_var_off() {
        return vscode.commands.registerCommand(this.cmd_filter_no_local_var_off, () => {
            this.provider.filter_by("no-local-var");
        });
    }

    private readonly cmd_filter_no_global_var = "cure-outline.filter-no-global-var";
    private readonly cmd_filter_no_global_var_off = "cure-outline.filter-no-global-var-off";

    private register_filter_no_global_var() {
        return vscode.commands.registerCommand(this.cmd_filter_no_global_var, () => {
            this.provider.filter_by("no-global-var");
        });
    }

    private register_filter_no_global_var_off() {
        return vscode.commands.registerCommand(this.cmd_filter_no_global_var_off, () => {
            this.provider.filter_by("no-global-var");
        });
    }

    //#endregion

    //#region 注册：follow cursor

    private readonly cmd_follow_cursor = "cure-outline.follow-cursor";
    private readonly cmd_follow_cursor_off = "cure-outline.follow-cursor-off";

    /** 根据行、列，查找距离它最近的 tree item
     * - 如果 line、col 正好在某个 tree item 的位置，则返回该 item
     * - 否则，返回距离它最近的两个 item，向上、向下一个，说明它在两个 item 之间
     * @returns
     * - 只有一个元素，则说明位于该 item 中
     * - 有两个元素，则说明位于两个 item 之间
     * - 没有元素
     */
    private get_closer_item(
        _items: CureSymbolTreeItem[],
        range: vscode.Range
    ): HighlightItems<CureSymbolTreeItem> {
        if (_items.length === 0) {
            return {};
        }
        // 需要先对 items 进行复制，然后按位置排序
        // 因为 _items 是引用，如果直接对 _items 排序，那么排序后的结果会影响到原始的数据啦
        const items = CureOneSymbol.sort_by_position([..._items]);

        // 因为 items 已经按位置排序了，所以可以二分查找，而不是遍历 —— 额，好像也没有多少提升
        let i_start = 0;
        let i_end = items.length - 1;

        /** 向上看，最靠近的 item */
        let up_closer_item: CureSymbolTreeItem = items[i_start];
        /** 向下看，最靠近的 item */
        let down_closer_item: CureSymbolTreeItem = items[i_end];

        // 比第一个符号还靠前、比最后一个符号还靠后，那就不展示了
        if (up_closer_item.is_after(range) || down_closer_item.is_before(range)) {
            // 现在调整了查询范围，找子元素了
            // 如当前高亮 A、B，然后进入到 B 对象中，从里面找子项，结果没找到
            // 这就说明它位于【父元素中】，应该高亮该父元素
            // 如果是顶层元素，则正好 parent 为 undefined 哟，刚刚好！！
            return { first: up_closer_item.parent };
        }

        while (i_start < i_end) {
            const i_mid = Math.floor((i_start + i_end) / 2);
            const item = items[i_mid];

            // 这说明在 item 的内部
            if (item.contains(range, false)) {
                // 继续向下查看是在哪个子元素中
                if (item.Children.length > 0) {
                    const sub_result = this.get_closer_item(item.Children, range);
                    return sub_result.first === undefined ? { first: item } : sub_result;
                }
                return { first: item };
            }
            // 形如 [up...item...range.....down]，更新 up
            else if (item.is_before(range)) {
                up_closer_item = item;
                i_start = i_mid + 1;
            }
            // 形如 [up...range...item...down]，更新 down
            else {
                down_closer_item = item;
                i_end = i_mid;
            }
        }

        if (down_closer_item.contains(range, false)) {
            return { first: down_closer_item };
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
        const range = new vscode.Range(line, col, line, col);
        if (this.item_handler.is_highlight_range_changed(range)) {
            const search_items = this.item_handler.get_search_items(range);
            const closer_item = this.get_closer_item(search_items, range);
            this.highlight_items(closer_item, "follow_cursor");
        }
    }

    /** 提取出来的方法，因为 `follow cursor、follow viewport` 都会用到
     * @param title 用于调试时标记
     */
    private highlight_items(closer_item: HighlightItems<CureSymbolTreeItem>, title: string) {
        // 至少有一个，同时需要更新才能继续
        if (!closer_item.first) {
            return this.item_handler.unhighlight();
        }
        if (!this.item_handler.check_update_highlight(closer_item)) {
            return;
        }

        let { first, second } = closer_item;
        // 都具备 parent 但不是相同层级！那么将 second 作废吧
        if (first.parent && second?.parent && !first.parent.equal(second.parent)) {
            console.log(`[warn] ${title}: parent not equal:`, first.name, "-", second.name);
            second = undefined;
        }
        if (second) {
            console.log(title, ":", first.name, "-", second.name);
            // 只有按位置排序排序时，才需要高亮两个表示位于【两个符号中间】
            if (this.provider.sort_type === "position") {
                this.item_handler.highlight(first, second);
            } else {
                this.item_handler.unhighlight();
                console.log("unhighlight cause sort type is not by position");
            }
        } else {
            console.log(title, ":", first.name);
            this.item_handler.highlight(first);
        }
    }

    private cancel_follow_cursor?: vscode.Disposable;

    private register_follow_cursor() {
        const debounce_follow_cursor = debounce(
            this.follow_cursor.bind(this),
            follow_cursor_interval
        );
        return vscode.commands.registerCommand(this.cmd_follow_cursor, () => {
            olstorage.toggle_follow_cursor(true);
            this.item_handler.enable_follow_cursor(true);
            const editor = vscode.window.activeTextEditor;
            editor && debounce_follow_cursor(editor);
            if (this.cancel_follow_cursor) {
                return;
            }
            this.cancel_follow_cursor = vscode.window.onDidChangeTextEditorSelection((e) => {
                if (this.view.visible && this.item_handler.CanFollowCursor) {
                    debounce_follow_cursor(e.textEditor);
                }
            });
        });
    }

    private register_follow_cursor_off() {
        return vscode.commands.registerCommand(this.cmd_follow_cursor_off, () => {
            olstorage.toggle_follow_cursor(false);
            this.cancel_follow_cursor?.dispose();
            this.cancel_follow_cursor = undefined;
            this.item_handler.unhighlight();
        });
    }

    private run_follow_cursor() {
        vscode.commands.executeCommand(this.cmd_follow_cursor);
    }

    /** 根据配置项调用一次 follow cursor 功能。返回是否开启了该功能 */
    public start_follow_cursor() {
        const open = olstorage.get_follow_cursor();
        open && this.run_follow_cursor();
        return open;
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
        const top_line = ranges[0].start.line;
        const bottom_line = ranges[0].end.line;
        const center_line = Math.floor((top_line + bottom_line) / 2);
        const range = new vscode.Range(center_line, 0, center_line, 0);
        if (this.item_handler.is_highlight_range_changed(range)) {
            const search_items = this.item_handler.get_search_items(range);
            const closer_item = this.get_closer_item(search_items, range);
            this.highlight_items(closer_item, "follow_viewport");
        }
    }

    private register_follow_viewport() {
        const debounce_follow_viewport = debounce(
            this.follow_viewport.bind(this),
            follow_viewport_interval
        );
        return vscode.commands.registerCommand(this.cmd_follow_viewport, () => {
            if (this.provider.sort_type !== "position") {
                return vscode.window.showInformationMessage(
                    "Follow Viewport only works when sort type is 'by position'"
                );
            }
            olstorage.toggle_follow_viewport(true);
            this.item_handler.enable_follow_viewport(true);
            const editor = vscode.window.activeTextEditor;
            editor && debounce_follow_viewport(editor);
            if (this.cancel_follow_viewport) {
                return;
            }
            // 监听编辑器滚动，注意，当【点击符号】跳转时，也会触发滚动事件 —— 此时需要忽略啦
            this.cancel_follow_viewport = vscode.window.onDidChangeTextEditorVisibleRanges((e) => {
                if (
                    this.view.visible &&
                    this.item_handler.CanFollowViewport &&
                    this.provider.sort_type === "position"
                ) {
                    debounce_follow_viewport(e.textEditor);
                }
            });
        });
    }

    private register_follow_viewport_off() {
        return vscode.commands.registerCommand(this.cmd_follow_viewport_off, () => {
            olstorage.toggle_follow_viewport(false);
            this.cancel_follow_viewport?.dispose();
            this.cancel_follow_viewport = undefined;
            this.item_handler.unhighlight();
        });
    }

    private run_follow_viewport() {
        vscode.commands.executeCommand(this.cmd_follow_viewport);
    }

    private run_follow_viewport_off() {
        vscode.commands.executeCommand(this.cmd_follow_viewport_off);
    }

    /** 根据配置项调用一次 follow viewport 功能 */
    public start_follow_viewport() {
        const open = olstorage.get_follow_viewport();
        open && this.run_follow_viewport();
        return open;
    }

    //#endregion
}
