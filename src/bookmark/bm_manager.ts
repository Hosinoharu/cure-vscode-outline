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
    /** 解析 #region 注释 */
    private readonly region_format = /#region\s*(.*)/;

    /** 从一行文本中解析出自定义的书签，返回匹配的内容以及所在的列 */
    private parse_format(line: string) {
        const custom = line.match(this.cutstom_format);
        if (custom) {
            return { name: custom[1].trim(), col: custom.index || 0, custom: true };
        }
        const region = line.match(this.region_format);
        if (region) {
            return { name: region[1].trim(), col: region.index || 0 };
        }
    }

    /** 读取文档内容，解析出其中的自定义标签
     * @param uri 指定解析出的书签来自哪里
     * @param content 如果已经具备内容，则直接使用，否则从文件中读取
     *
     * @return true 表示解析成功，false 表示解析失败
     */
    public async update_file(uri: vscode.Uri, content: string) {
        if (vscode.window.activeTextEditor?.document.uri.fsPath !== uri.fsPath) {
            return false;
        }

        const lines = content.split("\n");
        // 不需要判断是否为注释之类的情况，反正是我自己用
        const result: CureOneSymbol[] = [];
        for (let i = 0; i < lines.length; i++) {
            const match_result = this.parse_format(lines[i]);
            if (!match_result) {
                continue;
            }
            const { name, col, custom } = match_result;
            const symbol = custom
                ? CureOneSymbol.from_custom_bookmark(uri, name, i, col)
                : CureOneSymbol.from_region_bookmark(uri, name, i, col);
            result.push(symbol);

            this.add_gutter_icon(i);
        }
        this.category["custom"] = result;
        return true;
    }

    /** 记录指定位置的行首 gutter icon  */
    private decoration_location: Map<number, vscode.TextEditorDecorationType> = new Map();

    /** 解析出一个标签后，在它的行首添加一个 icon 标记咯 */
    private add_gutter_icon(line: number) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || this.decoration_location.has(line)) {
            return;
        }

        const decoration = vscode.window.createTextEditorDecorationType({
            gutterIconPath: bookmark_gutter_icon,
            gutterIconSize: "contain",
        });
        const range = new vscode.Range(line, 0, line, 0);
        editor.setDecorations(decoration, [range]);
        this.decoration_location.set(line, decoration);
    }

    //#endregion
}
