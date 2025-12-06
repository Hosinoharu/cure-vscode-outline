import * as vscode from "vscode";
import { CureOneSymbol } from "../symbol";
import { OneDiffInfo } from "../types/symbol";
import { retry_interval, retry_max } from "../settings";

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
    /** 解析出的文件符号咯 */
    public get Symbols() {
        return this.file
            ? this.symbols.map((v) => CureOneSymbol.from_raw_symbol(this.file!, v))
            : [];
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
     * @param file 如果外部发现 file 的内容是空的内容，则不解析。
     * 这是因为某些情况下，文件中没有内容，导致符号解析得到 undefined
     */
    public async update_file(file?: vscode.Uri) {
        this.retry_count = 0;
        this.symbols = [];
        try {
            if (file) {
                this.file = file;
                await this.update_symbols();
            }
            return true;
        } catch (e: any) {
            vscode.window.showErrorMessage(`get file symbols error: ${e.message}`);
            return false;
        }
    }

    /** 获取和上次解析符号时的差异信息，用于更新符号树
     *
     * @returns 返回 undefined 表示彻底重新加载整个符号树
     */
    public async get_diff_info(): Promise<OneDiffInfo[] | undefined> {
        const last_symbols = this.symbols;
        await this.update_symbols();
        const new_symbols = this.symbols;
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
            const children = this._get_diff_info(
                this.sort_by_position(last.children),
                this.sort_by_position(new_symbol.children)
            );
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
            self.symbols = this.sort_by_position(symbols);
        }
    }

    private sort_by_position(symbols: vscode.DocumentSymbol[]) {
        return symbols.sort((a, b) => (a.range.start.isBefore(b.range.start) ? -1 : 1));
    }

    //#endregion
}
