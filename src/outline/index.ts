import * as vscode from "vscode";
import { CureSymbolManager } from "./ol_manager";
import { CureSymbolTreeProvider, CureSymbolTreeItemHandler } from "./ol_view";
import { debounce, is_target_doc } from "../common";
import { CureSymbolTreeViewCMD } from "./ol_cmd";
import { watch_doc_change_interval } from "../settings";

/** 在启动插件时，获取当前打开的文档并初始化 outline。同时注册各种事件从而更新符号树
 * - 监听当前文件的修改
 * - 监听当前文档的切换，
 */
export async function ol_init(ctx: vscode.ExtensionContext) {
    //#region 初始化

    const ol_manager = CureSymbolManager.Instance;
    const ol_provider = new CureSymbolTreeProvider(ol_manager);
    const ol_view = vscode.window.createTreeView(CureSymbolTreeProvider.id, {
        treeDataProvider: ol_provider,
        // 自带的这个全部折叠不行，会干扰【只展开当前一项】的功能，所以手动实现全部展开与折叠
        // showCollapseAll: true,
    });

    CureSymbolTreeViewCMD.register(ctx, ol_provider, ol_view);
    ctx.subscriptions.push(ol_view);
    ctx.subscriptions.push(CureSymbolTreeViewCMD.Instance);
    ctx.subscriptions.push(CureSymbolTreeItemHandler.Instance);

    //#endregion

    //#region 更新函数

    async function update_symbol(doc: vscode.TextDocument, type: "switch" | "save" | "edit") {
        console.log("update symbol when doc:", type, ". url:", doc.uri.toString().slice(0, 10));
        await ol_provider.reload_symbol(doc);

        // ==============================================================
        // 符号加载完成之后，在这里恢复之前的状态
        const ol_item_handler = CureSymbolTreeItemHandler.Instance;
        ol_item_handler.enable_follow_cursor(true);
        ol_item_handler.enable_follow_viewport(true);
        // 上面只是打开了开关，但还要根据是否开启功能从而调用一次哟
        // 先触发 follow cursor，如果失败再触发 follow viewport
        CureSymbolTreeViewCMD.Instance.run_follow_feature();
    }

    const debounced_update_symbol = debounce(update_symbol, watch_doc_change_interval);

    //#endregion

    //#region 事件监听

    const active_doc = vscode.window.activeTextEditor?.document;
    try {
        // 初次打开时，看作是切换文档
        active_doc &&
            should_handle(active_doc) &&
            (await debounced_update_symbol(active_doc, "switch"));
    } catch {}

    // 监听文档切换
    ctx.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(async (e) => {
            if (!e || !should_handle(e.document)) {
                return;
            }
            try {
                // 切换文档时，会短暂触发 follow viewport 等，用于这里要临时取消其状态
                const ol_item_handler = CureSymbolTreeItemHandler.Instance;
                ol_item_handler.disable_follow_cursor();
                ol_item_handler.disable_follow_viewport();
                ol_item_handler.reset_state();
                e && (await debounced_update_symbol(e.document, "switch"));
            } catch {}
        })
    );

    // 监听文件保存
    ctx.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument(async (e) => {
            if (!should_handle(e)) {
                return;
            }
            try {
                await debounced_update_symbol(e, "save");
            } catch {}
        })
    );

    // 监听文件修改
    ctx.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(async (e) => {
            if (!should_handle(e.document)) {
                return;
            }
            try {
                // 实时编辑文档时，需要临时取消 follow cursor，不然不就是随时触发了嘛
                CureSymbolTreeItemHandler.Instance.disable_follow_cursor();
                await debounced_update_symbol(e.document, "edit");
            } catch {}
        })
    );

    //#endregion

    /** 判断当前文档是否需要处理 */
    function should_handle(doc: vscode.TextDocument) {
        return ol_view.visible && is_target_doc(doc);
    }
}
