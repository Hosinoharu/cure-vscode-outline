/**
 * @module common
 * @description 提供一些通用的方法
 */

import * as vscode from "vscode";
import { TreeItemType } from "./types/symbol";

/**
 * 防抖函数异步版本
 * @param func 要执行的函数
 * @param wait 等待时间(毫秒)
 * @returns 包装后的防抖函数
 */
export function debounce<T extends (...args: any[]) => Promise<void>>(
    func: T,
    wait: number
): (...args: Parameters<T>) => Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return async function (...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            func.apply(null, args);
            timeoutId = null;
        }, wait);
    };
}

/**
 * 防抖函数
 * @param func 要执行的函数
 * @param wait 等待时间(毫秒)
 * @returns 包装后的防抖函数
 */
export function debounce_sync<T extends (...args: any[]) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (...args: Parameters<T>) {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            func.apply(null, args);
            timeoutId = null;
        }, wait);
    };
}

/** 统一设置 tree item 的 context value，避免其它地方赋值出错！ */
export function set_context_value(item: vscode.TreeItem, type: TreeItemType) {
    item.contextValue = type;
}

/** 判断当前文档是否需要处理，即生成 outline、bookmark */
export function is_target_doc(doc: vscode.TextDocument) {
    // 以 vscode- 开头的 uri 是 vscode 自带的，不处理
    const uri = doc.uri.toString();
    if (uri.startsWith("vscode-") || uri.startsWith("git:")) {
        return false;
    }

    return true;
}
