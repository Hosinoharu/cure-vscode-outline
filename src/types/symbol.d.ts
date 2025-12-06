import type { SymbolKind } from "vscode";
import type { CureOneSymbol } from "../symbol";

/** 文件符号的种类，包含默认的、以及自定义的
 *
 * - `CureRegion`：对应 #region 注释
 * - `CureLineBookmark`：普通的行书签，不写入到代码中的书签！
 * - `CureCustomBookmark`：自定义书签，写入到代码中的书签！其格式为 `#cure-xxx` 形式，其中 `xxx` 是书签的名字
 */
type CureSymbolKind =
    | keyof typeof SymbolKind
    | "CureRegion"
    | "CureLineBookmark"
    | "CureCustomBookmark";

/** 书签的分类
 *
 * - `symbol`：关于语法符号的书签
 * - `bookmark`：普通的行书签，属于不写入代码中的书签
 * - `custom`：自定义书签，属于写入到代码中的书签，以 `#cure-xxx` 形式存在
 */
type BookmarkCategory = "symbol" | "bookmark" | "custom";

/** TreeItem 有多种类型，同时也作为其 `contextValue` 的值啦
 * - `symbol`：表示语言符号
 * - `bookmark_item`：表示一个 `bookmark item`，可以被编辑、删除
 * - `bookmark_category`：表示一个 `bookmark category`，无法编辑、删除
 * - `bookmark_custom`：表示一个自定义书签，属于嵌入到代码中的，无法编辑、删除
 */
type TreeItemType = "symbol" | "bookmark_item" | "bookmark_category" | "bookmark_custom";

/** 排序 tree item 的种类
 * - `position`：按符号在代码中的位置排序（默认）
 * - `name`：按符号名称排序
 * - `kind`：按符号类型排序，同时每个类型内部再按名称排序
 */
type OutlineSortType = "name" | "position" | "kind";

/** 过滤符号时的种类
 * - `no_local_var`：过滤掉局部变量
 * - `no_global_var`：过滤掉全局变量
 */
type OutlineFilterType = "no-local-var" | "no-global-var";

//#region 开关类命令

type Expandype = "expand-all" | "expand-only-one";
/** 折叠与展开命令 */
type ExpandCmdType = Expandype | `${Expandype}-off`;

/** 排序命令，只能选一个 */
type SortCmdType = `sort-by-${OutlineSortType}` | `sort-by-${OutlineSortType}-off`;

/** 过滤命令
 *  - `filter-no-local-var`：过滤掉局部变量
 *  - `filter-no-global-var`：过滤掉全局变量
 */
type FilterType = `filter-${OutlineFilterType}`;
type FilterCmdType = FilterType | `${FilterType}-off`;

/** 响应编辑器的操作 */
type FollowType = "follow-cursor" | "follow-viewport";
type FollowCmdType = FollowType | `${FollowType}-off`;

/** 开关类命令，具备【on、off】两个命令哟 */
type SwitchCmdType = ExpandCmdType | SortCmdType | FilterCmdType | FollowCmdType;

//#endregion

/** 表示在 `follow cursor` 与 `follow viewport` 时需要高亮元素。
 *
 * - 只有一个高亮元素时，`first` 为该元素，它表示当前就位于该符号中
 * - 有两个高亮元素时，它表示当前位于 `first、second` 之间
 * - 至少要有一个高亮元素！
 */
type HighlightItems<T> = {
    first?: T;
    second?: T;
};

/** 记录一个符号的差异信息 */
type OneDiffInfo = {
    /** 新的符号 */
    new: CureOneSymbol;
    /** 标记需要刷新 TreeItem 才行 */
    refresh: boolean;
    /** 为 undefined 直接刷新整个父节点 */
    children?: OneDiffInfo[];
};
