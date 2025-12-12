/**
 * @module olview
 * @description 实现展示符号的 `cure-outline tree view`
 */

import * as vscode from "vscode";
import crypto from "crypto";
import { CureOneSymbol, CureSymbolCMD } from "../symbol";
import { CureSymbolManager } from "./ol_manager";
import {
    HighlightItems,
    OutlineFilterType,
    OutlineSortType,
    TreeItemSymbol,
    TreeItemType,
} from "../types/symbol";
import { set_context_value } from "../common";
import { wait_for_follow_feature } from "../settings";
import { CureSymbolTreeViewCMD } from "./ol_cmd";
import { CureStorage } from "../storage";
import { create_item_resource_uri } from "./ol_decoration";

/** 表示符号 tree view 的 item */
export class CureSymbolTreeItem extends vscode.TreeItem implements TreeItemSymbol {
    /** 表示该 item 的类型 */
    public readonly type: TreeItemType = "symbol";
    /** 其对应的 symbol 哟 */
    public symbol: CureOneSymbol;
    /** 其对应的 parent item。没有则说明是顶层的 tree item */
    public parent?: CureSymbolTreeItem;
    /** 这个 id 用于唯一表示该 item 且不变，并不是用于 tree view 中的 id！*/
    public readonly UniqueId = crypto.randomUUID();
    /** 获取该 tree item 的 tooltips */
    public get Tooltip() {
        return this.symbol.Comment || this.symbol.name;
    }
    /** 判断当前 item 是否位于顶层 */
    public get is_top() {
        return this.parent === undefined;
    }
    /** 该 item 的名称 */
    public get name() {
        return this.symbol.name;
    }
    /** 获取子节点的个数 */
    public get children_length() {
        return this.symbol.children.length;
    }
    /** 是否为匿名的 symbol */
    public get is_anonymous() {
        // 不能通过是否具备 name 来判断，比如匿名函数名称为： `xx.map() callback`
        // 只能根据它的 range 来判断了。正因为它是匿名的，所以下面两个 range 是相等的！
        return this.symbol.range.isEqual(this.symbol.selection_range);
    }

    private constructor(label: string, symbol: CureOneSymbol) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.symbol = symbol;
    }

    /** 从普通符号创建一个 symbol tree item */
    static create_item(symbol: CureOneSymbol) {
        const item = new CureSymbolTreeItem(symbol.name, symbol);
        item.iconPath = symbol.Icon;
        // 点击该项时，打开文件、跳转对对应的位置咯，并且只展开它一个！
        // 添加 command 后，点击时不再会自动展开了，所以需要手动处理
        item.command = CureSymbolCMD.Instance.create_locate(item, async () => {
            await CureSymbolTreeItemHandler.Instance.expand_only_one(item);
        });
        item.resourceUri = create_item_resource_uri(symbol.kind);
        item.description = item.get_desc(symbol);
        // item.tooltip 被延迟赋值了哟，仅在 hover 时触发，在 provider.resolveTreeItem API 中
        set_context_value(item, "symbol");
        item.reset_collapsible_state();
        return item;
    }

    /** 生成 tree item 的描述信息 */
    private get_desc(symbol: CureOneSymbol) {
        return (symbol.children.length > 0 ? `(${symbol.children.length}) ` : "") + symbol.kind;
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

    private highlighted = false;
    /** 高亮元素或取消高亮，返回 true 表示操作成功。后期需要手动刷新 item。
     *
     * **只能在 `follow cursor、follow viewport` 时启用高亮**
     */
    public highlighten(ok: boolean) {
        if (ok === this.highlighted) {
            return false;
        }
        this.highlighted = ok;
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
        if (state === vscode.TreeItemCollapsibleState.None && this.children_length !== 0) {
            const is_filter = this.filted_children && this.filted_children.length !== 0;
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
        if (this.children_length > 0) {
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

    /** 判断当前 item 是否包含 other
     * @param selection 如果为 true，则仅查看符号名称的位置，否则查看整个符号的位置
     */
    public contains(other: vscode.Range | CureSymbolTreeItem, selection: boolean) {
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

    /** 存储解析后的结果！ */
    private children?: CureSymbolTreeItem[];

    /** 获取 Item 的子项 */
    get Children(): CureSymbolTreeItem[] {
        if (this.children === undefined) {
            const parent = this;
            this.children = this.symbol.children.map((v) => {
                const item = CureSymbolTreeItem.create_item(v);
                item.parent = parent;
                return item;
            });
        }

        return this.children;
    }

    set Children(v: CureSymbolTreeItem[]) {
        this.children = v;
    }

    /** 判断 p 是否和 item 具备相同的顶层节点 */
    public is_same_top_parent(p: CureSymbolTreeItem) {
        const a = this.get_top();
        const b = p.get_top();
        return a.equal(b);
    }

    /** 一直向上找，找到顶层节点 */
    private get_top() {
        let p = this as CureSymbolTreeItem;
        while (p.parent) {
            p = p.parent;
        }
        return p;
    }

    /** 妥协的设计。临时存储一份过滤后的子节点便于后续展示。
     * 在重置过滤条件时，应该也重置本属性
     */
    public filted_children?: CureSymbolTreeItem[];
    /** 重置属性，同时重置其折叠状态！ */
    public reset_filted_children() {
        this.filted_children = undefined;
        this.reset_collapsible_state();
        for (const child of this.Children) {
            child.reset_filted_children();
        }
    }

    // #endregion children

    /** 是否满足过滤的条件 */
    public is_match_filter(type: OutlineFilterType) {
        const kind = this.symbol.kind;
        const is_global = this.is_top;
        const is_var = kind === "Variable" || kind === "Constant";

        switch (type) {
            case "no-local-var":
                return !is_global && is_var;
            case "no-global-var":
                return is_global && is_var;
            case "no-property":
                return kind === "Property";
            default:
                return false;
        }
    }

    //#region 符号的更新

    /** 更新底层的 symbol，返回 true 说明要刷新本 item
     * @param refresh_it 刷新函数
     * @param refhresh_parent 标记它的父节点是否刷新
     * - 如果父节点刷新，那么在处理本节点时就不会刷新，等待父节点处理结束时统一刷新
     * - 如果父节点不刷新，那么在处理本节点时就会刷新
     * - 上面这样的设计是尽可能做最小化刷新啦
     */
    public update_new_symbol(
        new_symbol: CureOneSymbol,
        refresh_it: (item: CureSymbolTreeItem) => void,
        refhresh_parent: boolean
    ) {
        const last_symbol = this.symbol;
        let refresh = this.is_need_refresh(new_symbol);
        // 需要更新符号的 name、图标等
        if (refresh) {
            // console.log("update item's symbol:", last_symbol.name, "->", new_symbol.name);
            if (this.highlighted) {
                this.label = { label: new_symbol.name, highlights: [[0, new_symbol.name.length]] };
            } else {
                this.label = new_symbol.name;
            }

            if (last_symbol.kind !== new_symbol.kind) {
                this.iconPath = new_symbol.Icon;
                this.description = new_symbol.kind;
                this.resourceUri = create_item_resource_uri(new_symbol.kind);
            }
        }

        // 更新子节点
        const collpased = this.collapsibleState === vscode.TreeItemCollapsibleState.Collapsed;
        const expanded = this.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
        const children_changed = this.symbol.children.length !== new_symbol.children.length;
        if (
            // 1. 如果本节点没有展开过，所以直接替换子节点
            this.children === undefined ||
            // 2. 如果当前节点是折叠，也直接替换子节点！不需要刷新，因为展开的时候会自动刷新
            collpased ||
            // 3. 如果子节点个数变化，没办法了，直接替换
            children_changed
        ) {
            this.children = undefined;
            // 子节点个数变化时必然要刷新的，因为要更新父节点的描述信息：有几个子节点
            if (children_changed) {
                this.description = this.get_desc(new_symbol);
                refresh = true;
            }
        }
        // 3. 如果当前节点是展开的，那需要递归处理子节点，做到最小化刷新
        else if (expanded) {
            for (let i = 0; i < new_symbol.children.length; i++) {
                // 递归处理
                this.Children[i].update_new_symbol(new_symbol.children[i], refresh_it, refresh);
            }
        }

        // 保持现有的折叠状态，但前提是具备子元素
        if (new_symbol.children.length === 0) {
            this.set_collapsible_state();
        } else if (this.collapsibleState === vscode.TreeItemCollapsibleState.None) {
            // 因为改动了这里，说明当前正在编辑，所以将这里默认展开
            this.set_collapsible_state(true);
        }

        this.tooltip = undefined;
        this.symbol = new_symbol;
        if (!refhresh_parent && refresh) {
            this.ready_update();
            refresh_it(this);
            console.log("living update item:", this.name);
        }
        return refresh;
    }

    /** 在替换新符号时，判断是否应该刷新 */
    private is_need_refresh(new_symbol: CureOneSymbol) {
        // 只有符号名称、符号类型、有无子项（此处不判断这个）等变化时，才需要刷新
        return new_symbol.name !== this.symbol.name || new_symbol.kind !== this.symbol.kind;
    }

    //#endregion
}

/** 提供符号的 TreeView Provider */
export class CureSymbolTreeProvider implements vscode.TreeDataProvider<CureSymbolTreeItem> {
    /** 本视图对应的 view id */
    public static readonly id = "cure-outline";
    /** 管理符号 */
    private readonly manager: CureSymbolManager;
    /** 表示 item 的排序类型 */
    public get sort_type() {
        return CureStorage.Instance.sort_type;
    }
    /** 表示修改了排序方式，获取 TreeItem 时应该进行排序
     *
     * ## 为什么引入这个成员？
     * 这是为了尽可能减少排序的次数：
     * 1. `ol_manager` 提供的符号是**按照当前保存的排序方式**处理过了的
     * 2. 在 `ol_view` 中，如果排序方式没有变化，获取 TreeItem 时则不需要重新排序
     * 3. 当修改排序方式时，标记本成员为 true，表示获取 TreeItem 时应该进行排序 —— 因为现在使用的还是原来的数据嘛
     * 4. 当下一次从 `ol_manager` 获取新的符号时，将本成员设置为 false，因为现在得到的数据已经排好序了
     */
    private sort_changed = false;
    /** 表示 item 的过滤类型 */
    private get filter_type() {
        return CureStorage.Instance.filter_type;
    }
    public set FilterType(value: OutlineFilterType[]) {
        const old = this.filter_type;
        const changed = old.length !== value.length || old.some((v, i) => v !== value[i]);
        changed && this.refresh();
    }
    /** 相当于一个缓存，它总是保存全部的符号。某些情况下需要重新获取符号树时，应该将其设置为 undefined */
    private items?: CureSymbolTreeItem[];
    /** 语法符号树信息 */
    public get Items(): CureSymbolTreeItem[] {
        if (this.items === undefined) {
            this.sort_changed = false;
            this.items = this.manager.Symbols.map(CureSymbolTreeItem.create_item);
        }
        return this.items;
    }

    constructor(manager: CureSymbolManager) {
        this.manager = manager;
    }

    // #region 处理tree_item

    getTreeItem(element: CureSymbolTreeItem): vscode.TreeItem {
        if (this.filter_type.length > 0) {
            element.filted_children = this.apply_filter(element.Children);
            // 子元素没有了，需要重新设置父元素的折叠状态
            // 必须在这里修改状态才行，在其它地方修改还得重新刷新 item
            if (element.filted_children.length === 0) {
                element.set_collapsible_state();
            }
        }
        return element;
    }

    getChildren(element?: CureSymbolTreeItem): Thenable<CureSymbolTreeItem[]> {
        if (element) {
            const items = element.filted_children ?? element.Children;
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
        // 因为获取符号上面的注释会增加消耗，且不是所有符号都会被查看 tooltip
        // 所以将其的获取放到这里，而不是在创建 item 的时候
        item.tooltip = element.Tooltip;
        return item;
    }

    //#region 过滤

    /** 返回 true 表示 element 满足过滤条件！ */
    private is_match_filter(element: CureSymbolTreeItem) {
        return this.filter_type.some((v) => element.is_match_filter(v));
    }

    /** 应用过滤条件 */
    private apply_filter(elements: CureSymbolTreeItem[]) {
        return this.filter_type.length > 0
            ? elements.filter((v) => !this.is_match_filter(v))
            : elements;
    }

    //#endregion 过滤

    /** 对 items 进行排序 */
    private apply_sort(items: CureSymbolTreeItem[]) {
        // 不需要递归处理子元素，会在 `getChildren` 中处理啦
        return this.sort_changed ? CureOneSymbol.sort_by(this.sort_type, items) : items;
    }

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
            // console.log("refresh item:", item.name);
            item.should_refresh = false;
        }
        try {
            this._onDidChangeTreeData.fire(item);
        } catch (e: any) {
            console.warn("TreeView Refresh Error:", e.message);
        }
    }

    /** 重新加载数据，会重置现有符号树的折叠、高亮等状态 */
    private reload() {
        this.items = undefined;
        CureSymbolTreeItemHandler.Instance.reset_state();
        this.refresh();
    }

    /** 排序视图 */
    async sort_by(type: OutlineSortType) {
        if (this.sort_type === type) {
            return;
        }
        this.sort_changed = true;
        await CureStorage.Instance.set_sort_type(type);
        CureSymbolTreeItemHandler.Instance.unhighlight_before_change_sort();
        this.refresh();

        if (type !== "position") {
            CureSymbolTreeViewCMD.Instance.when_sort_by_position_off();
        }
    }

    /** 过滤符号。如果已经应用过了，则取消该过滤 */
    async filter_by(type: OutlineFilterType) {
        const old = this.filter_type;
        await CureStorage.Instance.add_filter(type);

        if (old.length !== this.filter_type.length) {
            for (const item of this.Items) {
                item.reset_filted_children();
            }
            CureSymbolTreeItemHandler.Instance.unhighlight_before_change_filter();
            this.refresh();
            CureStorage.Instance.update_switch_context("expand-all-off");
        }
    }

    /** 加载一个文档的符号
     * @param [switch_doc=false] 加载是否是因为切换了文档
     */
    public async reload_symbol(doc: vscode.TextDocument, switch_doc = false) {
        if (await this.manager.update_file(doc)) {
            this.sort_changed = false;
            const new_symbols = this.manager.Symbols;
            this.update_items(new_symbols, switch_doc);
        }
    }

    // #endregion 定义事件处理函数

    /** 使用新的语法符号数据来更新语法树
     * @param new_symbols 新的语法符号数据，其必须是已经按照到当前的排序处理过的
     * @param switch_doc 是否是因为切换了文档才需要更新
     */
    private update_items(new_symbols: CureOneSymbol[], switch_doc: boolean) {
        if (switch_doc || new_symbols.length !== this.Items.length) {
            return this.reload();
        }
        // 注意，需要保证排序方式一致！
        for (let i = 0; i < new_symbols.length; i++) {
            const new_symbol = new_symbols[i];
            const item = this.Items[i];
            item.update_new_symbol(new_symbol, (v) => this.refresh(v), false);
        }
    }
}

/** 综合处理一些 Tree View Item 的操作以及给 tree view 添加事件。单例模式 */
export class CureSymbolTreeItemHandler {
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

    private disposables: vscode.Disposable[] = [];

    public static register(
        provider: CureSymbolTreeProvider,
        view: vscode.TreeView<CureSymbolTreeItem>
    ) {
        const self = new CureSymbolTreeItemHandler(provider, view);
        // 显示在 Title 后面
        // self.view.description = "description";
        // 显示在第一个 item 的上面
        self.update_view_message();
        // 当切换到其它页面时，就是【隐藏】咯
        self.disposables.push(
            view.onDidChangeVisibility((e) => {
                // console.log("visibility changed:", e.visible);
                if (e.visible) {
                    CureSymbolTreeViewCMD.Instance.run_reload_symbol();
                }
            })
        );

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
        self.disposables.push(
            view.onDidExpandElement((e) => {
                // console.log("expand:", e.element.name);
                if (CureStorage.Instance.editor_auto_expand) {
                    self.fold_editor_by_item(e.element, true);
                }
            })
        );
        self.disposables.push(
            view.onDidCollapseElement((e) => {
                // console.log("collapse:", e.element.name);
                if (CureStorage.Instance.editor_auto_expand) {
                    self.fold_editor_by_item(e.element, false);
                }
            })
        );

        // 当点击 item 时会触发，似乎可以替代【点击 item 时的事件】
        // 但重复点击时当然是不会重复触发的啦！
        // view.onDidChangeSelection((e) => {
        //     // 开启多选之后，就会有多个元素了
        //     console.log("selection:", e.selection[0].name);
        // });
    }

    /** 记录当前的展开层级，初始为 0，表示全部折叠
     * - 当它为 1 时，表示顶层的 item 展开 1 层级
     * - 当它为 2 时，表示顶层的 item 展开 2 层级
     */
    private curr_level = 0;

    /** 更新 tree view 描述信息 -- 展示当前展开层级 */
    private update_view_message() {
        this.view.message = `Expand Level: ${this.curr_level}`;
    }

    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }

    /** 重置内部一些状态 */
    public reset_state() {
        this.curr_level = 0;
        this.clear_expand_record();
        this.unhighlight();
    }

    //#region 关于 follow viewport 与 follow cursor

    private is_follow_viewport_ok = true;
    private fv_tid: number | undefined;
    /**
     * 当开启 `follow viewport` 时，
     * 【点击符号跳转到位置】、【follow cursor] 等都会触发 `follow viewport`。
     *
     * 所以有了这个标记，如果为 `false` 则说明当前很忙，不要触发 `follow viewport`。
     *
     * 还有切换文档的时候，也会触发 `follow viewport`，所以需要暂时取消啦。
     */
    public get CanFollowViewport() {
        return this.is_follow_viewport_ok;
    }

    /** 临时取消 follow viewport，等待部分工作完成 */
    public disable_follow_viewport() {
        this.is_follow_viewport_ok = false;
        clearTimeout(this.fv_tid);
    }

    /** 恢复临时取消的 follow viewport
     *
     * @param [imediate=false] 为 true 则立即恢复，否则等待一段时间
     */
    public enable_follow_viewport(imediate = false) {
        if (imediate) {
            this.is_follow_viewport_ok = true;
        } else {
            this.fv_tid = setTimeout(() => {
                this.is_follow_viewport_ok = true;
            }, wait_for_follow_feature) as any;
        }
    }

    private is_follow_cursor_ok = true;
    private fc_tid: number | undefined;
    /** 如果为 false 说明当前很忙，不会触发 follow cursor。
     *
     * 比如：在编辑时不能高亮鼠标当前所在的符号，因为在【比对符号位置】时，用到的还是之前的数据，
     * 必须等实时编辑完成，才能获取到最新的数据、进行比对哟！
     */
    public get CanFollowCursor() {
        return this.is_follow_cursor_ok;
    }

    /** 临时取消 follow cursor，等待部分工作完成 */
    public disable_follow_cursor() {
        this.is_follow_cursor_ok = false;
        clearTimeout(this.fc_tid);
    }

    /** 恢复临时取消的 follow cursor
     * @param [imediate=false] 为 true 则立即恢复，否则等待一段时间
     */
    public enable_follow_cursor(imediate = false) {
        if (imediate) {
            this.is_follow_cursor_ok = true;
        } else {
            this.fc_tid = setTimeout(() => {
                this.is_follow_cursor_ok = true;
            }, wait_for_follow_feature) as any;
        }
    }

    //#endregion

    //#region 展开与折叠的优化

    /** 记录已经展开的 items，从而实现【只展开一个】的功能。具体见 `dev_doc.md` 文档 */
    private readonly expaned_items: Map<string, CureSymbolTreeItem> = new Map();
    /** 因为点击 item 时，默认只能展开一个，所以它记录上一次展开的顶层节点。
     * 由于异步事件时会频繁触发，所以使用**队列**来模拟。
     * - 展开一个顶层节点时，先折叠里面的所有的 item
     * - 然后将将其入队列
     */
    private last_expand_top_items: CureSymbolTreeItem[] = [];

    /** 某些操作不需要再需要此前的展开信息了 */
    private clear_expand_record() {
        this.last_expand_top_items = [];
        this.expaned_items.clear();
    }

    /** 展开 item、折叠其它同层级 items，并增加一个记录
     *
     * @param [refhresh=false] 是否立即刷新
     */
    private record_expaned_item(item: CureSymbolTreeItem, refhresh = true) {
        const is_top_expaned = this._collapse_other_top_level_item(item);
        if (item.is_top) {
            if (!is_top_expaned) {
                this.last_expand_top_items.push(item);
            }
        } else {
            this._collapase_same_level_item(item);
        }

        this.set_expand_state(item, true, refhresh);
    }

    /** 折叠 item、以及所有子项，并更新记录
     *
     * @param [from_record=false] 为 `true` 表示由外部过滤了该 top item，通常情况下忽略该参数
     */
    private unrecord_expaned_item(item: CureSymbolTreeItem, refhresh = true, from_record = false) {
        if (item.is_top && !from_record) {
            this.last_expand_top_items = this.last_expand_top_items.filter((i) => !i.equal(item));
        }
        if (this._collapase_recorded_item(item.UniqueId)) {
            item.ready_update();
        }
        this.set_expand_state(item, false, refhresh);
    }

    /** 除了 item 所在的 top item，其它的 top item 都要折叠
     *
     * @returns 返回 true 表示 item 所在的 top item 已经展开了哟
     */
    private _collapse_other_top_level_item(item: CureSymbolTreeItem) {
        let result = false;
        let item_top_parent;
        do {
            const other_top_item = this.last_expand_top_items.shift();
            if (other_top_item) {
                if (item.is_same_top_parent(other_top_item)) {
                    result = true;
                    item_top_parent = other_top_item;
                    continue;
                }
                this.unrecord_expaned_item(other_top_item, true, true);
            }
        } while (this.last_expand_top_items.length > 0);
        // 原本的 item 被移除了，现在要重新放回去
        if (result && item_top_parent) {
            this.last_expand_top_items.push(item_top_parent);
        }
        return result;
    }

    /** 折叠与 item 同级别的项，并增加 item 的记录 */
    private _collapase_same_level_item(item: CureSymbolTreeItem) {
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
    private _collapase_recorded_item(parentId: string): boolean {
        const item = this.expaned_items.get(parentId);
        let changed = false;
        if (item) {
            this.set_expand_state(item, false, false);
            this.expaned_items.delete(parentId);
            // 递归折叠子项
            changed = this._collapase_recorded_item(item.UniqueId) || item.should_refresh;
        }
        return changed;
    }

    /** 修改 item 的折叠状态
     * @param refhresh 为 true 则立即刷新，否则需要手续手动刷新
     */
    private set_expand_state(item: CureSymbolTreeItem, expand: boolean, refresh: boolean) {
        if (item.collapsibleState !== vscode.TreeItemCollapsibleState.None) {
            item.set_collapsible_state(expand);
        }
        if (refresh || item.is_top) {
            // 在 Outline TreeView 中，item 是否可折叠根据它是否有子项来决定，
            // 而在编辑器中，是否可折叠则不看这个哟，看的是 range
            this.fold_editor_by_item(item, expand);
        }
        refresh && this.provider.refresh(item);
    }

    //#endregion

    //#region 折叠与展开一个item

    /** 展开一个 item，并且折叠同级别的 item。如果它已经展开，则折叠它 —— 该 API 仅用于【点击 item】时使用 */
    public async expand_only_one(item: CureSymbolTreeItem) {
        this.disable_follow_viewport();
        // 点击 item 时，会因为展开/折叠而刷新一次，如果开启了 `follow cursor` 功能，
        // 下一次高亮时又会刷新。所以会有两次刷新！故，在此处直接高亮它！同时更新高亮元素
        if (CureStorage.Instance.follow_cursor) {
            item.highlighten(true);
            // 为什么要这样做？我也不是清楚，如果不这样做，那么在显示上会有问题，当前 item 不会高亮
            // 也就是说：的的确确修改了状态、并且刷新了 item，但是看不到效果，
            // 大概是异步队列的问题吧，因为刷新 item 时是异步的，又不能 await
            setTimeout(() => {
                this.update_highlight_when_click(item);
            }, 0);
        }
        const expand = item.collapsibleState === vscode.TreeItemCollapsibleState.Expanded;
        expand ? this.unrecord_expaned_item(item) : this.record_expaned_item(item);
        // 启用 focus 可以让该 item 展示在视图的中间
        await this.view.reveal(item, { focus: true });
        this.enable_follow_viewport();
    }

    /** 记录当前是否可以进行 Editor Follow Expand
     *
     * ## 为什么引入它
     * 在开启 `follow viewport` 与 `editor follow expand` 后，
     *
     * 当触发滚动时，说明是想要浏览代码，而不是让它自动折叠！所以需要临时取消 `editor follow expand` 功能，
     * 而且如果不临时取消的话，自动折叠编辑区的代码块又会改变滚动条的位置，导致频繁触发 Follow Viewpot
     */
    private is_editor_auto_expand_ok = true;
    private eae_id: number | undefined;
    /** 临时取消 editor follow expand */
    public disable_editor_follow_expand() {
        this.is_editor_auto_expand_ok = false;
        clearTimeout(this.eae_id);
    }

    /** 重新启用 editor follow expand */
    public enable_editor_follow_expand() {
        this.eae_id = setTimeout(() => {
            this.is_editor_auto_expand_ok = true;
        }, wait_for_follow_feature) as any;
    }

    /** 指定一个 item，折叠它所在的范围！
     * @param level 指定展开或折叠的层级，默认情况下：
     * - 展开时，只展开 1 层
     * - 折叠时，折叠 3 层
     */
    private fold_editor_by_item(item: CureSymbolTreeItem, expand: boolean, level?: number) {
        if (!CureStorage.Instance.editor_auto_expand || !this.is_editor_auto_expand_ok) {
            return;
        }

        const to = item.symbol.uri.toString();
        const curr_doc = vscode.window.activeTextEditor?.document;
        if (!curr_doc || curr_doc.uri.toString() !== to) {
            return;
        }

        const start = item.symbol.range.start.line;
        const end = item.symbol.range.end.line;
        if (start === end) {
            return;
        }

        console.log(`fold editor by item: ${item.name}, expand: ${expand}`);
        const action = expand ? "editor.unfold" : "editor.fold";
        const levels = level || (expand ? 1 : 3);
        this.disable_follow_viewport();
        vscode.commands.executeCommand(action, {
            levels,
            selectionLines: [start],
        });
        this.enable_follow_viewport();
    }

    /** 折叠或展开编辑器的全部 */
    private fold_editor_all(expand: boolean) {
        const first = this.provider.Items[0];
        if (!first) {
            return;
        }
        const to = first.symbol.uri.toString();
        const curr_doc = vscode.window.activeTextEditor?.document;
        if (!curr_doc || curr_doc.uri.toString() !== to) {
            return;
        }

        if (CureStorage.Instance.editor_auto_expand) {
            const action = expand ? "editor.unfoldAll" : "editor.foldAll";
            vscode.commands.executeCommand(action);
        }
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
        const last_first = this.highlighted.first;
        this.highlighted.first = first;
        const last_second = this.highlighted.second;
        this.highlighted.second = second;
        first.highlighten(true);
        second?.highlighten(true);
        last_first && this._unhighlight(last_first, first, second);
        last_second && this._unhighlight(last_second, first, second);
    }

    /** 取消所有高亮。
     * @param [clean=false] 为 true 则仅仅是清空缓存的高亮的 item，而不是取消高亮。
     *
     * 因为在涉及到**刷新整个 TreeView 时**，只需要清空这个缓存即可，后续会刷新全部嘛。
     */
    public unhighlight(clean = false) {
        const { first, second } = this.highlighted;
        this.highlighted.first = undefined;
        this.highlighted.second = undefined;
        first?.highlighten(false);
        second?.highlighten(false);
        if (!clean) {
            first && this.provider.refresh(first);
            second && this.provider.refresh(second);
        }
    }

    /** 当修改排序方式时，这样做：
     * - 排序方式不是 position，如果当前高亮了两个，需要全部取消，否则什么都不做咯。
     * - 排序方式是 position 时，触发一次 `follow` 操作（如果开启了功能的话）
     */
    public unhighlight_before_change_sort() {
        const { first, second } = this.highlighted;
        if (this.provider.sort_type !== "position") {
            if (first && second) {
                this.unhighlight();
            }
        } else {
            CureSymbolTreeViewCMD.Instance.run_follow_feature();
        }
    }

    /** 当修改过滤方式时，也需要取消现有高亮、然后执行一次聚焦 */
    public unhighlight_before_change_filter() {
        this.unhighlight(true);
        CureSymbolTreeViewCMD.Instance.run_follow_feature();
    }

    /** 在 follow cursor 时，高亮 item，折叠其它的 item！
     *
     * 最多高亮两个 item 哟，它们都是相同层级
     */
    public async highlight(first: CureSymbolTreeItem, second?: CureSymbolTreeItem) {
        if (!this.view.visible) {
            return;
        }

        /** 记录最后应该刷新的顶层 item */
        let refresh_item = first;
        // 向上展开 first 的父层级但不刷新 ui。
        if (!first.is_top) {
            let parent = first;
            while (parent) {
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
            if (first.is_top) {
                this._collapse_other_top_level_item(first);
            }
            // 这里保持最小化刷新
            if (refresh_item.equal(first)) {
                this.provider.refresh(first);
                this.provider.refresh(second);
            } else {
                this.provider.refresh(refresh_item);
            }
        } else {
            this.record_expaned_item(refresh_item);
        }
        try {
            await this.view.reveal(second ?? first);
        } catch {}
    }

    /** 当点击 item 时，可以提前预知高亮的元素就是它 */
    private update_highlight_when_click(item: CureSymbolTreeItem) {
        const { first, second } = this.highlighted;
        this.highlighted.first = undefined;
        this.highlighted.second = undefined;
        if (first && !first.equal(item)) {
            first.highlighten(false);
            this.provider.refresh(first);
        }
        if (second && !second.equal(item)) {
            second.highlighten(false);
            this.provider.refresh(second);
        }
        this.highlighted.first = item;
    }

    /** 返回 true 表示需要更新高亮元素了。传入的 `items` 一定具备 `first` 项啦 */
    public check_update_highlight(items: HighlightItems<CureSymbolTreeItem>) {
        if (!this.CanFollowCursor) {
            return false;
        }
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

    /** 在高亮元素时，如果当前的位置就在上一次的高亮元素范围内，那么就可以取消本次计算了 */
    public is_highlight_range_changed(range: vscode.Range) {
        const { first, second } = this.highlighted;
        if (!first && !second) {
            return true;
        }
        if (!second) {
            if (first?.contains(range, true)) {
                // 匿名函数无法准确判断是否在范其名称范围内 —— 因为它都不具备名称
                // 如果它是匿名函数，并且没有有子元素，那么一定就在其范围内
                // 否则，可能是在匿名函数内部的子元素中哟
                if (first.is_anonymous) {
                    return first.children_length > 0;
                }
                return false;
            }
            return true;
        }
        // 两个高亮，看看是否在它们之间
        return !(first?.is_before(range) && second?.is_after(range));
    }

    /** 在确定鼠标位置后，如果它不在高亮元素上，就需要需要查找其最近的元素。现在加入优化：
     * - 假设当前有高亮元素，那么下一次可能是进入该高亮元素内部或者父节点内部，所以：
     * - 如果当前鼠标位置在**当前高亮元素内部**，那么直接返回该其子元素（没有子元素就返回自身）
     * - 如果鼠标位置在**高亮元素的父元素内部**，那么直接返回对应父元素的子元素
     * - 否则，就只能从根节点开始查找了
     */
    public get_search_items(range: vscode.Range) {
        const { first, second } = this.highlighted;
        if (first) {
            const target = this.find_parent_has_range(first, range);
            if (target) {
                console.log("search items in:", target.name);
                return target.children_length > 0 ? target.Children : [target];
            }
        }
        if (second) {
            const target = this.find_parent_has_range(second, range);
            if (target) {
                console.log("search items in:", target.name);
                return target.children_length > 0 ? target.Children : [target];
            }
        }
        return this.provider.Items;
    }

    /** 从 item 向上查找，直到找到某一个父元素正好包含该范围 */
    private find_parent_has_range(item: CureSymbolTreeItem, range: vscode.Range) {
        let parent: CureSymbolTreeItem | undefined = item;
        while (parent) {
            if (parent.contains(range, false)) {
                return parent;
            }
            parent = parent.parent;
        }
    }

    //#endregion

    //#region 折叠与展开全部

    /** 修改多个 items 折叠状态！*/
    private set_items_expand(items: CureSymbolTreeItem[], expand: boolean) {
        items.forEach((v) => {
            this.set_expand_state(v, expand, false);
            if (v.children_length > 0) {
                this.set_items_expand(v.Children, expand);
            }
        });
    }

    /** 全部折叠或全部展开 */
    public expand_all(expand: boolean) {
        this.reset_state();
        this.set_items_expand(this.provider.Items, expand);
        if (!expand) {
            this.curr_level = 0;
            this.update_view_message();
        }
        this.provider.refresh();
        this.fold_editor_all(expand);
    }

    /** 折叠与展开一个 item 的所有层级 */
    public expand_item_all(item: CureSymbolTreeItem, expand: boolean) {
        this.set_items_expand([item], expand);
        item.ready_update();
        this.provider.refresh(item);
        this.fold_editor_by_item(item, expand, 6);
    }

    /** 展开 item 最多到 `this.curr_level` 层级！超过的则全部折叠！
     * @param level 当前所在的层级
     */
    private set_items_level_expand(items: CureSymbolTreeItem[], level: number) {
        const expand = level < this.curr_level;
        items.forEach((v) => {
            this.set_expand_state(v, expand, false);
            if (v.children_length > 0) {
                this.set_items_level_expand(v.Children, level + 1);
            }
        });
    }

    /** 修改当前的展开层次
     *
     * ## 效果描述
     * - 增加。如果当前展开层级为 1，那么就展开到 2 层。也就是说，从顶层 item 开始，每个默认展开 2 级
     * - 减少。如果当前展开层级为 2，那么就折叠到 1 层。也就是说，从顶层 item 开始，每个默认展开 1 级
     */
    public change_expand_level(inc: boolean) {
        if (inc) {
            ++this.curr_level;
        } else if (this.curr_level > 0) {
            --this.curr_level;
        }
        // 当展开时，就要调整上方的按钮为【折叠全部】
        const v = this.curr_level > 0 ? "expand-all" : "expand-all-off";
        CureStorage.Instance.update_switch_context(v);
        this.clear_expand_record();
        this.update_view_message();
        this.set_items_level_expand(this.provider.Items, 0);
        this.provider.refresh();
    }

    // #endregion
}
