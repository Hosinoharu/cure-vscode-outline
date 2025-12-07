import * as vscode from "vscode";
import { CureSymbolManager } from "./ol_manager";
import { CureSymbolTreeProvider, CureSymbolTreeItemHandler } from "./ol_view";
import { debounce } from "../common";
import { CureSymbolTreeViewCMD } from "./ol_cmd";
import { watch_doc_change_interval } from "../settings";
import * as olstorage from "./ol_storage";

export const ol_manager = CureSymbolManager.Instance;
export const ol_provider = new CureSymbolTreeProvider(ol_manager);
export const ol_view = vscode.window.createTreeView(CureSymbolTreeProvider.id, {
    treeDataProvider: ol_provider,
    // 自带的这个全部折叠不行，会干扰【只展开当前一项】的功能，所以手动实现全部展开与折叠
    // showCollapseAll: true,
});

async function update_symbol(doc: vscode.TextDocument, type: "switch" | "save" | "edit") {
    if (!ol_view.visible) {
        return;
    }
    // 以 vscode- 开头的 uri 是 vscode 自带的，不处理
    const uri = doc.uri.toString();
    if (uri.startsWith("vscode-")) {
        return;
    }
    console.log(`update_symbol_when_doc_${type}`);
    await ol_provider.reload_symbol(doc, type);
}
const debounced_update_symbol = debounce(update_symbol, watch_doc_change_interval);

/** 在启动插件时，获取当前打开的文档并初始化 outline。同时注册各种事件从而更新符号树
 * - 监听当前文件的修改
 * - 监听当前文档的切换，
 */
export async function ol_init(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(ol_view);
    CureSymbolTreeViewCMD.register(ctx, ol_provider, ol_view);

    const active_doc = vscode.window.activeTextEditor?.document;
    try {
        // 初次打开时，看作是切换文档
        active_doc && (await debounced_update_symbol(active_doc, "switch"));
    } catch {}

    // 监听文档切换
    vscode.window.onDidChangeActiveTextEditor(async (e) => {
        try {
            e && (await debounced_update_symbol(e.document, "switch"));
        } catch {}
    });

    // 监听文件保存
    vscode.workspace.onDidSaveTextDocument(async (e) => {
        try {
            await debounced_update_symbol(e, "save");
        } catch {}
    });

    // 监听文件修改
    vscode.workspace.onDidChangeTextDocument(async (e) => {
        try {
            await debounced_update_symbol(e.document, "edit");
        } catch {}
    });
}
