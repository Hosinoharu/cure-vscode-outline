import * as vscode from "vscode";
import { CureOneSymbol } from "../symbol";
import { OneDiffInfo } from "../types/symbol";
import { retry_interval, retry_max } from "../settings";
import { bm_manager, bm_reload } from "../bookmark";

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
    private region_symbols?: CureOneSymbol[];
    /** 解析出的文件符号咯 */
    public get Symbols() {
        return this.file ? this.insert_region_symbols() : [];
    }

    /** 获取解析符号时，可能为空，因为解析服务还没有完成哟，所以需要重试 */
    private retry_count = 0;

    //#region 解析文件中原始的符号

    /** 在重新解析文件之前需要进行判断：
     * - 如果本次解析的文件上次解析的文件相同，那么应该调用 `get_diff_info()` 获取差异信息，然后更新符号树
     * - 如果本次解析的文件上次解析的文件不同，那么应该调用 `update_file()` 更新整个符号树
     */
    public is_same_file(file: vscode.Uri) {
        return this.file?.fsPath === file.fsPath;
    }

    /** 重新解析一个文档！成功则返回 true
     *
     * @param content 文档的内容，用于解析自定义符号，主要是解析出 #region 符号
     * @param file 如果外部发现 file 的内容是空的内容，则不解析。
     * 这是因为某些情况下，文件中没有内容，导致符号解析得到 undefined
     */
    public async update_file(content: string, file?: vscode.Uri) {
        this.retry_count = 0;
        this.symbols = [];
        try {
            if (file) {
                this.file = file;
                await this.update_symbols();
                this.region_symbols = await bm_manager.update_file(file, content);
                bm_reload();
            }
            return true;
        } catch (e: any) {
            vscode.window.showErrorMessage(`get file symbols error: ${e.message}`);
            return false;
        }
    }

    /** 获取和上次解析符号时的差异信息，用于更新符号树
     *@param content 文档的内容
     * @returns 返回 undefined 表示彻底重新加载整个符号树
     */
    public async get_diff_info(content: string): Promise<OneDiffInfo[] | undefined> {
        const last_symbols = this.symbols;
        await this.update_symbols();
        const new_symbols = this.symbols;
        this.region_symbols = await bm_manager.update_file(this.file!, content);
        bm_reload();
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
        // 要么文件没有内容，或者是解析服务还没有完成
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
            self.symbols = symbols ? this.sort_by_position(symbols) : [];
        }
    }

    private sort_by_position(symbols: vscode.DocumentSymbol[]) {
        symbols.sort((a, b) => (a.range.start.isBefore(b.range.start) ? -1 : 1));
        for (const symbol of symbols) {
            symbol.children = this.sort_by_position(symbol.children);
        }
        return symbols;
    }

    /** 将 `#region` 符号插入到当前语法符号树中，返回新的符号树 */
    private insert_region_symbols() {
        const cure_symbols = this.symbols.map((v) => CureOneSymbol.from_raw_symbol(this.file!, v));
        if (!this.region_symbols || this.region_symbols.length === 0) {
            return cure_symbols;
        }

        // // 现在要将 region_symbols 插入到 cure_symbols 中，且给 region_symbols 添加子项
        // // 首先将 region_symbols 按照位置排序（cure_symbols 在获取时已经排序了）
        // // 注意，默认情况下得到的 #region 符号都是独立、且没有子项的，所以可以直接排序！！
        this.region_symbols.sort((a, b) => (a.range.start.isBefore(b.range.start) ? -1 : 1));
        return this._insert_region_symbols(cure_symbols, this.region_symbols);
    }

    /** 插入算法说明
     *
     * 假设现在有一个数组 `r` 保存最终的结果。
     *
     * # 情况 1：在顶层符号之间
     * ```
     * // 1. 如果顶层符号比 #region 靠前，则直接插入 r 中
     * A
     * // 2. 如果顶层符号在 #region 中，则插入到 #region 的子项中
     * #region
     * B
     * #endregion
     * // 3. 如果顶层符号比 #region 靠后，则说明一个 region 范围已经结束
     * // 将该 region 插入到 r 中，此时不处理 C。读取下一个 #region 符号，然后从 C 开始重复之前的操作
     * C
     * ```
     *
     * # 情况 2：在顶层符号内部
     * ```
     * // 顶层符号包含了 #region，则相当于特殊的情况 1 哟，递归处理就好
     * A
     *      #region
     *      B
     *      #endregion
     * ```
     *
     * # 情况 3：region 的嵌套
     * ```
     * // 当进入到 region 内部后，对每个符号，都要和【位于 region 内部的 #region】比较
     * // 又是一个递归
     * #region
     *      ...
     *      #region
     *      ...
     *      #endregion
     *      ...
     * #endregion
     * ```
     */
    private _insert_region_symbols(symbols: CureOneSymbol[], regions: CureOneSymbol[]) {
        if (regions.length === 0) {
            return symbols;
        }

        const result: CureOneSymbol[] = [];
        /** 记录当前的 region 符号的索引 */
        let i = 0;
        /** 记录当前的 region 符号 */
        let curr_region = regions[i];
        /** 记录是否处理过当前的 region（也就是加入到最终数组中） */
        let handled = false;
        for (let j = 0; j < symbols.length; ) {
            if (i >= regions.length) {
                result.push(symbols[j++]);
                continue;
            }
            const s = symbols[j];
            // s 在 region 内部，需要判断 region 中子 region 和 s 的位置关系
            if (curr_region.contains(s)) {
                curr_region.Children = this._insert_region_symbols([s], curr_region.Children);
                ++j;
                continue;
            }
            // s 包含 region，需要调整 s.child 和 region 的位置
            if (s.contains(curr_region)) {
                s.Children = this._insert_region_symbols(s.Children, [curr_region]);
                result.push(s);
                ++j;
                continue;
            }
            // s 在 region 之前
            if (s.is_before(curr_region)) {
                result.push(s);
                ++j;
                continue;
            }
            // s 在 region 之后，说明该 #region 处理完成了
            else if (s.is_after(curr_region)) {
                result.push(curr_region);
                curr_region = regions[++i];
                handled = true;
                continue;
            }
        }
        if (!handled) {
            result.push(curr_region);
            ++i;
        }
        // 说明还有 region 没有处理完，它们没有包含任何符号
        if (i < regions.length) {
            result.push(...regions.slice(i));
        }
        return result;
    }

    //#endregion
}
