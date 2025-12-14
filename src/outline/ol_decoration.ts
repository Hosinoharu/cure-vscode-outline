/**
 * @module oldecoration
 * @description 利用 `FileDecoration` 实现 TreeItem 字体颜色
 *
 * 额，经过实践，TreeItem 的 description 内容也变颜色了，哎，就这样吧，看着还行。
 *
 * 基于该思路也可以实现 vscode 内置 outline 的一个功能：在 outline 中显示出现错误的那个符号。
 * 经过思考（绝不是偷懒），这个功能还是算了，想要知道当前文件有没有报错直接看**编辑器中的文件名颜色**就可以，
 * 至于快速定位到错误点，使用 outline 还得层层展开，不如看 minimap 或者打开底部控制台直接跳转。
 */

import * as vscode from "vscode";
import { CureSymbolKind } from "../types/symbol";
import { CureOneSymbol } from "../symbol";

/** 根据符号种类生成一个 Uri */
export function create_item_resource_uri(kind: CureSymbolKind) {
    return vscode.Uri.parse(`cure-outline:///item/${kind}`);
}

/** 给 TreeItem 提供 Decoration */
export class CureTreeItemDecorationProvider implements vscode.FileDecorationProvider {
    private readonly _onDidChangeFileDecorations = new vscode.EventEmitter<
        undefined | vscode.Uri | vscode.Uri[]
    >();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    /** 调用它将更新指定 uri 的 decoration，不传入则更新全部！ */
    refresh(uri?: vscode.Uri) {
        this._onDidChangeFileDecorations.fire(uri);
    }

    async provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken) {
        const kind = this.get_kind(uri);
        if (!kind) {
            return;
        }

        return {
            color: CureOneSymbol.get_color_from_kind(kind),
        };
    }

    get_kind(uri: vscode.Uri): CureSymbolKind | undefined {
        const uri_str = uri.toString();
        if (!uri_str.startsWith("cure-outline")) {
            return;
        }
        const kind = uri_str.split("/");
        if (!kind) {
            return;
        }
        return kind[kind.length - 1] as CureSymbolKind;
    }
}
