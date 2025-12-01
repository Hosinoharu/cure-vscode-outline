/**
 * 生成最终整个插件 `package.json` 中的 `contributes` 内容
 */

import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import contributes from "./contributes.mjs";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const package_file = path.resolve(dirname, "../package.json");
const backup = path.resolve(dirname, "./package-copy.json");

function save_copy(content) {
    const json = JSON.parse(content);
    json["contributes"] = {};
    const output = JSON.stringify(json, null, 2);
    fs.writeFileSync(backup, output, "utf-8");
}

const content = fs.readFileSync(package_file, "utf-8");
save_copy(content);

const json_content = JSON.parse(content);
json_content["contributes"] = contributes;

const output = JSON.stringify(json_content, null, 2);
fs.writeFileSync(package_file, output, "utf-8");
