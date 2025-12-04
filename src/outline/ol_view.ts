/**
 * @module olview
 * @description 实现展示符号的 `cure-outline tree view`
 */

import * as vscode from "vscode";
import crypto from "crypto";
import { CureOneSymbol, CureSymbolCMD } from "../symbol";
import { CureSymbolManager } from "./ol_manager";
import { HighlightItems, OutlineFilterType, OutlineSortType, TreeItemType } from "../types/symbol";
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
    /** 判断当前 item 是否位于顶层 */
    public get IsTopLevel() {
        return this.parent === undefined;
    }
    /** 该 item 的名称 */
    public readonly name: string;

    private constructor(label: string, symbol: CureOneSymbol) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.name = label;
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
        // item.description = symbol.detail || item.symbol.kind + " " + item.symbol.LineInfo;
        item.description = item.symbol.kind;
        // item.tooltip 被延迟赋值了哟，在 provider.resolveTreeItem API 中
        set_context_value(item, "symbol");
        item.reset_collapsible_state();
        return item;
    }

    /** 标记该 item 应该刷新，刷新之后应该重置其为 false */
    public should_refresh = false;

    /** 调用本方法后，说明 item 应该刷新！ */
    public ready_update() {
        this.id = crypto.randomUUID();
        this.should_refresh = true;
    }

    //#region 高亮元素
    // 核心思想：设置 item.label 时，可以指定 label 中的高亮部分
    // 从而实现高亮效果，虽然效果不太好就是了！

    private is_highlighted = false;
    /** 高亮元素或取消高亮，返回 true 表示操作成功。后期需要手动刷新 item。
     *
     * **只能在 `follow cursor、follow viewport` 时启用高亮**
     */
    public highlighten(ok: boolean) {
        if (ok === this.is_highlighted) {
            return false;
        }
        this.is_highlighted = ok;
        const label = ok
            ? ({ label: this.name, highlights: [[0, this.name.length]] } as vscode.TreeItemLabel)
            : this.name;
        this.label = label;
        this.ready_update();
        return true;
    }

    //#endregion

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
        this.ready_update();
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

    /** 判断 p 是否和 item 具备相同的父节点 */
    public is_same_top_parent(p: CureSymbolTreeItem) {
        const a = this.get_top_level();
        const b = p.get_top_level();
        return a.equal(b);
    }

    /** 一直向上找，找到顶层节点 */
    private get_top_level() {
        let p = this as CureSymbolTreeItem;
        while (p.parent) {
            p = p.parent;
        }
        return p;
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
        const is_global = this.IsTopLevel;
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
        if (item) {
            if (!item.should_refresh) {
                return;
            }
            item.should_refresh = false;
        }
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

    /** 加载一个文档的符号！ */
    async reload_symbol(doc: vscode.TextDocument) {
        const uri = doc.getText().trim() === "" ? undefined : doc.uri;
        const ok = await this.manager.update_file(uri);
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
        // 显示在 Title 后面
        // self.view.description = "description";
        // 显示在第一个 item 的上面
        // self.view.message = "message";
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
        //     console.log("expand:", e.element.name);
        // });
        // view.onDidCollapseElement((e) => {
        //     console.log("collapse:", e.element.name);
        // });

        // 当点击 item 时会触发，似乎可以替代【点击 item 时的事件】
        // 但重复点击时当然是不会重复触发的啦！
        // view.onDidChangeSelection((e) => {
        //     // 开启多选之后，就会有多个元素了
        //     console.log("selection:", e.selection[0].name);
        // });
    }

    /** 重置内部一些状态 */
    public reset_state() {
        this.is_follow_viewport_ok = true;
        this.last_expand_top_item = undefined;
        this.expaned_items.clear();
        this.unhilight();
    }

    //#region 关于 follow viewport

    /**
     * 当开启 `follow viewport` 时，
     * 【点击符号跳转到位置】、【follow cursor] 等都会触发 `follow viewport`。
     *
     * 所以有了这个标记，如果为 `false` 则说明当前很忙，不要触发 `follow viewport`
     */
    public is_follow_viewport_ok = true;
    /** 点击符号跳转到位置时，会修改滚动条，为了避免触发 `follow viewport`，
     * 所以给定等待时间才可以继续 `follow viewport`
     */
    private set_follow_viewport_ok() {
        setTimeout(() => {
            this.is_follow_viewport_ok = true;
        }, 200);
    }

    //#endregion

    //#region 展开与折叠的优化

    /** 优化功能【只展开一个 item】，其策略如下所述。
     *
     * # 关于非顶层节点的展开
     * 1. 当展开 A 时，记录它的 `parentId`，说明对应的 `parent item` 下面有一个展开项了
     * 2. 当展开 B 时，如果 B 的 `parentId` 已经存在（比如就等于 A 的 `parentId`），
     *    则说明有同层级的节点需要折叠，则获取 A
     * 3. 找 A 下面又展开了哪些子节点，这可以根据 A 的 id 来读取，
     *    依次将子项折叠（但不刷新 ui），递归循环
     * 4. 折叠 A 并刷新 A，从而刷新 ui
     * 5. 最后展开 B
     *
     * # 关于顶层节点的展开
     * 1. 当展开 A 时，如果它是顶层节点，则记录到成员 `last_expand_top_item`
     * 2. 当展开 B 时，如果它也是顶层节点，则折叠 `last_expand_top_item` 并刷新
     */
    private readonly expaned_items: Map<string, CureSymbolTreeItem> = new Map();
    /** 因为点击 item 时，默认只能展开一个，所以它记录上一次展开的顶层节点 */
    private last_expand_top_item?: CureSymbolTreeItem;

    /** 展开 item、折叠其它同层级 items，并增加一个记录
     *
     * @param [refhresh=false] 是否立即刷新
     */
    private record_expaned_item(item: CureSymbolTreeItem, refhresh = true) {
        // 展开顶层节点
        if (item.IsTopLevel) {
            if (this.last_expand_top_item && !item.equal(this.last_expand_top_item)) {
                this.unrecord_expaned_item(this.last_expand_top_item, true);
            }
            this.last_expand_top_item = item;
        }
        // 展开非顶层节点，那么先折叠同层级的
        else {
            this._collasep_same_level_item(item);
        }

        this.set_expand_state(item, true, refhresh);
    }

    /** 折叠 item、以及所有子项，并更新记录 */
    private unrecord_expaned_item(item: CureSymbolTreeItem, refhresh = true) {
        if (item.IsTopLevel) {
            this.last_expand_top_item = undefined;
        }
        if (this._collasep_recorded_item(item.UniqueId)) {
            item.ready_update();
        }
        this.set_expand_state(item, false, refhresh);
    }

    /** 折叠与 item 同级别的项，并增加 item 的记录 */
    private _collasep_same_level_item(item: CureSymbolTreeItem) {
        const parentId = item.parent?.UniqueId;
        if (!parentId) {
            return;
        }
        const same_level_item = this.expaned_items.get(parentId);
        if (same_level_item?.equal(item)) {
            return;
        }
        same_level_item && this.unrecord_expaned_item(same_level_item);
        this.expaned_items.set(parentId, item);
    }

    /** 递归折叠 `parentId` 下面的所有子项并更新记录，后续应该手动刷新 ui
     * @returns 返回 true 表示子项被改变了，上层应该标记需要刷新
     */
    private _collasep_recorded_item(parentId: string): boolean {
        const item = this.expaned_items.get(parentId);
        let changed = false;
        if (item) {
            this.set_expand_state(item, false, false);
            this.expaned_items.delete(parentId);
            // 递归折叠子项
            changed = this._collasep_recorded_item(item.UniqueId) || item.should_refresh;
        }
        return changed;
    }

    /** 修改 item 的折叠状态，同时承担刷新 ui 的职责
     * @param refhresh 为 true 则立即刷新，否则需要手续手动刷新
     */
    private set_expand_state(item: CureSymbolTreeItem, expand: boolean, refresh: boolean) {
        // 如果这里使用 item.xx === None 然后直接返回，那么将不会刷新 ui
        // 假如当前 item 修改了高亮元素，结果因为它无法折叠，所以不会刷新 ui
        // 所以！本函数一定要尝试刷新 ui 才行
        if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            item.set_collapsible_state(expand);
        }
        refresh && this.provider.refresh(item);
    }

    //#endregion

    //#region 折叠与展开一个item

    /** 展开一个 item，并且折叠同级别的 item。如果它已经展开，则折叠它 —— 该 API 仅用于【点击 item】时使用！
     *
     * 其问题如下，均由于 `view.reveal API` 的限制：
     * - 不能让元素居中（指的是在 tree view 垂直居中）
     * - 如果强制居中会丢失其它地方焦点，比如编辑文档时丢失光标 —— 当然点击 item 时就不会这么突兀
     * - 无法同时高亮多个元素？好像有配置项可以做到
     */
    public async expand_only_one(item: CureSymbolTreeItem) {
        this.is_follow_viewport_ok = false;

        if (item.collapsibleState === vscode.TreeItemCollapsibleState.Expanded) {
            this.unrecord_expaned_item(item);
        } else {
            this.record_expaned_item(item);
        }
        // 启用 focus 可以让该 item 展示在视图的中间
        await this.view.reveal(item, { focus: true });
        this.set_follow_viewport_ok();
    }

    //#endregion

    //#region 高亮item

    /** 记录当前高亮的 item */
    private readonly highlighted: HighlightItems<CureSymbolTreeItem> = {};

    /** 整理出来的方法。现在需要取消 item `h` 的高亮，需要传入另外两个当前需要高亮的 item */
    private _unhighlight(
        h: CureSymbolTreeItem,
        first: CureSymbolTreeItem,
        second?: CureSymbolTreeItem
    ) {
        // 发现重复，不需要处理
        if (first.equal(h) || second?.equal(h)) {
        } else {
            h.highlighten(false);
            if (!first.is_same_top_parent(h) || (second && !second.is_same_top_parent(h))) {
                // 因为需要取消它的高亮，所以在后面统一刷新，这里仅修改折叠
                this.unrecord_expaned_item(h, false);
            }
            this.provider.refresh(h);
        }
    }

    /** 取消之前的高亮并高亮当前 item，最多两个 item 并且一定不相同 */
    private _highlight(first: CureSymbolTreeItem, second?: CureSymbolTreeItem) {
        // 外部保证 first 和 second 是相同层级的
        const last_first = this.highlighted.first;
        this.highlighted.first = first;
        const last_second = this.highlighted.second;
        this.highlighted.second = second;

        // 高亮成功，说明 first 是新加入的
        if (first.highlighten(true)) {
        }
        // 高亮成功，说明 second 是新加入的
        if (second?.highlighten(true)) {
        }
        // 需要对之前的 item 取消高亮
        last_first && this._unhighlight(last_first, first, second);
        last_second && this._unhighlight(last_second, first, second);
    }

    /** 取消所有高亮 */
    public async unhilight() {
        const { first, second } = this.highlighted;
        first?.highlighten(false);
        second?.highlighten(false);
        this.highlighted.first = undefined;
        this.highlighted.second = undefined;
        this.provider.refresh(first);
        this.provider.refresh(second);
    }

    /** 在 follow cursor 时，高亮 item，折叠其它的 item！
     *
     * 最多高亮两个 item 哟，它们都是相同层级
     */
    public async highlight(first: CureSymbolTreeItem, second?: CureSymbolTreeItem) {
        if (!this.visible) {
            return;
        }

        /** 记录最后应该刷新的顶层 item */
        let refresh_item = first;
        // 向上展开 first 的父层级但不刷新 ui。 如果 first 位于顶层，根本不需要向上展开咯
        if (!first.IsTopLevel) {
            let parent = first;
            while (parent) {
                // 问题：如果当前 item 的 parent 是展开的，
                // 那么不会修改任何状态，根据不会刷新呀！
                // 后面在 #cure-fix-1 进行解决！
                this.record_expaned_item(parent, false);
                if (parent.should_refresh) {
                    refresh_item = parent;
                }
                if (!parent.parent) {
                    break;
                }
                parent = parent.parent;
            }
        }

        this._highlight(first, second);
        if (second) {
            // 具备 second 时，应该高亮 first、second 并且不展开它们！
            this.unrecord_expaned_item(first, false);
            this.unrecord_expaned_item(second, false);
            // 在顶层时，不能通过刷新 first、second 它们的父元素来刷新（因为都在顶层嘛），所以这里手动刷新
            if (first.IsTopLevel) {
                this.provider.refresh(first);
                this.provider.refresh(second);
            } else {
                // #cure-fix-1 必须让它们的 parent 可刷新！！！
                if (refresh_item.equal(first)) {
                    refresh_item = first.parent!;
                    refresh_item.ready_update();
                }
                this.provider.refresh(refresh_item);
            }
        } else {
            this.record_expaned_item(refresh_item);
        }
        await this.view.reveal(first);
    }

    /** 返回 true 表示需要更新高亮元素了。传入的 `items` 一定具备 `first` 项啦 */
    public check_update_highlight(items: HighlightItems<CureSymbolTreeItem>) {
        const { first, second } = items;
        const { first: last_first, second: last_second } = this.highlighted;

        let changed = true;
        if (last_first && first?.equal(last_first)) {
            changed = false;
        }
        if (second) {
            if (last_second?.equal(second)) {
                changed = false;
            } else {
                // 避免判断 first 时将其取反
                changed = true;
            }
        } else if (last_second) {
            // 没有 second，但以前有，说明之前的被移除了
            changed = true;
        }
        return changed;
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
        this.reset_state();
        this.set_items_expand(this.provider.Items, expand);
        this.provider.refresh();
    }

    // #endregion
}
