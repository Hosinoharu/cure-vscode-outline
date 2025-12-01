/**
 * @module cmds
 * @description 这里整合所有的命令，统一实现命令的注册
 */

import * as vscode from "vscode";
import { CureSymbolCMD } from "./symbol";
import { CureSymbolTreeViewCMD } from "./outline";
import type { CureSymbolTreeProvider, CureSymbolTreeItem } from "./outline/ol_view";

export function register_all_cmds(
    ctx: vscode.ExtensionContext,
    ol_provider: CureSymbolTreeProvider,
    ol_view: vscode.TreeView<CureSymbolTreeItem>
) {
    CureSymbolCMD.register(ctx);
    CureSymbolTreeViewCMD.register(ctx, ol_provider, ol_view);
}
