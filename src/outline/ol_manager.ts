import * as vscode from "vscode";
import { CureOneSymbol } from "../symbol";
import { OneDiffInfo } from "../types/symbol";
import { retry_interval, retry_max } from "../settings";
import { bm_manager, bm_reload_for_ol } from "../bookmark";

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
    /** 保存上一次解析出的原始符号 */
    private symbols: vscode.DocumentSymbol[] = [];
    /** 保存上一次解析出的 #region 符号 */
    private regions?: CureOneSymbol[];
    /** 解析出的文件符号咯 */
    public get Symbols() {
        return this.file ? this.insert_region_symbols() : [];
    }

    //#region 解析文件中原始的符号

    /** 在重新解析文件之前需要进行判断：
     * - 如果本次解析的文件上次解析的文件相同，那么应该调用 `get_diff_info()` 获取差异信息，然后更新符号树
     * - 如果本次解析的文件上次解析的文件不同，那么应该调用 `update_file()` 更新整个符号树
     */
    public is_same_file(file: vscode.Uri) {
        return this.file?.fsPath === file.fsPath;
    }

    /** 获取解析符号时，可能为空，因为解析服务还没有完成哟，所以需要重试 */
    private retry_count = 0;

    private reset_state() {
        this.retry_count = 0;
        this.symbols = [];
        this.regions = undefined;
    }

    /** 重新解析一个文档！成功则返回 true */
    public async update_file(doc: vscode.TextDocument) {
        this.reset_state();
        this.file = doc.uri;
        let ok = true;
        try {
            await this.update_symbols();
            this.regions = await bm_manager.update_file(doc);
            bm_reload_for_ol();
        } catch (e: any) {
            vscode.window.showWarningMessage(`get file symbols error: ${e.message}`);
            ok = false;
        }
        return ok;
    }

    //#region 符号的更新、差异对比

    /** 获取和上次解析符号时的差异信息，用于更新符号树
     * @returns 返回 undefined 表示彻底重新加载整个符号树
     */
    public async get_diff_info(doc: vscode.TextDocument): Promise<OneDiffInfo[] | undefined> {
        const last_symbols = this.symbols;
        await this.update_symbols();
        const new_symbols = this.symbols;
        this.regions = await bm_manager.update_file(doc);
        bm_reload_for_ol();
        return this._get_diff_info(last_symbols, new_symbols);
    }

    private _get_diff_info(
        last_symbols: vscode.DocumentSymbol[],
        new_symbols: vscode.DocumentSymbol[]
    ) {
        // 顶层符号的个数变化，需要重新刷新整个树
        if (last_symbols.length !== new_symbols.length) {
            return undefined;
        }

        const result: OneDiffInfo[] = [];
        for (let i = 0; i < last_symbols.length; i++) {
            const last = last_symbols[i];
            const new_symbol = new_symbols[i];
            const children = this._get_diff_info(last.children, new_symbol.children);
            const changed = !children || this.is_changed(last, new_symbol);
            result.push({
                refresh: changed,
                new: CureOneSymbol.from_raw_symbol(this.file!, new_symbol),
                children: children,
            });
        }
        return result;
    }

    /** 比较符号是否发生了变化 */
    private is_changed(last: vscode.DocumentSymbol, new_symbol: vscode.DocumentSymbol) {
        if (last.name !== new_symbol.name || last.kind !== new_symbol.kind) {
            return true;
        }
        return false;
    }

    //#endregion

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
            // 确保解析完成
            return await new Promise<void>((resolve) => {
                setTimeout(async () => {
                    resolve(await self.update_symbols());
                }, retry_interval);
            });
        } else {
            // 为了保证后续对比时，符号的顺序一致，所以需要按位置排序
            self.symbols = symbols ? CureOneSymbol.sort_by_position(symbols, true) : [];
        }
    }

    /** 将 `#region` 符号插入到当前语法符号树中，返回新的符号树 */
    private insert_region_symbols() {
        const cure_symbols = this.symbols.map((v) => CureOneSymbol.from_raw_symbol(this.file!, v));
        if (!this.regions || this.regions.length === 0) {
            return cure_symbols;
        }

        CureOneSymbol.sort_by_position(this.regions, true);
        return this._insert_region_symbols(cure_symbols, this.regions);
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
        /** 记录当前的 region 符号的索引 */
        let i_r = 0;
        /** 记录当前的 region 符号 */
        let curr_region = regions[i_r];
        /** 记录是否处理过当前的 region（也就是加入到最终数组中） */
        let handled = false;

        for (let i_s = 0; i_s < symbols.length; i_s++) {
            if (i_r >= regions.length) {
                result.push(symbols[i_s]);
                continue;
            }

            const s = symbols[i_s];
            // s 在 region 内部，需要判断 region 中子 region 和 s 的位置关系
            if (curr_region.contains(s)) {
                curr_region.Children = this._insert_region_symbols([s], curr_region.Children);
                continue;
            }
            // s 包含 region，需要调整 s.child 和 region 的位置
            if (s.contains(curr_region)) {
                s.Children = this._insert_region_symbols(s.Children, [curr_region]);
                result.push(s);
            }
            // s 在 region 之前
            else if (s.is_before(curr_region)) {
                result.push(s);
            }
            // s 在 region 之后，说明该 #region 处理完成了
            else {
                result.push(curr_region);
                curr_region = regions[++i_r];
                handled = true;
                // 当前的 s 还要用于下一个 region 的判断，所以这里索引减少 1
                --i_s;
            }
        }

        if (!handled) {
            result.push(curr_region);
            ++i_r;
        }
        // 说明还有 region 没有处理完，它们没有包含任何语法符号，也添加到后面吧
        if (i_r < regions.length) {
            result.push(...regions.slice(i_r));
        }
        return result;
    }

    //#endregion
}
