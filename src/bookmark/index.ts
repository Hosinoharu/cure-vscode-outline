import * as vscode from "vscode";
import { CureBookmarkManager, CureRegionFoldingProvider } from "./bm_manager";
import { CureBookmarkTreeProvider } from "./bm_view";
import { CureBookmarkTreeViewCMD } from "./bm_cmd";

const region_folding_provider = new CureRegionFoldingProvider();
export const bm_manager = CureBookmarkManager.Instance;
const bm_provider = new CureBookmarkTreeProvider(bm_manager);
const bm_view = vscode.window.createTreeView(CureBookmarkTreeProvider.id, {
    treeDataProvider: bm_provider,
});

/** 在解析语法符号的时候，会同时解析自定义符号，
 *
 * 所以这里不需要再监听各种文档事件了，只需要注册命令就好。
 */
export async function bm_init(ctx: vscode.ExtensionContext) {
    ctx.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider({ language: "*" }, region_folding_provider)
    );
    ctx.subscriptions.push(bm_view);
    CureBookmarkTreeViewCMD.register(ctx, bm_provider, bm_view);
}

/** 重新加载书签 */
export async function bm_reload_for_ol() {
    if (bm_view.visible) {
        bm_provider.reload_custom_bookmark();
    }
}
