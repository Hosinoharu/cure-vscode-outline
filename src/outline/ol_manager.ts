import * as vscode from "vscode";
import { CureOneSymbol } from "../symbol";

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

    //#region 解析的重试

    /** 获取解析符号时，可能为空，因为解析服务还没有完成哟，所以需要重试 */
    private retry_count = 0;
    /** 最大重试次数 */
    private readonly retry_max = 5;
    /** 重试间隔 */
    private readonly retry_interval = 200;

    //#endregion

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
     * @requires - 返回 undefined 表示没有差异
     */
    public async get_diff_info() {
        console.log("get_diff_info todo");
        return undefined;
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
        if (symbols === undefined && self.retry_count < self.retry_max) {
            self.retry_count++;
            // 确保解析完成
            return await new Promise<void>((resolve) => {
                setTimeout(async () => {
                    resolve(await self.update_symbols());
                }, self.retry_interval);
            });
        } else {
            self.symbols = symbols;
        }
    }

    //#endregion
}
