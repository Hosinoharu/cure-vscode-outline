import * as vscode from "vscode";
import { CureBookmarkManager } from "./bm_manager";
import { CureBookmarkTreeProvider } from "./bm_view";
import { debounce } from "../common";
import { CureBookmarkTreeViewCMD } from "./bm_cmd";

export const bm_manager = CureBookmarkManager.Instance;
export const bm_provider = new CureBookmarkTreeProvider(bm_manager);
export const bm_view = vscode.window.createTreeView(CureBookmarkTreeProvider.id, {
    treeDataProvider: bm_provider,
});

async function update_bookmark(doc: vscode.TextDocument) {
    if (!bm_view.visible) {
        return;
    }
    console.log("update_bookmark_when_doc_change");
    const uri = doc.uri;
    const content = doc.getText();
    await bm_provider.reload_bookmark(uri, content);
}
const debounced_update_bookmark = debounce(update_bookmark, 200);

/** 在启动插件时，获取当前打开的文档并初始化 bookmark。同时注册各种事件从而更新符号树
 * - 监听当前文件的修改
 * - 监听当前文档的切换
 */
export async function bm_init(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(bm_view);
    CureBookmarkTreeViewCMD.register(ctx, bm_provider, bm_view);

    const active_doc = vscode.window.activeTextEditor?.document;
    try {
        active_doc && (await debounced_update_bookmark(active_doc));
    } catch {}

    // 监听文档切换
    vscode.window.onDidChangeActiveTextEditor(async (e) => {
        try {
            e && (await debounced_update_bookmark(e.document));
        } catch {}
    });

    // 监听文件保存
    vscode.workspace.onDidSaveTextDocument(async (e) => {
        try {
            await debounced_update_bookmark(e);
        } catch {}
    });
}
