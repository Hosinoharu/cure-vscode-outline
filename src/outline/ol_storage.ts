/**
 * @module olstorage
 * @description 读写关于 outline 的配置项
 */

import * as vscode from "vscode";
import { OutlineFilterType, OutlineSortType } from "../types/symbol";

const setting_domaim = "cure-outline";

//#region 排序方式

/** 设置排序方式 */
export function set_sort_type(type: OutlineSortType) {
    vscode.workspace.getConfiguration(setting_domaim).update("sortType", type, true);
}
/** 获取排序方式 */
export function get_sort_type(): OutlineSortType {
    return vscode.workspace.getConfiguration(setting_domaim).get("sortType") || "position";
}

//#endregion

//#region 是否开启 follow

export function toggle_follow_cursor(v: boolean) {
    vscode.workspace.getConfiguration(setting_domaim).update("followCursor", v, true);
}
export function get_follow_cursor() {
    return vscode.workspace.getConfiguration(setting_domaim).get("followCursor") || false;
}

export function toggle_follow_viewport(v: boolean) {
    vscode.workspace.getConfiguration(setting_domaim).update("followViewport", v, true);
}
export function get_follow_viewport() {
    return vscode.workspace.getConfiguration(setting_domaim).get("followViewport") || false;
}

//#endregion

//#region 过滤方式

export function add_filter(type: OutlineFilterType) {
    const filters = get_filters();
    if (!filters.includes(type)) {
        filters.push(type);
        vscode.workspace.getConfiguration(setting_domaim).update("filter", filters, true);
    }
}
export function remove_filter(type: OutlineFilterType) {
    const filters = get_filters();
    const index = filters.indexOf(type);
    if (index > -1) {
        filters.splice(index, 1);
        vscode.workspace.getConfiguration(setting_domaim).update("filter", filters, true);
    }
}
export function get_filters() {
    return (
        (vscode.workspace.getConfiguration(setting_domaim).get("filter") as OutlineFilterType[]) ||
        []
    );
}

//#endregion
