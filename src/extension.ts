import * as vscode from "vscode";
import * as cmds from "./cmds";
import { ol_provider, ol_view, ol_init } from "./outline";

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(ol_view);
    cmds.register_all_cmds(context, ol_provider, ol_view);

    ol_init();
}

export function deactivate() {}
