/**
 * @module olview
 * @description 实现展示符号的 `cure-outline tree view`
 */

import * as vscode from "vscode";
import crypto from "crypto";
import { CureOneSymbol, CureSymbolCMD } from "../symbol";
import { CureSymbolManager } from "./ol_manager";
import { OutlineFilterType, OutlineSortType, TreeItemType } from "../types/symbol";
import { set_context_value } from "../common";

/** 表示符号 tree view 的 item */
export class CureSymbolTreeItem extends vscode.TreeItem {
    /** 表示该 item 的类型 */
    public readonly type: TreeItemType = "symbol";
    /** 其对应的 symbol 哟 */
    public readonly symbol: CureOneSymbol;
    /** 其对应的 parent item。没有则说明是顶层的 tree item */
    public parent?: CureSymbolTreeItem;
    /** 这个 id 用于唯一表示该 item 且不变，并不是用于 tree view 中的 id！。
     *
     * 通过该 id 可以确定底层对应的符号啦
     */
    public get UniqueId() {
        return this.symbol.id;
    }
    /** 获取该 tree item 的 tooltips */
    public get Tooltip() {
        return this.symbol.Comment || this.symbol.name;
    }

    private constructor(label: string, symbol: CureOneSymbol) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.symbol = symbol;
    }

    /** 从普通符号创建一个 symbol tree item */
    static create_item(symbol: CureOneSymbol) {
        const item = new CureSymbolTreeItem(symbol.name, symbol);
        item.once_children = symbol.Children;
        item.iconPath = symbol.Icon;
        // #cure-warn 实现符号的点击
        // 点击该项时，打开文件、跳转对对应的位置咯，并且只展开它一个！
        // 添加 command 后，点击时不再会自动展开了，所以需要手动处理
        item.command = CureSymbolCMD.Instance.create_locate(symbol, async () => {
            await CureSymbolTreeItemHandler.Instance.expand_only_one(item);
        });
        item.description = symbol.detail || item.symbol.kind + " " + item.symbol.LineInfo;
        // item.tooltip 被延迟赋值了哟，在 provider.resolveTreeItem API 中
        set_context_value(item, "symbol");
        item.reset_collapsible_state();
        return item;
    }

    /** 修改它的折叠状态！
     * @param expand 是否展开
     * - `true` 则展开
     * - `false` 则折叠
     * - `undefined` 则不显示折叠与展开
     *
     * @returns 如果成功修改了则返回 true，后续应该手动刷新来应用效果
     */
    public set_collapsible_state(expand?: boolean) {
        const state =
            expand === undefined
                ? vscode.TreeItemCollapsibleState.None
                : expand
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed;

        if (this.collapsibleState === state) {
            return false;
        }

        // 有 children 还设置为 None？？可能是过滤的情况
        if (state === vscode.TreeItemCollapsibleState.None && this.Children.length !== 0) {
            const is_filter = this._filter_children && this._filter_children.length !== 0;
            // 有过滤后的 children，肯定不会设置为 None
            if (is_filter) {
                return false;
            }
        }

        this.collapsibleState = state;
        // item.collapsibleState 只能确定最初情况下的展开状态！
        // 即便点击【展开箭头】，它也不会改变！调用 view.reveal API 也不会改变其值！
        // 而且就算改变了它的值，刷新 tree view 也不会更新折叠状态！
        // 因为需要改变它在 tree view 中的 id 哟！
        this.id = crypto.randomUUID();
        return true;
    }

    /** 根据它是否有子元素，重置其折叠状态为【折叠】 */
    private reset_collapsible_state() {
        if (this.Children.length > 0) {
            this.set_collapsible_state(false);
        } else {
            this.set_collapsible_state();
        }
    }

    /** 判断两个 item 是否相等 */
    public equal(other: CureSymbolTreeItem) {
        return this.UniqueId === other.UniqueId;
    }

    //#region 符号位置上的判断-用于 follow by cursor 功能

    // 注意 symbol.range 和 symbol.selection_range 的区别！
    // 前者表示整个区域，比如对于函数来说，它涵盖了函数体
    // 后者表示符号自身的位置，比如对于函数来说，它只表示函数名
    // 如果是一个没有名字的函数，那么两者是一样的

    /** 判断当前 item 是否包含 other
     * @param selection 如果为 true，则仅查看符号名称的位置，否则查看整个符号的位置
     */
    public is_contains(other: vscode.Range | CureSymbolTreeItem, selection: boolean) {
        const range = other instanceof vscode.Range ? other : other.symbol.range;
        const p = selection ? "selection_range" : "range";
        return this.symbol[p].contains(range);
    }

    /** 判断当前 item 是否在 other 的后面（符号位置上） */
    public is_after(other: vscode.Range | CureSymbolTreeItem) {
        const range = other instanceof vscode.Range ? other : other.symbol.range;
        return this.symbol.range.start.isAfter(range.end);
    }

    /** 判断当前 item 是否在 other 的前面（符号位置上） */
    public is_before(other: vscode.Range | CureSymbolTreeItem) {
        const range = other instanceof vscode.Range ? other : other.symbol.range;
        return this.symbol.range.end.isBefore(range.start);
    }

    //#endregion

    // #region children

    /** Tree Item 的子项，一开始并不解析，等到展开的时候再做解析啦，并且会被清空！
     *
     * 也就是说，其它地方不要访问它！
     */
    private once_children: CureOneSymbol[] = [];
    /** 存储解析后的结果！ */
    private children?: CureSymbolTreeItem[];

    /** 获取 Item 的子项 */
    get Children(): CureSymbolTreeItem[] {
        if (this.children === undefined) {
            const parent = this;
            this.children = this.once_children.map((v) => {
                const item = CureSymbolTreeItem.create_item(v);
                item.parent = parent;
                return item;
            });
            // 清空原有的子项
            this.once_children = [];
        }

        return this.children;
    }

    set Children(v: CureSymbolTreeItem[]) {
        this.children = v;
    }

    /** 妥协的设计。临时存储一份过滤后的子节点便于后续展示。
     * 在重置过滤条件时，应该也重置本属性
     */
    public _filter_children?: CureSymbolTreeItem[];
    /** 重置属性，同时重置其折叠状态！ */
    public reset_filter_children() {
        this._filter_children = undefined;
        this.reset_collapsible_state();
        for (const child of this.Children) {
            child.reset_filter_children();
        }
    }

    // #endregion children

    /** 是否满足过滤的条件 */
    public is_match_filter(type: OutlineFilterType) {
        const kind = this.symbol.kind;
        // 没有父成员，说明是全局的哟
        const is_global = this.parent === undefined;
        const is_var = kind === "Variable" || kind === "Constant";

        switch (type) {
            case "no_local_var":
                return !is_global && is_var;
            case "no_global_var":
                return is_global && is_var;
            default:
                return false;
        }
    }
}

/** 提供符号的 TreeView Provider */
export class CureSymbolTreeProvider implements vscode.TreeDataProvider<CureSymbolTreeItem> {
    /** 本视图对应的 view id */
    public static readonly id = "cure-outline";
    /** 管理符号 */
    private readonly manager: CureSymbolManager;
    /** 表示 item 的排序类型 */
    private sort_type: OutlineSortType = "position";
    /** 表示 item 的过滤类型 */
    private filter_types: OutlineFilterType[] = [];
    /** 相当于一个缓存，它总是保存全部的符号。某些情况下需要重新获取符号树时，应该将其设置为 undefined */
    private items?: CureSymbolTreeItem[];
    /** 语法符号树信息 */
    public get Items(): CureSymbolTreeItem[] {
        if (this.items === undefined) {
            this.items = this.manager.Symbols.map(CureSymbolTreeItem.create_item);
        }
        return this.items;
    }

    constructor(manager: CureSymbolManager) {
        this.manager = manager;
    }

    // #region 处理tree_item

    getTreeItem(element: CureSymbolTreeItem): vscode.TreeItem {
        if (this.filter_types.length > 0) {
            element._filter_children = this.apply_filter(element.Children);
            // 子元素没有了，需要重新设置父元素的折叠状态
            // 必须在这里修改状态，所以才有了 _filter_children 这个妥协的设计
            if (element._filter_children.length === 0) {
                element.set_collapsible_state();
            }
        }
        return element;
    }

    getChildren(element?: CureSymbolTreeItem): Thenable<CureSymbolTreeItem[]> {
        if (element) {
            const items = element._filter_children ?? element.Children;
            return Promise.resolve(this.apply_sort(items));
        } else {
            return Promise.resolve(this.apply_sort(this.apply_filter(this.Items)));
        }
    }

    getParent(element: CureSymbolTreeItem): vscode.ProviderResult<CureSymbolTreeItem> {
        return element.parent;
    }

    resolveTreeItem(
        item: vscode.TreeItem,
        element: CureSymbolTreeItem,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.TreeItem> {
        // 因为获取符号上面的注释会增加消耗，且不是所有符号都会被查看 tooltips
        // 所以将其的获取放到这里，而不是在创建 item 的时候
        item.tooltip = element.Tooltip;
        return item;
    }

    //#region 过滤

    /** 返回 true 表示 element 满足过滤条件！ */
    private is_match_filter(element: CureSymbolTreeItem) {
        return this.filter_types.some((v) => element.is_match_filter(v));
    }

    /** 应用过滤条件 */
    private apply_filter(elements: CureSymbolTreeItem[]) {
        // 注意了，Array.filter(func) 中，是将 func(item) 返回为 true 的 item 筛选出来
        // 所以如果 item 满足过滤条件之后，还得取反
        return this.filter_types.length > 0
            ? elements.filter((v) => !this.is_match_filter(v))
            : elements;
    }

    //#endregion 过滤

    //#region 排序

    /** 大坑！因为是通过执行 vscode command 来获取符号的，不要视图认为符号默认以位置排序！
     * 因为它受到 vscode 自带的 outline 的配置项影响！
     *
     * 也就是说，如果 vscode 的 outline 配置项是按照名称排序的，那么获取的符号树也是按照名称排序的！
     */

    /** 下面排序的实现中不需要处理子元素，会在 `getChildren` 中处理啦 */

    /** 对 items 进行排序 */
    private apply_sort(items: CureSymbolTreeItem[]) {
        switch (this.sort_type) {
            case "name":
                this.sort_by_name(items);
                break;
            case "kind":
                this.sort_by_kind(items);
                break;
            default:
                this.sort_by_position(items);
                break;
        }
        return items;
    }

    private sort_by_name(items: CureSymbolTreeItem[]) {
        items.sort((a, b) => {
            return a.symbol.name.localeCompare(b.symbol.name);
        });
    }

    private sort_by_kind(items: CureSymbolTreeItem[]) {
        // 每个 kind 下的 item 应该按名称排序，所以先按照名称排序
        this.sort_by_name(items);
        items.sort((a, b) => {
            return a.symbol.kind.localeCompare(b.symbol.kind);
        });
    }

    private sort_by_position(items: CureSymbolTreeItem[]) {
        items.sort((a, b) => {
            return a.is_before(b) ? -1 : 1;
        });
    }

    //#endregion

    // #endregion 处理tree_item

    // #region 定义事件处理函数

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<
        CureSymbolTreeItem | undefined | void
    >();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /** 刷新视图或者刷新指定的 tree item */
    refresh(item?: CureSymbolTreeItem) {
        this._onDidChangeTreeData.fire(item);
    }

    /** 重新加载数据 */
    reload() {
        this.items = undefined;
        this.refresh();
    }

    /** 排序视图 */
    sort_by(type: OutlineSortType) {
        if (this.sort_type !== type) {
            this.sort_type = type;
            this.refresh();
        }
    }

    /** 过滤符号。如果已经应用过了，则取消该过滤 */
    filter_by(type: OutlineFilterType) {
        let ok = false;

        // 应用过滤
        if (!this.filter_types.includes(type)) {
            this.filter_types.push(type);
            ok = true;
        }
        // 取消过滤
        else {
            const old = this.filter_types.length;
            this.filter_types = this.filter_types.filter((v) => v !== type);
            ok = old !== this.filter_types.length;
        }

        if (ok) {
            for (const item of this.Items) {
                item.reset_filter_children();
            }
            this.refresh();
        }
    }

    /** 重新加载一个文本的符号！ */
    async reload_symbol(file: vscode.Uri) {
        const ok = await this.manager.update_file(file);
        ok && this.reload();
    }

    // #endregion 定义事件处理函数
}

/** 综合处理一些 Tree View Item 的操作以及给 tree view 添加事件。单例模式 */
export class CureSymbolTreeItemHandler {
    /** 记录当前 outline view 是否可见 */
    private visible = false;

    private static instance?: CureSymbolTreeItemHandler;

    private constructor(
        private readonly provider: CureSymbolTreeProvider,
        private readonly view: vscode.TreeView<CureSymbolTreeItem>
    ) {
        if (CureSymbolTreeItemHandler.instance) {
            throw new Error("CureSymbolTreeItemHandler is already initialized!");
        }
        CureSymbolTreeItemHandler.instance = this;
    }

    public static get Instance() {
        if (!this.instance) {
            throw new Error("CureSymbolTreeItemHandler is not initialized!");
        }
        return this.instance;
    }

    public static register(
        provider: CureSymbolTreeProvider,
        view: vscode.TreeView<CureSymbolTreeItem>
    ) {
        const self = new CureSymbolTreeItemHandler(provider, view);

        // 当切换到其它页面时，就是【隐藏】咯
        view.onDidChangeVisibility((e) => {
            // console.log("visibility changed:", e.visible);
            self.visible = e.visible;
        });

        // 可监听以下情况，但无法区分它们：
        // - 点击左侧箭头的展开与折叠
        // - 调用 view.reveal API 触发的展开（该 API 无法折叠）
        // - 默认情况下（没有给 tree item 添加 command 时），
        //   点击【item】时会自动展开、折叠
        //
        // 上面造成的【展开与折叠】并不能修改 item.collapsibleState 值
        // 也就是说 collapsibleState 只能确定【初次渲染】时折叠的状态
        //
        // ！！！不能在这里修改 item.collapsibleState 值，否则完全无法精确控制！
        // view.onDidExpandElement((e) => {
        //     console.log("expand:", e.element.label);
        // });
        // view.onDidCollapseElement((e) => {
        //     console.log("collapse:", e.element.label);
        // });

        // 当点击 item 时会触发，似乎可以替代【点击 item 时的事件】
        // 但重复点击时当然是不会重复触发的啦！
        // view.onDidChangeSelection((e) => {
        //     // 开启多选之后，就会有多个元素了
        //     console.log("selection:", e.selection[0].label);
        // });
    }

    //#region 折叠与展开一个 tree item

    /*
        根据我的目标：
        - 点击 item 时要展开它，再次点击折叠它
        - 同级别只能展开一个 item

        所以需要【详细控制每个 tree item】的折叠状态并及时刷新它们的展示，
        经过测试，使用 view.reveal API 是无法实现折叠的，只能展开，所以我只用它来进行【居中显示】

        所以，当展开一个 item 时，这样做：
        - 修改它的折叠状态为 true（展开中），刷新 ui
        - 折叠它的子项，刷新 ui
        - 折叠它的同层级项，刷新 ui
        - 居中显示它
    */

    /** 修改 item 的折叠状态
     * - 如果原来没有折叠状态，则返回 false
     * - 如果真的修改了状态，则返回 true
     * - 如果展开它，则可以控制是折叠一层 child item 还是不操作保持原样
     *
     * @param refhresh 为 true 则立即刷新，否则需要手续手动刷新
     * @param collapse_child 如果当前为展开状态，那么为 true 则折叠所有子元素，否则为 false 则不操作子元素
     */
    private set_expand_state(
        item: CureSymbolTreeItem,
        expand: boolean,
        refresh: boolean,
        collapse_child?: boolean
    ) {
        if (item.collapsibleState === vscode.TreeItemCollapsibleState.None) {
            return false;
        }

        const ok = item.set_collapsible_state(expand);
        if (expand && collapse_child && ok) {
            // 不递归调用，仅处理一层子项
            item.Children.forEach((v) => {
                v.Children.length > 0 && v.set_collapsible_state(false);
            });
        }
        // 在这里刷新 item 时会同时刷新子项啦
        ok && refresh && this.provider.refresh(item);
        return ok;
    }

    /** 展开一个 item，并且折叠同级别的 item。如果它已经展开，则折叠它 —— 该 API 仅用于【点击 item】时使用！
     *
     * 其问题如下，均由于 `view.reveal API` 的限制：
     * - 不能让元素居中（指的是在 tree view 垂直居中）
     * - 如果强制居中会丢失其它地方焦点，比如编辑文档时丢失光标 —— 当然点击 item 时就不会这么突兀
     * - 无法同时高亮多个元素？好像有配置项可以做到
     */
    public async expand_only_one(item: CureSymbolTreeItem) {
        const is_expand = item.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
        const is_none = item.collapsibleState === vscode.TreeItemCollapsibleState.None;
        const ok = this.set_expand_state(item, !is_expand, true);

        // 现在要展开它，则需要关闭同级别展开的哟
        if (is_none || (ok && !is_expand)) {
            const others = item.parent?.Children ?? this.provider.Items;
            others.forEach((v) => {
                !v.equal(item) && this.set_expand_state(v, false, false);
            });
            // 这里统一刷新
            const refresh_target = others === this.provider.Items ? undefined : item.parent;
            this.provider.refresh(refresh_target);
        }

        // 启用 focus 可以让该 item 展示在视图的中间
        await this.view.reveal(item, { focus: true });
    }

    /** 在 follow cursor 时，高亮一个 item，折叠其它的 item！ */
    public async highlight(item: CureSymbolTreeItem) {
        if (!this.visible) {
            return;
        }
        // 向上找父元素，依次展开它们，但不刷新 ui
        let parent = item;
        while (parent.parent) {
            this.set_expand_state(parent.parent, true, false);
            parent = parent.parent;
        }

        // 关闭同层级的，不需要刷新 ui
        item.parent?.Children.forEach((v) => {
            if (!v.equal(item)) {
                this.set_expand_state(v, false, false);
            }
        });

        //再切换它自身的状态，折叠所有子项
        this.set_expand_state(item, true, false, true);
        // 刷新最顶层的父元素 ui，实现展开！
        this.provider.refresh(parent);

        // 下面的这个循环正好给上面的【刷新】留下了时间，否则后续高亮特定元素时会失败（没有高亮效果）

        // 现在 parent 已经到了顶层了，那么再折叠其它顶层的 item 并立即刷新
        this.provider.Items.forEach((v) => {
            if (!v.equal(parent)) {
                this.set_expand_state(v, false, true);
            }
        });

        // 该 API 会强制切换到 tree view 上！也就是说会强制视图切换
        // 所以在当前函数顶部【判断视图是否可见】
        await this.view.reveal(item);
    }

    //#endregion

    //#region 折叠与展开全部

    /** 修改多个 items 折叠状态！*/
    private set_items_expand(items: CureSymbolTreeItem[], state: boolean) {
        items.forEach((v) => {
            this.set_expand_state(v, state, false);
            if (v.Children.length > 0) {
                this.set_items_expand(v.Children, state);
            }
        });
    }

    /** 全部折叠或全部展开 */
    public expand_all(expand: boolean) {
        this.set_items_expand(this.provider.Items, expand);
        this.provider.refresh();
    }

    // #endregion
}
