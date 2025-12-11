/**
 * @module storage
 * @description 读写配置项、以及上下文的操作 —— 修改配置项时，会自动更新上下文。
 * - 搜索、过滤的设置都在 TreeViewProvider 中进行而不是在 ol_cmd 中，这可以减少代码
 */

import * as vscode from "vscode";
import { OutlineFilterType, OutlineSortType, SwitchCmdType } from "./types/symbol";
import { CureSymbolTreeViewCMD } from "./outline/ol_cmd";

/** 保存插件的内置配置项。单例模式 */
export class CureStorage {
    private readonly setting_domaim = "cure-outline";
    private static instance?: CureStorage;
    public static get Instance() {
        if (!this.instance) {
            throw new Error("CureStorage is not initialized");
        }
        return this.instance;
    }

    private constructor(private ctx: vscode.ExtensionContext) {
        if (CureStorage.instance) {
            throw new Error("CureStorage is already initialized");
        }
        CureStorage.instance = this;
    }

    public static register(ctx: vscode.ExtensionContext) {
        const self = new CureStorage(ctx);
        self.init_all_context();

        ctx.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration((e) => {
                // 修改过滤
                if (e.affectsConfiguration(self.affect_filter_type)) {
                    CureSymbolTreeViewCMD.Instance.update_filter_from_setting();
                }
            })
        );
    }

    /** 初始化所有命令的上下文哟 */
    private init_all_context() {
        // 默认情况下不展开
        this.update_switch_context("expand-all-off");
        this.update_switch_context("expand-only-one-off");
        this.update_sort_context(this.sort_type);
        this.filter_type.forEach((v) => {
            this.update_switch_context(`filter-${v}`);
        });

        this.update_follow_cursor_context(this.follow_cursor);
        this.update_follow_viewport_context(this.follow_viewport);
    }

    //#region 开关式命令的上下文管理

    // 开关式命令：具备【开启、关闭】两种状态的命令，比如【全部折叠、全部展开】就是【一对开关命令】
    // 开关式上下文是为了在菜单中可以显示【已启用、未启用】两种状态
    // 上下文的命名格式如下：加入 `expand-all` 是开关命令，那么 `expand-off` 就是关闭命令
    // 那么上下文 `cure-outline-is-expand-all` 就是开关式上下文
    // 注意：在执行开关类命令的时候，需要【更新上下文】哟

    /** 更新开关式命令的上下文，此类上下文命名格式：`cure-outline-is-xxx`
     * - 比如传入 `expand-all`，这说明上下文 `ure-outline-is-expand-all` 为 `true`
     * - 比如传入 `expand-all-off`，这说明上下文 `ure-outline-is-expand-all` 为 `false`
     */
    public update_switch_context(type: SwitchCmdType) {
        const index = type.indexOf("-off");
        const is_on = index < 0;
        const name = is_on ? type : type.slice(0, index);

        vscode.commands.executeCommand("setContext", `cure-outline-is-${name}`, is_on);
    }

    /** 更新排序的上下文。 只有在切换排序方式的时候，才需要更新上下文！
     *
     * 将另外两个排序的上下文设置为 `false` 就可以不显示那两个了
     */
    private update_sort_context(type: OutlineSortType) {
        // 修改其它排序方式的上下文
        const sorts: OutlineSortType[] = ["position", "name", "kind"];
        sorts.forEach((v) => {
            if (v !== type) {
                vscode.commands.executeCommand("setContext", `cure-outline-is-sort-by-${v}`, false);
            } else {
                // 别忘了把自己给设置
                vscode.commands.executeCommand("setContext", `cure-outline-is-sort-by-${v}`, true);
            }
        });
    }

    private update_follow_cursor_context(v: boolean) {
        const t = v ? "follow-cursor" : "follow-cursor-off";
        this.update_switch_context(t);
    }

    private update_follow_viewport_context(v: boolean) {
        const t = v ? "follow-viewport" : "follow-viewport-off";
        this.update_switch_context(t);
    }

    //#endregion

    //#region 排序方式

    public async set_sort_type(type: OutlineSortType) {
        this.update_sort_context(type);
        await this.ctx.globalState.update("sortType", type);
    }

    /** 默认排序方式为 position */
    public get sort_type() {
        return (this.ctx.globalState.get("sortType") as OutlineSortType) || "position";
    }

    //#endregion

    //#region 过滤方式，可 ui 配置

    private readonly affect_filter_type = this.setting_domaim + ".filterType";

    /** 添加一个过滤条件，如果该条件已经存在，则什么都不做 */
    async add_filter(type: OutlineFilterType) {
        const filters = this.filter_type;
        if (!filters.includes(type)) {
            filters.push(type);
            this.update_switch_context(`filter-${type}`);
            await vscode.workspace
                .getConfiguration(this.setting_domaim)
                .update("filterType", filters, true);
        }
    }

    /** 移除一个过滤条件，如果该条件不存在，则什么都不做 */
    async remove_filter(type: OutlineFilterType) {
        const filters = this.filter_type;
        const index = filters.indexOf(type);
        if (index > -1) {
            filters.splice(index, 1);
            this.update_switch_context(`filter-${type}-off`);
            await vscode.workspace
                .getConfiguration(this.setting_domaim)
                .update("filterType", filters, true);
        }
    }

    public get filter_type() {
        return (
            vscode.workspace
                .getConfiguration(this.setting_domaim)
                .get<OutlineFilterType[]>("filterType") || []
        );
    }

    //#endregion

    //#region follow feature

    public async set_follow_cursor(follow: boolean) {
        this.update_follow_cursor_context(follow);
        await this.ctx.globalState.update("followCursor", follow);
    }

    public get follow_cursor() {
        return this.ctx.globalState.get("followCursor") as boolean;
    }

    public async set_follow_viewport(follow: boolean) {
        this.update_follow_viewport_context(follow);
        await this.ctx.globalState.update("followViewport", follow);
    }

    public get follow_viewport() {
        return this.ctx.globalState.get("followViewport") as boolean;
    }

    //#endregion
}
