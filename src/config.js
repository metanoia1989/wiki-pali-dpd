/**
 * 站点白名单与共享配置。
 *
 * DPD_SITES — 需要加载词典数据的域名白名单。
 * 只有白名单内的站点才会触发词典数据下载和查询。
 * chat.deepseek.com 等 LLM 站点不在白名单中，不会加载词典数据。
 *
 * 注意：修改 DPD_SITES 后需同步更新 meta.js 中的 @match 规则。
 */

/** DPD 词典站点域名白名单 */
export const DPD_SITES = [
  "wikipali.cc",
  "wikipali.org",
  "127.0.0.1",
  "localhost",
];

/** 判断当前 hostname 是否在 DPD 白名单内 */
export function isDpdSite(hostname) {
  return DPD_SITES.some(function (site) {
    return hostname === site || hostname.endsWith("." + site);
  });
}

// ── 版本号 ──

/** 脚本版本（逻辑变更时递增） */
export const SCRIPT_VERSION = "0.6.0";

/** 数据包版本（词典数据更新时递增） */
export const DATA_VERSION = "20260703.2";

// ── 部署配置 ──

/** 词典数据下载 URL */
export const DATA_URL = "https://pali-declension.mysticalpower.uk/dpd-web.db.gz";

/** 版本检测 URL */
export const CHECK_URL = "https://pali-declension.mysticalpower.uk/version.json";
