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
 * 节流函数
 * @param func 要执行的函数
 * @param delay 节流时间间隔(毫秒)
 * @returns 包装后的节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let lastExecTime = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    return function (this: any, ...args: Parameters<T>): void {
        const currentTime = Date.now();
        const timeSinceLastExec = currentTime - lastExecTime;
        const remainingTime = delay - timeSinceLastExec;

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        if (timeSinceLastExec >= delay) {
            // 如果距离上次执行已经超过delay，立即执行
            func.apply(this, args);
            lastExecTime = currentTime;
        } else {
            // 否则设置定时器，在剩余时间后执行
            timeoutId = setTimeout(() => {
                func.apply(this, args);
                lastExecTime = Date.now();
                timeoutId = null;
            }, remainingTime);
        }
    };
}

/** 统一设置 tree item 的 context value，避免其它地方赋值出错！ */
export function set_context_value(item: vscode.TreeItem, type: TreeItemType) {
    item.contextValue = type;
}
