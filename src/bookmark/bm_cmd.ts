/**
 * @module bmcmd
 * @description 实现 `bookmark tree view` 的命令
 */

import * as vscode from "vscode";
import { CureBookmarkTreeItem, CureBookmarkTreeProvider } from "./bm_view";
import type { CureSymbolTreeItem } from "../outline/ol_view";

/** 关于 BookmarkTreeView 视图的命令的实现与注册，需要传入控制的 bookmark tree view 哟 */
export class CureBookmarkTreeViewCMD {
    private static instance?: CureBookmarkTreeViewCMD;

    private constructor(
        private readonly provider: CureBookmarkTreeProvider,
        private readonly view: vscode.TreeView<CureBookmarkTreeItem>
    ) {
        if (CureBookmarkTreeViewCMD.instance) {
            throw new Error("CureBookmarkTreeViewCMD is already initialized!");
        }
        CureBookmarkTreeViewCMD.instance = this;
    }

    /** 获取单例 */
    public static get Instance() {
        if (!CureBookmarkTreeViewCMD.instance) {
            throw new Error("CureBookmarkTreeViewCMD is not initialized!");
        }
        return CureBookmarkTreeViewCMD.instance;
    }

    /** 注册所有此类的命令 */
    public static register(
        ctx: vscode.ExtensionContext,
        provider: CureBookmarkTreeProvider,
        view: vscode.TreeView<CureBookmarkTreeItem>
    ) {
        const self = new CureBookmarkTreeViewCMD(provider, view);
        const commands = [
            self.register_add_symbol_to_bookmark(),
            self.register_del_bookmark(),
            self.register_rename_bookmark(),
        ];
        ctx.subscriptions.push(...commands);
        return self;
    }

    // #region 注册：将某个符号添加到bookmark

    private readonly cmd_add_symbol_to_bookmark = "cure-outline.add-symbol-to-bookmark";

    private register_add_symbol_to_bookmark() {
        return vscode.commands.registerCommand(
            this.cmd_add_symbol_to_bookmark,
            (item: CureSymbolTreeItem) => this.provider.add_symbol_item(item.symbol)
        );
    }

    // #endregion 将某个符号添加到bookmark

    // #region 注册：从视图中删除一个bookmark

    private readonly cmd_del_bookmark = "cure-outline.del-bookmark";

    private register_del_bookmark() {
        return vscode.commands.registerCommand(
            this.cmd_del_bookmark,
            (item: CureBookmarkTreeItem) => {
                this.provider.del_item(item);
            }
        );
    }

    // #endregion 从视图中删除一个bookmark

    // #region 注册：重命名bookmark信息

    private readonly cmd_rename_bookmark = "cure-outline.rename-bookmark";

    private register_rename_bookmark() {
        return vscode.commands.registerCommand(
            this.cmd_rename_bookmark,
            async (item: CureBookmarkTreeItem) => {
                const new_name = await vscode.window.showInputBox({
                    placeHolder: "Enter new name for bookmark",
                });
                if (new_name) {
                    // 给其前面加一个标记，说明被修改过了
                    item.label = "✨ " + new_name;
                    this.provider.refresh(item);
                }
            }
        );
    }

    // #endregion 重命名bookmark信息
}
