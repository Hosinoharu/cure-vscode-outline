import * as vscode from "vscode";
import { CureOneSymbol } from "../symbol";
import { retry_interval, retry_max } from "../settings";
import { bm_manager, bm_reload_for_ol } from "../bookmark";
import { OutlineSortType } from "../types/symbol";
import { CureStorage } from "../storage";

/** 管理一个文件的语法符号。单例模式 */
export class CureSymbolManager {
    private static instance?: CureSymbolManager;

    private constructor() {
        if (CureSymbolManager.instance) {
            throw new Error("CureSymbolManager is already initialized!");
        }
        CureSymbolManager.instance = this;
    }

    public static get Instance() {
        if (!this.instance) {
            this.instance = new CureSymbolManager();
        }
        return this.instance;
    }

    /** 要解析的文件路径 */
    private file?: vscode.Uri;
    /** 临时保存解析出的原始符号 */
    private symbols: vscode.DocumentSymbol[] = [];
    /** 临时保存解析出的 #region 符号 */
    private regions?: CureOneSymbol[];
    /** 记录最终转换生成的符号 */
    private cure_symbols?: CureOneSymbol[] = [];
    /** 标记当前文档解析完成 */
    private finished = false;
    /** 解析出的文件符号咯 */
    public get Symbols() {
        if (!this.file || !this.finished) {
            return [];
        }
        if (!this.cure_symbols) {
            this.cure_symbols = this.insert_region_symbols();
            this.symbols = [];
            this.regions = undefined;
        }
        return this.cure_symbols;
    }

    //#region 解析文件中原始的符号

    private reset_state() {
        this.retry_count = 0;
        this.symbols = [];
        this.regions = undefined;
        this.cure_symbols = undefined;
        this.finished = false;
    }

    /** 重新解析一个文档！成功则返回 true */
    public async update_file(doc: vscode.TextDocument) {
        this.reset_state();
        this.file = doc.uri;
        let ok = true;
        try {
            await this.update_symbols();
            this.regions = await bm_manager.get_parsed_result(doc);
            this.finished = true;
            await bm_reload_for_ol();
        } catch (e: any) {
            vscode.window.showWarningMessage(`get file symbols error: ${e.message}`);
            ok = false;
        }
        return ok;
    }

    /** 获取解析符号时，可能为空，因为解析服务还没有完成哟，所以需要重试 */
    private retry_count = 0;

    /** 更新文档中的符号列表 */
    private async update_symbols() {
        const self = this;
        if (!self.file) {
            throw new Error("symbol manager has no file");
        }
        const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
            "vscode.executeDocumentSymbolProvider",
            self.file
        );
        // 要么文件解析不出符号，或者是解析服务还没有完成
        if (symbols === undefined && self.retry_count < retry_max) {
            self.retry_count++;

            return await new Promise<void>((resolve) => {
                setTimeout(async () => {
                    resolve(await self.update_symbols());
                }, retry_interval);
            });
        } else {
            /** 警告！因为是通过执行 vscode command 来获取符号的，不要认为符号默认以位置排序！
             * 因为它受到 vscode 自带的 outline 的配置项影响！
             *
             * 也就是说，如果 vscode 的 outline 配置项是按照名称排序的，那么获取的符号树也是按照名称排序的！
             *
             * 为了保证后续对比时，符号的顺序一致，所以需要按位置进行排序
             */
            self.symbols = symbols
                ? CureStorage.Instance.sort_type !== "position"
                    ? CureOneSymbol.sort_by("position", symbols, true)
                    : symbols
                : [];
        }
    }

    /** 将 `#region` 符号插入到当前语法符号树中，返回新的符号树 */
    private insert_region_symbols() {
        const symbols = this.symbols.map((v) => CureOneSymbol.from_raw_symbol(this.file!, v));
        if (!this.regions || this.regions.length === 0) {
            return symbols;
        }

        // 按位置排序才能得到正确的嵌套关系！
        CureOneSymbol.sort_by("position", this.regions, true);
        const result = this._insert_region_symbols(symbols, this.regions);

        return CureOneSymbol.sort_by(CureStorage.Instance.sort_type, result, true);
    }

    /** 递归合并 */
    private _insert_region_symbols(symbols: CureOneSymbol[], regions: CureOneSymbol[]) {
        if (symbols.length === 0) {
            return regions;
        }
        if (regions.length === 0) {
            return symbols;
        }

        /** 记录最终合并的结果 */
        const result: CureOneSymbol[] = [];
        /** 记录当前处理的符号索引 */
        let i_s = 0;
        /** 记录当前处理的 region 符号索引 */
        let i_r = 0;
        while (i_s < symbols.length && i_r < regions.length) {
            const curr_symbol = symbols[i_s];
            const curr_region = regions[i_r];

            // s 在 region 内部，需要判断 region 中子 region 和 s 的位置关系
            if (curr_region.contains(curr_symbol)) {
                curr_region.children = this._insert_region_symbols(
                    [curr_symbol],
                    curr_region.children
                );
                ++i_s;
                continue;
            }
            // s 包含 region，需要调整 s.child 和 region 的位置
            if (curr_symbol.contains(curr_region)) {
                curr_symbol.children = this._insert_region_symbols(curr_symbol.children, [
                    curr_region,
                ]);
                ++i_r;
            }
            // s 在 region 之前
            else if (curr_symbol.is_before(curr_region)) {
                result.push(curr_symbol);
                ++i_s;
            }
            // s 在 region 之后，说明该 #region 处理完成了
            else {
                result.push(curr_region);
                ++i_r;
                // 当前的 s 还要用于下一个 region 的判断，所以这里索引不变
            }
        }

        if (i_s < symbols.length) {
            result.push(...symbols.slice(i_s));
        }
        if (i_r < regions.length) {
            result.push(...regions.slice(i_r));
        }

        return result;
    }

    //#endregion
}
