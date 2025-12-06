/**
 * @module olstorage
 * @description 读写关于 outline 的配置项、以及上下文的操作 —— 修改配置项时，会自动更新上下文。
 * - 搜索、过滤的设置都在 TreeViewProvider 中进行而不是在 ol_cmd 中，这可以减少代码
 * - 一些专门的功能开启，如 follo cursor 则在 ol_cmd 中监听命令来处理
 */

import * as vscode from "vscode";
import { OutlineFilterType, OutlineSortType, SwitchCmdType } from "../types/symbol";

const setting_domaim = "cure-outline";

//#region 排序方式

/** 设置排序方式 */
export function set_sort_type(type: OutlineSortType) {
    update_sort_context(type);
    vscode.workspace.getConfiguration(setting_domaim).update("sortType", type, true);
}
/** 获取排序方式 */
export function get_sort_type(): OutlineSortType {
    return vscode.workspace.getConfiguration(setting_domaim).get("sortType") || "position";
}

//#endregion

//#region 是否开启 follow

export function toggle_follow_cursor(v: boolean) {
    const t = v ? "follow-cursor" : "follow-cursor-off";
    update_switch_context(t);
    vscode.workspace.getConfiguration(setting_domaim).update("followCursor", v, true);
}
export function get_follow_cursor() {
    return vscode.workspace.getConfiguration(setting_domaim).get("followCursor") || false;
}

export function toggle_follow_viewport(v: boolean) {
    const t = v ? "follow-viewport" : "follow-viewport-off";
    update_switch_context(t);
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
        update_switch_context(`filter-${type}`);
        vscode.workspace.getConfiguration(setting_domaim).update("filterType", filters, true);
    }
}
export function remove_filter(type: OutlineFilterType) {
    const filters = get_filters();
    const index = filters.indexOf(type);
    if (index > -1) {
        filters.splice(index, 1);
        update_switch_context(`filter-${type}-off`);
        vscode.workspace.getConfiguration(setting_domaim).update("filterType", filters, true);
    }
}
export function get_filters() {
    return (
        vscode.workspace.getConfiguration(setting_domaim).get<OutlineFilterType[]>("filterType") ||
        []
    );
}

//#endregion

//#region 开关式命令的上下文管理

// 开关式命令：具备【开启、关闭】两种状态的命令，比如【全部折叠、全部展开】就是【一对开关命令】
// 开关式上下文是为了在菜单中可以显示【已启用、未启用】两种状态
// 上下文的命名格式如下：加入 `expand-all` 是开关命令，那么 `expand-off` 就是关闭命令
// 那么上下文 `cure-outline-is-expand-all` 就是开关式上下文
// 注意：在执行开关类命令的时候，需要【更新上下文】哟

export function init_all_context() {
    // 默认情况下不展开
    update_switch_context("expand-all-off");
    update_switch_context("expand-only-one-off");
    update_sort_context(get_sort_type());
    get_filters().forEach((v) => {
        update_switch_context(`filter-${v}`);
    });
}

/** 更新开关式命令的上下文，此类上下文命名格式：`cure-outline-is-xxx`
 * - 比如传入 `expand-all`，这说明上下文 `ure-outline-is-expand-all` 为 `true`
 * - 比如传入 `expand-all-off`，这说明上下文 `ure-outline-is-expand-all` 为 `false`
 */
export function update_switch_context(type: SwitchCmdType) {
    const index = type.indexOf("-off");
    const is_on = index < 0;
    const name = is_on ? type : type.slice(0, index);

    vscode.commands.executeCommand("setContext", `cure-outline-is-${name}`, is_on);
}

/** 更新排序的上下文。 只有在切换排序方式的时候，才需要更新上下文！
 *
 * 将另外两个排序的上下文设置为 `false` 就可以不显示那两个了
 */
function update_sort_context(type: OutlineSortType) {
    // 修改其它排序方式的上下文
    const sorts: OutlineSortType[] = ["position", "name", "kind"];
    sorts.forEach((v) => {
        if (v !== type) {
            vscode.commands.executeCommand("setContext", `cure-outline-is-sort-by-${v}`, false);
        } else {
            // 别忘了把自己给设置
            vscode.commands.executeCommand("setContext", `cure-outline-is-sort-by-${v}`, true);
        }
    });
}

//#endregion
