/**
 * @module settings
 * @description 一些常量配置项
 */

//#region 符号解析重试

/** 最大重试次数 */
export const retry_max = 5;
/** 重试间隔 */
export const retry_interval = 200;

//#endregion

/** 监听文件语法符号的间隔 */
export const watch_doc_change_interval = 500;
/** follow cursor 时的 debounce 间隔，要比 `watch_doc_change_interval` 多一点才行
 * 文档更新完成之后才能正确进行鼠标高亮嘛
 */
export const follow_cursor_interval = 550;
/** follow viewport 时的 debounce 间隔 */
export const follow_viewport_interval = 200;
/** 点击符号跳转到位置时，会修改滚动条，为了避免触发 `follow viewport`，
 * 所以给定等待时间才可以继续 `follow viewport`
 */
export const wait_follow_cursor_done = 200;
