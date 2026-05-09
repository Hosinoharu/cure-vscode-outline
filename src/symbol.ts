/**
 * @module symbol
 * @description 这里定义通用的符号（语法符号或者自定义书签符号）
 * 以及通用符号的命令实现与注册
 */

import * as vscode from "vscode";
import type {
    CureSymbolKind,
    OutlineSortType,
    SortableSymbol,
    TreeItemSymbol,
} from "./types/symbol";
import crypto from "crypto";

/** 表示一个文件的任意符号哟，包括语法符号、书签等 */
export class CureOneSymbol {
    public readonly id: string;
    public readonly name: string;
    /** 符号的种类，可以根据它确定该符号应该用哪个 icon 来展示，所以这里使用字符串表示哟 */
    public readonly kind: CureSymbolKind;
    public readonly detail: string;
    /** 表示整体的范围，比如整个函数的范围 */
    public readonly range: vscode.Range;
    /** 表示符号的范围，比如函数名的范围  */
    public readonly selection_range: vscode.Range;
    /** 存储解析后的 child symbol */
    public children: CureOneSymbol[];
    /** 该符号来自哪个文件 */
    public readonly uri: vscode.Uri;

    private constructor(
        uri: vscode.Uri,
        name: string,
        kind: CureSymbolKind,
        detail: string,
        range: vscode.Range,
        selection_range: vscode.Range,
        children: vscode.DocumentSymbol[] = [],
    ) {
        this.id = crypto.randomUUID();
        this.uri = uri;
        this.name = name;
        this.kind = kind;
        this.detail = detail;
        this.range = range;
        this.selection_range = selection_range;
        this.children = children.map((v) => CureOneSymbol.from_raw_symbol(this.uri, v));
    }

    //#region 创建方式

    /** 从原始的符号创建 */
    static from_raw_symbol(uri: vscode.Uri, symbol: vscode.DocumentSymbol): CureOneSymbol {
        return new CureOneSymbol(
            uri,
            symbol.name,
            vscode.SymbolKind[symbol.kind] as CureSymbolKind,
            symbol.detail,
            symbol.range,
            symbol.selectionRange,
            symbol.children,
        );
    }

    /** 从行书签创建
     *
     * @param uri 书签所在的文件
     * @param line 书签所在的行号，从 0 开始
     * @param col 书签所在的列号，从 0 开始
     * @param name 书签名称，没有则会用所在行的内容作为名称
     */
    static from_line_bookmark(
        uri: vscode.Uri,
        line: number,
        col: number,
        name?: string,
    ): CureOneSymbol {
        // 需要获取书签所行的内容
        const doc = vscode.window.activeTextEditor?.document;
        const text = doc?.lineAt(line).text || "";
        const detail = CureOneSymbol.create_line_info(line, col);
        name = name || text.trim();
        return new CureOneSymbol(
            uri,
            name || detail,
            "CureLineBookmark",
            name ? detail : "",
            new vscode.Range(line, col, line, col + text.length),
            new vscode.Range(line, col, line, col),
        );
    }

    /** 自定义书签创建
     * @param uri 书签所在的文件
     * @param name 书签名称
     * @param line 书签所在的行号，从 0 开始
     * @param col 书签所在的列号，从 0 开始
     */
    static from_custom_bookmark(
        uri: vscode.Uri,
        name: string,
        line: number,
        col: number,
    ): CureOneSymbol {
        return new CureOneSymbol(
            uri,
            name,
            "CureCustomBookmark",
            CureOneSymbol.create_line_info(line, col),
            new vscode.Range(line, col, line, col + name.length),
            new vscode.Range(line, col, line, col),
        );
    }

    /** 创建 #region 定义的书签 */
    static from_region_bookmark(
        uri: vscode.Uri,
        name: string,
        range: vscode.Range,
        selection_range: vscode.Range,
        children: CureOneSymbol[],
    ): CureOneSymbol {
        const c = new CureOneSymbol(
            uri,
            name,
            "CureRegion",
            CureOneSymbol.create_line_info(range.start.line, range.start.character),
            range,
            selection_range,
        );
        c.children = children;
        return c;
    }

    //#endregion

    /** 获取所在行、列信息，如 (Ln 1, Col 1) */
    public get LineInfo(): string {
        const line = this.range.start.line + 1;
        const col = this.range.start.character + 1;
        return CureOneSymbol.create_line_info(line, col);
    }

    private static create_line_info(line: number, col: number): string {
        return `(Ln ${line + 1}, Col ${col + 1})`;
    }

    // #region 获取符号的图标

    private icon?: vscode.ThemeIcon;
    /** 获取该符号对应的 symbol icon
     *
     * https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
     */
    public get Icon(): vscode.ThemeIcon {
        if (this.icon !== undefined) {
            return this.icon;
        }

        let iconId = "";

        // 处理自定义的 symbol kind
        if (this.kind === "CureRegion") {
            iconId = "list-unordered";
        } else if (this.kind === "CureLineBookmark" || this.kind === "CureCustomBookmark") {
            iconId = "bookmark";
        } else {
            /** 根据观察，如果 kind 中只有一个大写，则直接转为小写即可。比如 `Function` 变为 `function`
             *
             * 否则，需要在原本大写的前面加上 - 符号。比如 `TypeParameter` 变为 `type-parameter`
             */
            const str = this.kind
                .replace(/([A-Z][a-z]*)+?/g, "-$1")
                .slice(1)
                .toLowerCase();
            iconId = `symbol-${str}`;
        }

        this.icon = new vscode.ThemeIcon(iconId, this.Color);
        return this.icon;
    }

    private color?: vscode.ThemeColor;
    /** 获取该符号对应的 symbol color
     *
     * https://code.visualstudio.com/api/references/theme-color#symbol-icons-colors
     */
    public get Color(): vscode.ThemeColor {
        if (this.color !== undefined) {
            return this.color;
        }

        this.color = CureOneSymbol.get_color_from_kind(this.kind);
        return this.color;
    }

    /** 根据符号种类、生成其 Color */
    public static get_color_from_kind(kind: CureSymbolKind): vscode.ThemeColor {
        let colorId = "";
        // 处理自定义的 symbol kind
        if (kind === "CureRegion") {
            colorId = "symbolIcon.namespaceForeground";
        } else if (kind === "CureLineBookmark" || kind === "CureCustomBookmark") {
            colorId = "symbolIcon.namespaceForeground";
        } else {
            // 比如 `Function` 变为 `functionForeground`
            const str = kind[0].toLowerCase() + kind.slice(1) + "Foreground";
            colorId = `symbolIcon.${str}`;
        }
        return new vscode.ThemeColor(colorId);
    }

    // #endregion 获取符号的图标

    // #region 获取符号的注释

    /** 该符号上面的注释内容 */
    private comment?: string;
    /** 获取该符号所在行、以及上方的注释。
     *
     * 如果上方是空行，则不会继续向上查找！
     */
    public get Comment(): string {
        if (this.kind === "CureCustomBookmark" || this.kind === "CureRegion") {
            return this.name;
        }
        if (this.comment !== undefined) {
            return this.comment;
        }
        const curr_doc = vscode.window.activeTextEditor?.document;
        if (curr_doc === undefined || curr_doc.uri.toString() !== this.uri.toString()) {
            return "[Current document is not the same as the symbol's document]";
        }

        // 注意使用 selection_range，它才是符号的真正起始行！
        const start_line = this.selection_range.start.line;
        if (start_line < 0 || start_line >= curr_doc.lineCount) {
            return "";
        }

        const curr_line_text = curr_doc.lineAt(start_line).text.trim();
        if (start_line === 0) {
            this.comment = curr_line_text;
            return this.comment;
        }

        const comments = [curr_line_text];
        // 从符号的上一行开始咯，好像 python 中的文档注释可以写在下面？？算了，先不管了
        let curr_line = start_line - 1;
        const line = curr_doc.lineAt(curr_line).text.trim();
        // 如果向上查看的第一行是块注释，则需要标记，直到找到块注释的起始位置为止
        const is_block_comment_end = CureCommentTable.is_block_comment_end(
            curr_doc.languageId.toLowerCase(),
            line,
        );

        while (curr_line >= 0) {
            const _line = curr_doc.lineAt(curr_line);
            // 如果不是在块注释区域，那么碰到空行直接结束了
            if (_line.isEmptyOrWhitespace && !is_block_comment_end) {
                break;
            }
            const line = _line.text.trim();

            // 如果是块注释的开始，那么就跳出循环
            if (CureCommentTable.is_block_comment_start(curr_doc.languageId.toLowerCase(), line)) {
                comments.unshift(line);
                break;
            }

            // 如果是块注释，那么中间的行直接添加，不管空格等等，否则需要判断每一行
            if (
                !is_block_comment_end &&
                // 根据不同语言，查看当前行是否为注释了
                (!line ||
                    !CureCommentTable.is_line_comment(curr_doc.languageId.toLowerCase(), line))
            ) {
                break;
            }
            // 为了保持最终生成的注释的顺序，需要从头添加
            // 这里没有去除注释前面的 // 等符号，懒得弄了，比较麻烦
            comments.unshift(line);
            --curr_line;
        }

        this.comment = comments.join("\n");
        return this.comment;
    }

    // #endregion 获取符号的注释

    //#region 符号的先后判断
    // 很多时候需要判断符号的先后位置，通常是以【符号的位置】来判断
    // 但当符号排序后，就需要使用特定的排序方式来判断先后位置了

    /** 判断当前符号是否包含另一个符号 */
    public contains(other: CureOneSymbol): boolean {
        return this.range.contains(other.range);
    }

    /** 判断当前符号是否在另一个符号之后。即下面这种情况：
     *
     * ## 按位置排序时
     * ```
     * other.start
     * other.end
     * // 这才是真正的 my 在 other 之后
     * my.start
     * my.end
     * ```
     */
    public is_after(other: CureOneSymbol, type: OutlineSortType = "position"): boolean {
        switch (type) {
            case "kind":
                return this.kind.localeCompare(other.kind) > 0;
            case "name":
                return this.name.localeCompare(other.name) > 0;
            case "position":
                return this.range.start.isAfter(other.range.end);
        }
    }

    /** 判断当前符号是否在另一个符号之前。即下面这种情况：
     *
     * ## 按位置排序时
     * ```
     * my.start
     * my.end
     * // 这才是真正的 my 在 other 之前
     * other.start
     * other.end
     * ```
     */
    public is_before(other: CureOneSymbol, type: OutlineSortType = "position"): boolean {
        switch (type) {
            case "kind":
                return this.kind.localeCompare(other.kind) < 0;
            case "name":
                return this.name.localeCompare(other.name) < 0;
            case "position":
                return this.range.end.isBefore(other.range.start);
        }
    }

    //#endregion

    //#region 符号的排序
    // 为了兼容很多类型，所以用了很多 @ts-ignore

    static sort_by<T extends SortableSymbol>(type: OutlineSortType, s: T, recurse = false) {
        switch (type) {
            case "position":
                return this.sort_by_position(s, recurse);
            case "name":
                return this.sort_by_name(s, recurse);
            case "kind":
                return this.sort_by_kind(s, recurse);
        }
    }

    /** 对符号进行按位置排序
     * ```
     * // 只看符号的起始位置，不在乎结束位置
     * A.start
     * B.start
     * A.end
     * B.end
     * ```
     */
    private static sort_by_position<T extends SortableSymbol>(s: T, recurse = false) {
        // @ts-ignore
        const has_symbol = s[0]?.symbol !== undefined;
        if (has_symbol) {
            const t = s as TreeItemSymbol[];
            t.sort((a, b) => a.symbol.range.start.compareTo(b.symbol.range.start));
        } else {
            const t = s as CureOneSymbol[];
            t.sort((a, b) => a.range.start.compareTo(b.range.start));
        }
        if (recurse) {
            s.forEach((item) => {
                // @ts-ignore
                CureOneSymbol.sort_by_position(item.Children ?? item.children, true);
            });
        }
        return s;
    }

    private static sort_by_name<T extends SortableSymbol>(s: T, recurse = false) {
        // @ts-ignore
        const has_symbol = s[0]?.symbol !== undefined;
        if (has_symbol) {
            const t = s as TreeItemSymbol[];
            t.sort((a, b) => a.symbol.name.localeCompare(b.symbol.name));
        } else {
            const t = s as CureOneSymbol[];
            t.sort((a, b) => a.name.localeCompare(b.name));
        }
        if (recurse) {
            s.forEach((item) => {
                // @ts-ignore
                CureOneSymbol.sort_by_name(item.Children ?? item.children, true);
            });
        }
        return s;
    }

    /** 按照符号的种类排序，同时内部按照名称排序哟 */
    private static sort_by_kind<T extends SortableSymbol>(s: T, recurse = false) {
        // 每个 kind 下的 item 应该按名称排序
        this.sort_by_name(s, recurse);
        // @ts-ignore
        const has_symbol = s[0]?.symbol !== undefined;
        if (has_symbol) {
            const t = s as TreeItemSymbol[];
            t.sort((a, b) => a.symbol.kind.localeCompare(b.symbol.kind));
        } else {
            if (s[0] instanceof CureOneSymbol) {
                const t = s as CureOneSymbol[];
                t.sort((a, b) => a.kind.localeCompare(b.kind));
            } else {
                const t = s as vscode.DocumentSymbol[];
                t.sort((a, b) => a.kind - b.kind);
            }
        }
        if (recurse) {
            s.forEach((item) => {
                // @ts-ignore
                CureOneSymbol.sort_by_kind(item.Children ?? item.children, true);
            });
        }
        return s;
    }

    //#endregion
}

/** 通用符号的命令实现与注册 */
export class CureSymbolCMD {
    private static instance?: CureSymbolCMD;

    private constructor() {
        if (CureSymbolCMD.instance) {
            throw new Error("CureSymbolCMD is already initialized!");
        }
        CureSymbolCMD.instance = this;
    }

    public static get Instance() {
        if (!this.instance) {
            throw new Error("CureSymbolCMD is not initialized!");
        }
        return this.instance;
    }

    /** 注册所有此类的命令 */
    public static register(ctx: vscode.ExtensionContext) {
        const self = new CureSymbolCMD();
        const commands = [self.register_locate()];
        ctx.subscriptions.push(...commands);
        return self;
    }

    // #region 定位到符号的位置

    /** 定位到符号的位置 */
    private readonly cmd_locate = "cure-outline.locate";

    /** 定位到该符号的位置。会打开其所在的文件 */
    private register_locate() {
        return vscode.commands.registerCommand(
            this.cmd_locate,
            async (treeitem: { symbol: CureOneSymbol }, callback?: () => Promise<void>) => {
                try {
                    await callback?.();
                    const symbol = treeitem.symbol;
                    const editor = await vscode.window.showTextDocument(symbol.uri);
                    // 定位到指定位置，并且高亮所在位置
                    const range = symbol.selection_range;
                    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                    editor.selection = new vscode.Selection(range.start, range.end);
                } catch (e: any) {
                    vscode.window.showErrorMessage("open file failed:" + e.message);
                    return;
                }
            },
        );
    }

    /** 创建符号跳转的命令。指定符号、以及**触发点击之前**的操作
     *
     * ## 为什么要设定为触发点击之前，而不是点击之后呢？
     * 因为现在实现 tree item 点击并居中时，会丢失编辑器中的焦点，聚焦到 tree item 上，
     * 所以需要提前执行，然后定位到编辑器中才行啦！
     */
    public create_locate(
        treeitem: { symbol: CureOneSymbol },
        callback?: () => Promise<void>,
    ): vscode.Command {
        return {
            title: "locate",
            command: this.cmd_locate,
            arguments: [treeitem, callback],
        };
    }

    // #endregion 定位到符号的位置
}

/** 表示一种语言的注释信息，如行注释、块注释是怎样的 */
interface CommentInfo {
    line: string[];
    block: { start: string; end: string }[];
}

/** 通过它查询每个编程语言的行注释、块注释。
 *
 * 根据查询 AI，最可靠的方式是**查询对应语言扩展的配置项来获取**，似乎有点麻烦，
 * 所以直接硬编码在这里了。
 *
 * 这些编程语言名称在：https://code.visualstudio.com/docs/languages/identifiers#_known-language-identifiers
 *
 * 还是等官方修复？[getLanguageConfiguration() API method is missing](https://github.com/microsoft/vscode/issues/109919)
 */
export class CureCommentTable {
    /** 存储现有 VSCode 支持的编程语言的注释信息，由 AI 生成！
     *
     * 其 `value` 可以是另一个编程语言的名称 —— 因为有些编程语言的注释信息是相同的啦
     */
    private static readonly comment_info = new Map<string, string | string[] | CommentInfo>([
        // c 语言系列
        ["c", { line: ["//"], block: [{ start: "/*", end: "*/" }] }],
        ["cpp", "c"],
        ["csharp", "c"],
        ["javascript", "c"],
        ["typescript", "c"],
        ["java", "c"],
        ["groovy", "c"],
        ["scala", "c"],
        ["kotlin", "c"],
        ["dart", "c"],
        ["rust", "c"],
        ["go", "c"],
        ["swift", "c"],
        ["objective-c", "c"],
        ["objective-cpp", "c"],
        ["php", { line: ["//", "#"], block: [{ start: "/*", end: "*/" }] }],
        ["gdscript", { line: ["#"], block: [] }],

        // shell 系列
        ["shellscript", { line: ["#"], block: [] }],
        [
            "python",
            {
                line: ["#"],
                block: [
                    { start: '"""', end: '"""' },
                    { start: "'''", end: "'''" },
                ],
            },
        ],
        ["ruby", { line: ["#"], block: [{ start: "=begin", end: "=end" }] }],
        ["perl", { line: ["#"], block: [{ start: "=begin", end: "=end" }] }],
        ["perl6", { line: ["#"], block: [{ start: "=begin", end: "=end" }] }],
        ["r", { line: ["#"], block: [] }],
        ["lua", { line: ["--"], block: [{ start: "--[[", end: "]]" }] }],
        ["haskell", { line: ["--"], block: [{ start: "{-", end: "-}" }] }],

        // html/xml 系列
        ["html", { line: [], block: [{ start: "<!--", end: "-->" }] }],
        ["xml", "html"],
        ["xsl", "html"],
        ["vue", ["html", "javascript", "typescript", "css"]],
        ["vue-html", "html"],
        ["razor", "html"],

        // css 系列
        ["css", { line: [], block: [{ start: "/*", end: "*/" }] }],
        ["scss", "css"],
        ["less", "css"],
        ["sass", "css"],
        ["stylus", { line: ["//"], block: [] }],

        // 其他语言
        ["bat", { line: ["::", "REM"], block: [] }],
        ["ini", { line: [";", "#"], block: [] }],
        ["makefile", { line: ["#"], block: [] }],
        ["dockerfile", { line: ["#"], block: [] }],
        ["dockercompose", { line: ["#"], block: [] }],
        ["yaml", { line: ["#"], block: [] }],
        ["json", { line: [], block: [] }],
        ["jsonc", { line: ["//"], block: [{ start: "/*", end: "*/" }] }],
        ["markdown", { line: [], block: [] }],
        ["plaintext", { line: [], block: [] }],
        ["sql", { line: ["--"], block: [{ start: "/*", end: "*/" }] }],
        [
            "pascal",
            {
                line: ["//"],
                block: [
                    { start: "{", end: "}" },
                    { start: "(*", end: "*)" },
                ],
            },
        ],
        ["delphi", "pascal"],
        ["erlang", { line: ["%"], block: [] }],
        ["clojure", { line: [";"], block: [{ start: "#_(", end: ")" }] }],
        ["fsharp", { line: ["//"], block: [{ start: "(*", end: "*)" }] }],
        ["ocaml", "fsharp"],
        ["julia", { line: ["#"], block: [{ start: "#=", end: "=#" }] }],
        ["coffeescript", { line: ["#"], block: [{ start: "###", end: "###" }] }],
        ["elm", { line: ["--"], block: [{ start: "{-", end: "-}" }] }],
        ["vim", { line: ['"'], block: [] }],
        ["matlab", { line: ["%"], block: [{ start: "%{", end: "%}" }] }],
    ]);

    /** 返回对应编程语言的注释信息 */
    private static get_comment_info(languageId: string): CommentInfo[] {
        const info = this.comment_info.get(languageId);
        if (!info) {
            return [];
        }

        if (typeof info === "string") {
            return this.get_comment_info(info);
        } else if (Array.isArray(info)) {
            const infos: CommentInfo[] = [];
            for (const item of info) {
                const t = this.get_comment_info(item);
                t && infos.push(...t);
            }
            return infos;
        }

        return [info];
    }

    /** 判断某一行文本是否为注释 */
    public static is_line_comment(languageId: string, line: string): boolean {
        line = line.trim();
        for (const info of this.get_comment_info(languageId)) {
            if (info?.line) {
                for (const comment of info.line) {
                    if (line.startsWith(comment) || this.is_special_comment(languageId, line)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /** 判断某行文本是否为块注释的起始 */
    public static is_block_comment_start(languageId: string, line: string): boolean {
        line = line.trim();
        for (const info of this.get_comment_info(languageId)) {
            if (info?.block) {
                for (const comment of info.block) {
                    if (line.startsWith(comment.start)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /** 判断某行文本是否为块注释的结束 */
    public static is_block_comment_end(languageId: string, line: string): boolean {
        line = line.trim();
        for (const info of this.get_comment_info(languageId)) {
            if (info?.block) {
                for (const comment of info.block) {
                    if (line.endsWith(comment.end)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /** 有些编程语言有一些特殊的行，比如 rust 中的 `#[...]` */
    private static is_special_comment(languageId: string, line: string): boolean {
        switch (languageId) {
            case "rust":
                return line.startsWith("#[");

            default:
                return false;
        }
    }
}
