/**
 * @module bmview
 * @description 实现展示书签视图 `cure-outline-bookmark`
 */

import * as vscode from "vscode";
import crypto from "crypto";
import { BookmarkCategory, TreeItemType } from "../types/symbol";
import { CureOneSymbol, CureSymbolCMD } from "../symbol";
import { CureBookmarkManager } from "./bm_manager";
import type { CureSymbolTreeItem } from "../outline/ol_view";
import { set_context_value } from "../common";

/** 表示 bookmark tree view 的 item */
export class CureBookmarkTreeItem extends vscode.TreeItem {
    /** 表示该 item 的类型 */
    public readonly type: TreeItemType;
    /** 当 type 为 `bookmark item` 时，其对应的 symbol 哟 */
    public readonly symbol?: CureOneSymbol;
    /** 当它为 `bookmark item` 时，其所属的 `bookmark category` 名称 */
    public incategory?: BookmarkCategory;
    /** 这个 id 用于唯一表示该 item 且不变，并不是用于 tree view 中的 id！。
     *
     * 通过该 id 可以确定底层对应的符号啦
     */
    public get UniqueId() {
        if (this.type === "bookmark_category") {
            throw new Error("only bookmark item has item id");
        }
        return this.symbol!.id;
    }

    private constructor(
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        type: TreeItemType,
        symbol?: CureOneSymbol
    ) {
        super(label, collapsibleState);
        this.type = type;
        this.symbol = symbol;
        this.id = crypto.randomUUID();
    }

    /** 创建一个 `bookmark item`，并指定它所属的 `category` */
    static create_item(symbol: CureOneSymbol, incategory: BookmarkCategory, type: TreeItemType) {
        if (type !== "bookmark_item" && type !== "bookmark_custom") {
            throw new Error("only bookmark item can be created!");
        }
        const item = new CureBookmarkTreeItem(
            symbol.name,
            vscode.TreeItemCollapsibleState.None,
            type,
            symbol
        );
        // item 就没有子项啦
        item.once_children = [];
        item.iconPath = symbol.Icon;
        // 点击该项时，打开文件、跳转对对应的位置咯
        item.command = CureSymbolCMD.Instance.create_locate(symbol);
        item.description = symbol.detail;
        item.tooltip = symbol.Comment || symbol.name || symbol.detail;
        set_context_value(item, type);
        item.incategory = incategory;
        return item;
    }

    /** 创建一个 `bookmark category` */
    static create_category(title: BookmarkCategory, items?: CureOneSymbol[]): CureBookmarkTreeItem {
        const type = "bookmark_category";
        const cat = new CureBookmarkTreeItem(title, vscode.TreeItemCollapsibleState.Expanded, type);
        cat.tooltip = CureBookmarkManager.Instance.get_category_desc(title);
        cat.iconPath = new vscode.ThemeIcon(
            "symbol-folder",
            new vscode.ThemeColor("symbolIcon.folderForeground")
        );
        set_context_value(cat, type);
        // 表示分类的 tree item 没有 comand 哟
        if (items) {
            cat.once_children = items;
            cat.update_category_desc();
        }
        return cat;
    }

    // #region bookmark的操作

    /** 给某个 bookmark category 添加一个 item */
    static add_bookmark(category: CureBookmarkTreeItem, item: CureOneSymbol) {
        if (category.type !== "bookmark_category") {
            throw new Error("only category can add bookmark!");
        }
        const result = CureBookmarkTreeItem.create_item(
            item,
            category.label as BookmarkCategory,
            "bookmark_item"
        );
        category.Children.push(result);
        category.update_category_desc();
        return true;
    }

    /** 给某个 bookmark category 删除一个 item */
    static del_bookmark(category: CureBookmarkTreeItem, item: CureBookmarkTreeItem) {
        if (category.type !== "bookmark_category") {
            throw new Error("only category can del bookmark!");
        }
        const old = category.Children.length;
        category.Children = category.Children.filter((v) => v.UniqueId !== item.UniqueId);
        const ok = category.Children.length < old;
        ok && category.update_category_desc();
        return ok;
    }

    // #endregion bookmark的操作

    // #region children

    /** Tree Item 的子项，一开始并不解析，等到展开的时候再做解析啦，也就是说其它地方不要访问它 */
    private once_children: CureOneSymbol[] = [];
    /** 存储解析后的结果！ */
    private children?: CureBookmarkTreeItem[];

    /** 获取 Item 的子项 */
    get Children(): CureBookmarkTreeItem[] {
        if (this.children === undefined) {
            const parent = this;
            this.children = this.once_children.map((v) => {
                if (parent.type !== "bookmark_category") {
                    throw new Error("bookmark item cannot have children!");
                }
                const category = parent.label as BookmarkCategory;
                const type: TreeItemType =
                    category === "custom" ? "bookmark_custom" : "bookmark_item";
                return CureBookmarkTreeItem.create_item(v, category, type);
            });
            // 清空原有的子项
            this.once_children = [];
        }

        return this.children;
    }

    set Children(v: CureBookmarkTreeItem[]) {
        this.children = v;
    }

    // #endregion children

    /** 更新分类 item 的描述信息，其实就是展示它的子项数量啦 */
    private update_category_desc() {
        if (this.type === "bookmark_category") {
            this.description = this.Children.length.toString() || "0";
        }
    }
}

/** 提供 bookmark 的 TreeView Provider */
export class CureBookmarkTreeProvider implements vscode.TreeDataProvider<CureBookmarkTreeItem> {
    /** 本视图对应的 view id */
    public static readonly id = "cure-outline-bookmark";
    /** 管理书签 */
    private readonly manager: CureBookmarkManager;
    /** 书签的分类信息 */
    private readonly bookmark_categories: { [key in BookmarkCategory]: CureBookmarkTreeItem } =
        {} as any;
    /** 缓存书签的信息，某些情况下需要重新获取书签时，应该将其设置为 undefined */
    private items?: CureBookmarkTreeItem[];
    /** 获取最终要展示到 tree view 中的 items */
    private get Items(): CureBookmarkTreeItem[] {
        if (this.items === undefined) {
            // 创建书签的分类
            for (const [category, bookmarks] of this.manager.Bookmarks) {
                this.bookmark_categories[category as BookmarkCategory] =
                    CureBookmarkTreeItem.create_category(category as BookmarkCategory, bookmarks);
            }
            this.items = Object.values(this.bookmark_categories);
        }
        return this.items;
    }

    constructor(manager: CureBookmarkManager) {
        this.manager = manager;
        // 此处触发 getter 初始化数据，否则后续【添加书签】时，会找不到 symbol
        this.Items;
    }

    // #region 处理tree_item

    getTreeItem(element: CureBookmarkTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CureBookmarkTreeItem): Thenable<CureBookmarkTreeItem[]> {
        if (element) {
            return Promise.resolve(element.Children);
        } else {
            return Promise.resolve(this.Items);
        }
    }

    // #endregion 处理tree_item

    // #region 定义事件处理函数

    private readonly _onDidChangeTreeData = new vscode.EventEmitter<
        CureBookmarkTreeItem | undefined | void
    >();
    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    /** 刷新视图 */
    refresh(item?: CureBookmarkTreeItem) {
        this._onDidChangeTreeData.fire(item);
    }

    /** 重新加载数据 */
    reload() {
        this.items = undefined;
        this.refresh();
    }

    /** 重新加载一个文本的符号！ */
    async reload_bookmark(file: vscode.Uri, content: string) {
        const ok = await this.manager.update_file(file, content);
        ok && this.reload();
    }

    /** 将一个 Symbol Tree Item 中的符号加入到 bookmark 中 */
    add_symbol_item(symbol: CureOneSymbol) {
        const category = this.bookmark_categories["symbol"];
        const ok = CureBookmarkTreeItem.add_bookmark(category, symbol);
        if (ok) {
            this.manager.add("symbol", symbol);
            this.manager.save();
        }
        ok && this.refresh(category);
    }

    /** 删除一个 `bookmark item` */
    del_item(item: CureBookmarkTreeItem) {
        const incategory = item.incategory;
        if (!incategory) {
            return;
        }
        const category = this.bookmark_categories[incategory];
        const ok = CureBookmarkTreeItem.del_bookmark(category, item);
        if (ok) {
            this.manager.del(incategory, item.symbol!);
            this.manager.save();
        }
        ok && this.refresh(category);
    }

    // #endregion 定义事件处理函数
}
