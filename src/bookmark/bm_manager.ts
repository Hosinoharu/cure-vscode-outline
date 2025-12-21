import * as vscode from "vscode";
import { CureCommentTable, CureOneSymbol } from "../symbol";
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
        // #cure-todo 暂时没什么好的想法
        // @ts-ignore
        delete this.category.bookmark;
        return Object.entries(this.category);
    }
    public get CustomBookmark() {
        return this.category.custom;
    }

    /** 获取不同分类的描述信息，用于展示 tooltips */
    public get_category_desc(category: BookmarkCategory) {
        switch (category) {
            case "symbol":
                return "从语法树添加的书签";
            case "bookmark":
                return "普通书签";
            case "custom":
                return "当前文件的自定义书签";
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

    /** 当前是否正在解析自定义书签
     *
     * ## 为什么引入它
     * 假设切换到文档 A 时，会解析 region 注释并展示到 outline，同时也需要提供 region 的折叠范围，
     *
     * 很显然这里复用了数据，所以肯定不需要重复解析，关键是：**怎么确保二者都拿到正确的数据！**
     *
     * 解析器是单例模式，而两处解析的位置都是**异步函数中**，
     *
     * 因为插件的解析流程设定了 `debounce`（延迟执行），所以肯定是 RegionFoldingProvider 先执行！！
     *
     * 所以干脆**直接在 RegionFoldingProvider 中完成了整个文档的自定义的书签解析**，
     *
     * 当 outline 要展示 region 符号时，就直接拿解析结果咯，但可能当前正在解析中，所以有了这个判定！
     */
    private is_parsing = false;
    /** 保存解析出来的、用于展示到 outline 的结果 */
    private parsed_result?: OneRegionSymbol[];

    /** 获取解析出的结果，默认情况下会先被 RegionFoldingProvider 触发然后保存结果。
     *
     * @param parse 是否强制解析，默认为 false
     */
    public async get_parsed_result(doc: vscode.TextDocument, parse?: boolean) {
        if (!parse && this.parsed_result) {
            // 这里应该返回一个 copy。否则因为后续会在这些 region 符号中插入子元素
            // 从而会修改这个原始的数据！
            return this.parsed_result.map((s) => s.create_region_symbol_ol(doc.uri));
        }
        if (!this.is_parsing) {
            const result = await this.parse(doc);
            return result?.map((s) => s.create_region_symbol_ol(doc.uri));
        }
        // 当前正在解析，需要等待解析完成 —— 并没有再次尝试哟
        return new Promise<CureOneSymbol[] | undefined>((resolve) => {
            setInterval(() => {
                resolve(this.parsed_result?.map((s) => s.create_region_symbol_ol(doc.uri)));
            }, 200);
        });
    }

    /** 读取文档内容，解析出其中的自定义标签
     *
     * @return 返回解析后的 #region 符号！如果返回 undefined 表示解析失败
     */
    public async parse(doc: vscode.TextDocument) {
        if (this.is_parsing) {
            return;
        }
        this.is_parsing = true;
        // ================================================================

        const uri = doc.uri;
        // 暂时不需要判断每一行是否为注释之类的情况，因为自定义书签的格式是特殊的
        /** 记录解析的自定义注释 */
        const symbols: CureOneSymbol[] = [];
        /** 记录哪些行具备自定义注释 */
        const ranges: vscode.Range[] = [];
        const region_parser = CureRegionParser.Instance;
        region_parser.reset(uri, doc.languageId);

        for (let i = 0; i < doc.lineCount; i++) {
            const line = doc.lineAt(i);
            if (line.isEmptyOrWhitespace) {
                continue;
            }
            region_parser.parse_one_line(line.text, i);
            const match_result = this.parse_format(line.text);
            if (!match_result) {
                continue;
            }
            const { name, col } = match_result;
            const s = CureOneSymbol.from_custom_bookmark(uri, name, i, col);
            symbols.push(s);
            ranges.push(line.range);
        }

        this.add_gutter_icon(ranges);
        this.category["custom"] = symbols;

        const { for_outline, for_bookmark } = region_parser.get_result();
        for_bookmark.forEach((r) => symbols.push(r.create_region_symbol_bm(uri)));

        /** 记录自定义注释的范围，用于高亮其文本 */
        const bm_ranges: vscode.Range[] = [];
        for_bookmark.forEach((r) => bm_ranges.push(new vscode.Range(r.line, r.col, r.line + 1, 0)));
        this.highlight_bookmark(bm_ranges);

        // ================================================================
        this.is_parsing = false;
        this.parsed_result = for_outline;
        return for_outline;
    }

    /** 记录指定位置的行首 gutter icon  */
    private readonly decoration = vscode.window.createTextEditorDecorationType({
        gutterIconPath: bookmark_gutter_icon,
        gutterIconSize: "contain",
    });

    /** 解析出一个标签后，在它的行首添加一个 icon 标记咯 */
    private add_gutter_icon(ranges: vscode.Range[]) {
        const editor = vscode.window.activeTextEditor;
        editor?.setDecorations(this.decoration, ranges);
    }

    /** 高亮自定义文本用的装饰 */
    private readonly bm_decoration = vscode.window.createTextEditorDecorationType({
        color: "#FE5B9B", // cure-idol
        fontWeight: "bolder",
    });

    /** 给 region 的文本高亮哟 */
    private highlight_bookmark(ranges: vscode.Range[]) {
        const editor = vscode.window.activeTextEditor;
        editor?.setDecorations(this.bm_decoration, ranges);
    }

    //#endregion
}

/** 临时记录一个 #region 符号 */
class OneRegionSymbol {
    private children: OneRegionSymbol[] = [];
    private selection_range: vscode.Range;
    /** region 的结束符符号 endregion 所在行 */
    private end_line?: number;
    /** region 的结束符符号 endregion 所在列 */
    private end_col?: number;

    /**
     * @param name #region 注释中的内容
     * @param line 符号所在的行
     * @param col 符号所在的列
     */
    constructor(public name: string, public line: number, public col: number) {
        this.selection_range = new vscode.Range(line, col, line, col + "#region".length);
    }

    /** 设置 region 对应的 endregion 所在行、列 */
    public set_endregion(end_line: number, end_col: number) {
        this.end_line = end_line;
        this.end_col = end_col;
    }

    /** 给定 region 的结尾，创建一个用于 outline 展示的符号 */
    public create_region_symbol_ol(uri: vscode.Uri): CureOneSymbol {
        if (!this.end_line || !this.end_col) {
            throw new Error("region symbol has no endregion!");
        }

        const range = new vscode.Range(
            this.line,
            this.col,
            this.end_line!,
            this.end_col! + "#endregion".length
        );
        const children = this.children.map((c) => c.create_region_symbol_ol(uri));
        return CureOneSymbol.from_region_bookmark(
            uri,
            this.name,
            range,
            this.selection_range,
            children
        );
    }

    /** 将一个 region 符号转为用于 bookmark 展示的 CureOneSymbol */
    public create_region_symbol_bm(uri: vscode.Uri) {
        const range = this.selection_range;
        return CureOneSymbol.from_region_bookmark(uri, this.name, range, range, []);
    }

    public add_child(child: OneRegionSymbol) {
        this.children.push(child);
    }

    public get Children() {
        return this.children;
    }

    public static sort_by_position(s: OneRegionSymbol[]) {
        s.sort((a, b) => a.line - b.line);
    }
}

/** 解析 region 注释。单例模式.
 *
 * ## 用法说明
 * - 先调用 `.reset()` 重置状态
 * - 然后不断调用 `parse_one_line()` 解析每一行
 * - 最后调用 `get_result()` 获取解析结果
 */
class CureRegionParser {
    private static instance?: CureRegionParser;

    private constructor() {
        if (CureRegionParser.instance) {
            throw new Error("CureRegionParser is already initialized!");
        }
        CureRegionParser.instance = this;
    }

    public static get Instance() {
        if (!this.instance) {
            this.instance = new CureRegionParser();
        }
        return this.instance;
    }

    /** 记录匹配对应的 region，其中包含层级关系，用于在 `outline` 中展示 */
    private for_outline = [] as OneRegionSymbol[];
    /** 记录匹配对应的 region（不包含层级关系）、以及没有匹配到 endregion 的 region，用于 `bookmark` 中展示 */
    private for_bookmark = [] as OneRegionSymbol[];
    /** 模拟堆栈，用于匹配 region 和 endregion */
    private region_stack = [] as OneRegionSymbol[];
    /** 记录从哪里解析出的符号 */
    private uri?: vscode.Uri;
    /** 记录当前文件的语言 */
    private languageId?: string;
    /** 记录解析出的、配对的 region 的范围 */
    public closed_regions: vscode.FoldingRange[] = [];

    /** 重置状态
     * @param uri  文件路径，用于初始化符号用的
     * @param languageId  文件的语言，用于判断其注释
     */
    public reset(uri: vscode.Uri, languageId: string) {
        this.for_outline = [];
        this.for_bookmark = [];
        this.region_stack = [];
        this.closed_regions = [];
        this.uri = uri;
        this.languageId = languageId;
    }

    /** 获取解析结果 */
    get_result() {
        OneRegionSymbol.sort_by_position(this.for_bookmark);
        // 标记未匹配的 region
        while (true) {
            const r = this.region_stack.pop();
            if (!r) {
                break;
            }
            r.name = `(drop) ` + r.name;
            // 按照位置排序，从开头插入，这样没有匹配的 region 将靠前显示，便于解决
            this.for_bookmark.unshift(r);
            // 注意，如果 r 具备 children，说明其已经匹配了哟，需要提取它们！
            for (const c of r.Children) {
                this.for_outline.push(c);
            }
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
     */
    public parse_one_line(line: string, ln: number) {
        const match_result = this.parse_line(line);
        if (!match_result || !this.uri || !this.languageId) {
            return;
        }
        const { name, col, region } = match_result;
        if (region) {
            this.region_stack.push(new OneRegionSymbol(name, ln, col));
        }
        // 完成 region 的范围匹配，如果碰到多余的 endregion，则忽略
        else if (this.region_stack.length > 0) {
            const start = this.region_stack.pop()!;
            start.set_endregion(ln, col);
            // 根据栈的特性，如果当前生成的 region 上面还有 region，则添加到它的子节点中
            // 否则，添加到 region_symbols 中
            const parent = this.region_stack[this.region_stack.length - 1];
            if (parent) {
                parent.add_child(start);
            } else {
                this.for_outline.push(start);
            }
            this.for_bookmark.push(start);
            this.closed_regions.push(
                new vscode.FoldingRange(start.line, ln, vscode.FoldingRangeKind.Region)
            );
        }
    }

    /** 解析 #region 注释 */
    private readonly region_format = /#region\s*(.*)/;
    /** 解析 #endregion 注释 */
    private readonly endregion_format = /#endregion/;

    /** 匹配出一行中的 region、endregion
     * - 如果是 region，则返回其内容（name）、位置（col）以及一个标记（region: true）
     * - 如果是 endregion，则返回其位置（col），并没有包含内容哟
     *
     * ## 情况 1：位于行注释的后面
     * ```js
     * // #region xxx
     * // #endregion
     * ```
     *
     * ## 情况 2：位于块注释的中间
     * 这种情况暂时忽略吧！
     * ```js
     * /*
     *  #region xxx
     *  #endregion
     * *\/
     *```
     */
    private parse_line(line: string) {
        if (!CureCommentTable.is_line_comment(this.languageId!, line)) {
            return;
        }

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

/** 实现让 region 区域可以折叠 —— 部分编程语言的扩展并没有提供该功能，比如 rust */
export class CureRegionFoldingProvider implements vscode.FoldingRangeProvider {
    public async provideFoldingRanges(
        document: vscode.TextDocument,
        context: vscode.FoldingContext,
        token: vscode.CancellationToken
    ): Promise<vscode.FoldingRange[] | undefined> {
        await CureBookmarkManager.Instance.parse(document);
        const regions = CureRegionParser.Instance.closed_regions;
        if (regions.length === 0) {
            return;
        }
        return regions;
    }
}
