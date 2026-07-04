/**
 * 油猴脚本元数据块。
 *
 * 构建时被 vite-userscript.js import() 获取字符串，prepend 到构建产物头部。
 * @match 规则需与 config.js 中的 DPD_SITES 白名单同步。
 */
import { SCRIPT_VERSION } from "./config.js";

// @match 规则说明：
//   新增/修改站点时，需同步更新 src/config.js 中的 DPD_SITES 白名单。
//   wikipali.cc / wikipali.org / localhost — DPD 词典站点（需加载词典数据）
//   chat.deepseek.com                 — 仅 LLM Agent，不加载词典数据
export default `// ==UserScript==
// @name         Wiki Pali DPD
// @namespace    https://github.com/metanoia1989/wiki-pali-dpd
// @version      ${SCRIPT_VERSION}
// @description  DPD 词典数据：变格表、复合词拆解、释义注入
// @author       Adam Smith
// @match        https://*.wikipali.cc/pcd/*
// @match        https://*.wikipali.org/pcd/*
// @match        https://chat.deepseek.com/*
// @match        http://127.0.0.1:8080/*
// @match        http://localhost:8080/*
// @icon         https://pali-declension.mysticalpower.uk/favicon.svg
// @@downloadURL https://pali-declension.mysticalpower.uk/wiki-pali-dpd.user.js
// @homepageURL  https://pali-declension.mysticalpower.uk/
// @require      https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/sql-wasm.js
// @require      https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @grant        GM_removeValueChangeListener
// @grant        GM_openInTab
// @license      MIT
// ==/UserScript==`;
