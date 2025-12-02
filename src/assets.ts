/**
 * @module assets
 * @description 统一管理静态文件的路径
 */

import fs from "fs";
import path from "path";

/** 标记编辑器的某一行存在书签 */
export const bookmark_gutter_icon = check_file(
    path.join(__dirname, "../icons/bookmark-gutter.svg")
);

/** 检查文件是否存在，不存在则抛出异常，否则返回该路径
 *
 * @param [absolute=false] 为 true 时返回绝对路径
 */
function check_file(file: string, absolute = false) {
    if (!fs.existsSync(file)) {
        throw new Error(`File ${file} not found`);
    }
    return absolute ? path.resolve(file) : file;
}
