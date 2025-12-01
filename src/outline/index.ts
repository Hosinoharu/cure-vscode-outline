import * as vscode from "vscode";
import { CureSymbolManager } from "./ol_manager";
import { CureSymbolTreeProvider } from "./ol_view";
export { CureSymbolTreeViewCMD } from "./ol_cmd";

export const ol_manager = CureSymbolManager.Instance;
export const ol_provider = new CureSymbolTreeProvider(ol_manager);
export const ol_view = vscode.window.createTreeView(CureSymbolTreeProvider.id, {
    treeDataProvider: ol_provider,
});
