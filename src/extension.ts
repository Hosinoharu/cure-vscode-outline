import * as vscode from "vscode";
import { CureStorage } from "./storage";
import { CureSymbolCMD } from "./symbol";
import { ol_init } from "./outline";
import { bm_init } from "./bookmark";

export function activate(context: vscode.ExtensionContext) {
    CureStorage.register(context);
    CureSymbolCMD.register(context);
    ol_init(context);
    bm_init(context);
}

export function deactivate() {}
