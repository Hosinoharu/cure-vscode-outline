import * as vscode from "vscode";
import { CureOneSymbol } from "../symbol";
import { BookmarkCategory } from "../types/symbol";

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

    /** 解析出自定义标签的正则，直接读取 #cure-xx 后面 xx 的所有内容 */
    private readonly cutstom_format = /#cure-(.*)/;

    /** 读取文档内容，解析出其中的自定义标签
     * @param uri 指定解析出的书签来自哪里
     * @param content 如果已经具备内容，则直接使用，否则从文件中读取
     *
     * @return true 表示解析成功，false 表示解析失败
     */
    public async update_file(uri: vscode.Uri, content?: string) {
        let lines: string[] = [];
        if (content) {
            lines = content.split("\n");
        } else {
            try {
                lines = (await vscode.workspace.fs.readFile(uri)).toString().split("\n");
            } catch (e) {
                vscode.window.showErrorMessage("Bookmark Manager: read file failed");
                return false;
            }
        }
        // 不需要判断是否为注释之类的情况，反正是我自己用
        const result: CureOneSymbol[] = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(this.cutstom_format);
            if (!match || !match[1]) {
                continue;
            }
            const name = match[1];
            const col = match.index || 0;
            const symbol = CureOneSymbol.from_custom_bookmark(uri, name, i, col);
            result.push(symbol);
        }
        this.category["custom"] = result;
        return true;
    }

    /** 保存书签到本地咯 */
    public async save() {}
}
