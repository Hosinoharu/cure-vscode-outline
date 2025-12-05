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

/**
 * 节流函数（在节流窗口结束时执行）
 * @param func 要执行的函数
 * @param delay 节流时间间隔(毫秒)
 * @returns 包装后的节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastThis: any;

    return function (this: any, ...args: Parameters<T>): void {
        lastArgs = args;
        lastThis = this;

        if (!timeoutId) {
            timeoutId = setTimeout(() => {
                if (lastArgs) {
                    func.apply(lastThis, lastArgs);
                    lastArgs = null;
                    timeoutId = null;
                }
            }, delay);
        }
    };
}

/** 统一设置 tree item 的 context value，避免其它地方赋值出错！ */
export function set_context_value(item: vscode.TreeItem, type: TreeItemType) {
    item.contextValue = type;
}
