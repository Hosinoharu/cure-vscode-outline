import * as vscode from "vscode";
import { CureOneSymbol } from "../symbol";
import { BookmarkCategory } from "../types/symbol";
import { bookmark_gutter_icon } from "../assets";

/** 管理书签。单例模式 */
export class CureBookmarkManager {
    private static instance?: CureBookmarkManager;

    private constructor() {
        if (CureBookmarkManager.instance) {
            throw new Error("CureBookmarkManager is already initialized!");
        }
        CureBookmarkManager.instance = this;
    }

    public static get Instance() {
        if (!this.instance) {
            this.instance = new CureBookmarkManager();
        }
        return this.instance;
    }

    private readonly category: { [key in BookmarkCategory]: CureOneSymbol[] } = {
        /** 存储语法符号的书签 */
        symbol: [],
        /** 存储普通的书签 */
        bookmark: [],
        /** 存储代码中特定格式的书签 */
        custom: [],
    };
    /** 获取书签列表 */
    public get Bookmarks() {
        return Object.entries(this.category);
    }

    /** 获取不同分类的描述信息，用于展示 tooltips */
    public get_category_desc(category: BookmarkCategory) {
        switch (category) {
            case "symbol":
                return "从语法树添加的书签";
            case "bookmark":
                return "普通书签";
            case "custom":
                return "文本中的书签";
            default:
                return `未知分类: ${category}`;
        }
    }

    //#region 操作书签

    /** 添加一个书签 */
    public add(type: BookmarkCategory, symbol: CureOneSymbol) {
        this.category[type].push(symbol);
    }

    /** 删除一个书签 */
    public del(type: BookmarkCategory, symbol: CureOneSymbol) {
        const s = this.category[type];
        const index = s.indexOf(symbol);
        if (index !== -1) {
            s.splice(index, 1);
        }
    }

    /** 保存书签到本地咯 */
    public async save() {}

    //#endregion

    //#region 解析自定义书签

    /** 解析出自定义标签的正则，直接读取 #cure-xx 后面 xx 的所有内容 */
    private readonly cutstom_format = /#cure-(.*)/;

    /** 从一行文本中解析出自定义的书签，返回匹配的内容以及所在的列 */
    private parse_format(line: string) {
        const custom = line.match(this.cutstom_format);
        if (custom) {
            return { name: custom[1].trim(), col: custom.index || 0 };
        }
    }

    /** 读取文档内容，解析出其中的自定义标签
     * @param uri 指定解析出的书签来自哪里
     * @param content 文档内容
     *
     * @return 返回解析后的 #region 符号！如果返回 undefined 表示解析失败
     */
    public async update_file(uri: vscode.Uri, content: string) {
        if (vscode.window.activeTextEditor?.document.uri.fsPath !== uri.fsPath) {
            return undefined;
        }

        const lines = content.split("\n");
        // 不需要判断是否为注释之类的情况，反正是我自己用
        const symbols: CureOneSymbol[] = [];
        const ranges: vscode.Range[] = [];
        const region_handler = CureRegionManager.Instance;
        region_handler.reset(uri);

        for (let i = 0; i < lines.length; i++) {
            region_handler.parse_one_line(lines[i], i);
            const match_result = this.parse_format(lines[i]);
            if (!match_result) {
                continue;
            }
            const { name, col } = match_result;
            const s = CureOneSymbol.from_custom_bookmark(uri, name, i, col);
            symbols.push(s);
            ranges.push(s.range);
        }

        this.add_gutter_icon(ranges);
        this.category["custom"] = symbols;

        const { for_outline, for_bookmark } = region_handler.get_result();
        for_bookmark.forEach((r) => symbols.push(r));
        return for_outline;
    }

    /** 记录指定位置的行首 gutter icon  */
    private static readonly decoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: bookmark_gutter_icon,
        gutterIconSize: "contain",
    });

    /** 解析出一个标签后，在它的行首添加一个 icon 标记咯 */
    private add_gutter_icon(ranges: vscode.Range[]) {
        const editor = vscode.window.activeTextEditor;
        editor?.setDecorations(CureBookmarkManager.decoration, ranges);
    }

    //#endregion
}

/** 临时记录一个 #region 符号 */
class OneRegionSymbol {
    private children: CureOneSymbol[] = [];
    private range: vscode.Range;

    /**
     * @param name #region 注释中的内容
     * @param line 符号所在的行
     * @param col 符号所在的列
     */
    constructor(public name: string, private line: number, private col: number) {
        this.range = new vscode.Range(this.line, 0, this.line, this.col);
    }

    /** 给定 region 的结尾，创建一个用于 outline 展示的符号 */
    public create_region_symbol_ol(uri: vscode.Uri, end_line: number, end_col: number) {
        const selection_range = new vscode.Range(this.line, this.col, end_line, end_col);
        return CureOneSymbol.from_region_bookmark(
            uri,
            this.name,
            this.range,
            selection_range,
            this.children
        );
    }

    /** 将一个 region 符号转为用于 bookmark 展示的 CureOneSymbol */
    public create_region_symbol_bm(uri: vscode.Uri) {
        const range = this.range;
        return CureOneSymbol.from_region_bookmark(uri, this.name, range, range, []);
    }

    public add_child(child: CureOneSymbol) {
        this.children.push(child);
    }
}

/** 管理 region 符号以及解析工作。单例模式.
 *
 * # 用法说明
 * - 先调用 `.reset()` 重置状态
 * - 然后不断调用 `parse_one_line(line)` 解析每一行
 * - 最后调用 `get_result()` 获取解析结果
 */
class CureRegionManager {
    private static instance?: CureRegionManager;

    private constructor() {
        if (CureRegionManager.instance) {
            throw new Error("CureRegionManager is already initialized!");
        }
        CureRegionManager.instance = this;
    }

    public static get Instance() {
        if (!this.instance) {
            this.instance = new CureRegionManager();
        }
        return this.instance;
    }

    /** 记录匹配对应的 region，以及包含层级关系，用于 outline */
    private for_outline = [] as CureOneSymbol[];
    /** 记录匹配对应的 region（不包含层级关系）、以及没有匹配到 endregion 的 region，用于 bookmark */
    private for_bookmark = [] as CureOneSymbol[];
    /** 模拟堆栈，用于匹配 region 和 endregion */
    private region_stack = [] as OneRegionSymbol[];
    private uri?: vscode.Uri;

    /** 重置状态
     * @param uri  文件路径，用于初始化符号用的
     */
    public reset(uri: vscode.Uri) {
        this.for_outline = [];
        this.for_bookmark = [];
        this.region_stack = [];
        this.uri = uri;
    }

    /** 获取解析结果
     * @returns matched: 记录完全对上的 region 符号，它们将被添加到 outline 中
     *          unmatch: 记录没有匹配到 endregion 的 region 符号，它们将添加到 bookmark 中
     */
    get_result() {
        this.for_bookmark.sort((a, b) => a.range.start.line - b.range.start.line);
        // 标记未匹配的 region
        for (const r of this.region_stack) {
            r.name = `(drop) ` + r.name;
            // 按照位置排序，从开头插入，这样没有匹配的 region 将靠前显示，便于解决
            this.for_bookmark.unshift(r.create_region_symbol_bm(this.uri!));
        }
        return {
            /** 用于 outline 展示，包含 region 的层级关系以及保证配对 */
            for_outline: this.for_outline,
            /** 用于 bookmark 展示，不包含 region 的层级关系且对没有匹配的 region 带有标识 */
            for_bookmark: this.for_bookmark,
        };
    }

    /** 解析一行
     * @param line  要解析的行
     * @param ln      行号
     * @returns 返回一个解析出的 region 符号
     */
    public parse_one_line(line: string, ln: number) {
        const match_result = this.parse_line(line);
        if (!match_result || !this.uri) {
            return;
        }
        const { name, col, region } = match_result;
        if (region) {
            this.region_stack.push(new OneRegionSymbol(name, ln, col));
        }
        // 完成 region 的范围匹配，如果碰到多余的 endregion，则忽略
        else if (this.region_stack.length > 0) {
            const start = this.region_stack.pop()!;
            const s = start.create_region_symbol_ol(this.uri, ln, col);
            // 根据栈的特性，如果当前生成的 region 上面还有 region，则添加到它的子节点中
            // 否则，添加到 region_symbols 中
            const parent = this.region_stack[this.region_stack.length - 1];
            if (parent) {
                parent.add_child(s);
            } else {
                this.for_outline.push(s);
            }

            const r = start.create_region_symbol_bm(this.uri);
            this.for_bookmark.push(r);
        }
    }

    /** 解析 #region 注释 */
    private readonly region_format = /#region\s*(.*)/;
    /** 解析 #endregion 注释 */
    private readonly endregion_format = /#endregion/;

    /** 正则匹配出一行中的 region、endregion
     * - 如果是 region，则返回其内容（name）、位置（col）以及一个标记（region: true）
     * - 如果是 endregion，则返回其位置（col），并没有包含内容哟
     */
    private parse_line(line: string) {
        const region = line.match(this.region_format);
        if (region) {
            return { name: region[1].trim(), col: region.index || 0, region: true };
        }
        const endregion = line.match(this.endregion_format);
        if (endregion) {
            return { col: endregion.index || 0 };
        }
    }
}
