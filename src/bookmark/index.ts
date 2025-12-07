import * as vscode from "vscode";
import { CureBookmarkManager } from "./bm_manager";
import { CureBookmarkTreeProvider } from "./bm_view";
import { debounce, is_target_doc } from "../common";
import { CureBookmarkTreeViewCMD } from "./bm_cmd";
import { watch_doc_change_interval } from "../settings";

export const bm_manager = CureBookmarkManager.Instance;
export const bm_provider = new CureBookmarkTreeProvider(bm_manager);
export const bm_view = vscode.window.createTreeView(CureBookmarkTreeProvider.id, {
    treeDataProvider: bm_provider,
});

async function update_bookmark(doc: vscode.TextDocument, type: "switch" | "save") {
    // console.log("update bookmark when doc:", type);
    const uri = doc.uri;
    const content = doc.getText();
    await bm_provider.reload_bookmark(uri, content);
}
const debounced_update_bookmark = debounce(update_bookmark, watch_doc_change_interval);

/** 在启动插件时，获取当前打开的文档并初始化 bookmark。同时注册各种事件从而更新符号树
 * - 监听当前文件的修改
 * - 监听当前文档的切换
 */
export async function bm_init(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(bm_view);
    CureBookmarkTreeViewCMD.register(ctx, bm_provider, bm_view);

    const active_doc = vscode.window.activeTextEditor?.document;
    try {
        active_doc &&
            should_handle(active_doc) &&
            (await debounced_update_bookmark(active_doc, "switch"));
    } catch {}

    // 监听文档切换
    vscode.window.onDidChangeActiveTextEditor(async (e) => {
        if (!e || !should_handle(e.document)) {
            return;
        }
        try {
            await debounced_update_bookmark(e.document, "switch");
        } catch {}
    });

    // 监听文件保存
    vscode.workspace.onDidSaveTextDocument(async (e) => {
        if (!should_handle(e)) {
            return;
        }
        try {
            await debounced_update_bookmark(e, "save");
        } catch {}
    });
}

/** 判断当前文档是否需要处理 */
function should_handle(doc: vscode.TextDocument) {
    return bm_view.visible && is_target_doc(doc);
}
