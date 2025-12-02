import * as vscode from "vscode";
import { CureSymbolCMD } from "./symbol";
import { ol_init } from "./outline";
import { bm_init } from "./bookmark";

export function activate(context: vscode.ExtensionContext) {
    CureSymbolCMD.register(context);
    ol_init(context);
    bm_init(context);
}

export function deactivate() {}
