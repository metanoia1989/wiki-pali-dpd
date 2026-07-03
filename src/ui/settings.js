/**
 * Settings panel.
 */
export class Settings {
    static show() {
        var isDebug = !!GM_getValue("dpd_debug", false);
        var maxRows = parseInt(GM_getValue("dpd_max_rows", 5), 10) || 5;
        var autoShow = GM_getValue("dpd_auto_show", true);
        var ver = self.__DPD_VERSION__ || { script: "?", data: "?", dataUrl: "" };
        var curDataVer = GM_getValue("dpd_db_version", "");

        var html = '<div id="dpd-settings-overlay" style="'
            + 'position:fixed;inset:0;background:rgba(0,0,0,0.4);'
            + 'display:flex;align-items:center;justify-content:center;z-index:99999;'
            + '">'
            + '<div style="'
            + 'background:#fff;border-radius:8px;padding:24px;'
            + 'max-width:440px;width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.2);'
            + '">'

            /* 标题 */
            + '<h2 style="margin:0 0 12px;font-size:18px;color:#333;">Wiki Pali DPD</h2>'

            /* 版本信息 */
            + '<div style="font-size:13px;color:#555;line-height:1.6;">'
            + '<span>\u811A\u672C\u7248\u672C\uFF1A' + (ver.script || "?") + '</span><br>'
            + '<span>\u6570\u636E\u7248\u672C\uFF1A' + (curDataVer || "\u2014") + '</span><br>'
            + '<span>\u6700\u65B0\u6570\u636E\uFF1A' + (ver.data || "?") + '</span>'
            + '<div id="dpd-update-status" style="margin:4px 0;font-size:12px;"></div>'
            + '</div>'

            /* 自动显示 */
            + '<div style="margin:14px 0 10px;font-size:14px;color:#333;">'

            + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#333;">'
            + '<input type="checkbox" id="dpd-auto-show"'
            + (autoShow ? ' checked' : '')
            + ' style="width:16px;height:16px;">'
            + '<span>默认显示查询结果</span>'
            + '</label>'

            /* 分析表行数限制 */
            + '<div style="margin:12px 0;">'
            + '<label style="display:flex;align-items:center;gap:10px;">'
            + '<span style="white-space:nowrap;">分析表最多行数</span>'
            + '<input type="number" id="dpd-max-rows" value="' + maxRows + '"'
            + ' min="1" max="100" style="'
            + 'width:60px;padding:4px 8px;border:1px solid #ccc;border-radius:4px;font-size:14px;text-align:center;'
            + '">'
            + '</label>'
            + '<div style="font-size:12px;color:#888;margin:2px 0 0 92px;">超出部分折叠，点击展开</div>'
            + '</div>'

            /* 调试 */
            + '<label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:14px;color:#333;">'
            + '<input type="checkbox" id="dpd-debug"'
            + (isDebug ? ' checked' : '')
            + ' style="width:16px;height:16px;">'
            + '<span>调试模式</span>'
            + '</label>'

            + '</div>'

            /* 按钮 */
            + '<div style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;">'
            + '<button id="dpd-check-update" style="'
            + 'padding:6px 14px;border:1px solid #8b4513;border-radius:4px;'
            + 'background:#fff;color:#8b4513;cursor:pointer;font-size:13px;'
            + '">检查更新</button>'
            + '<button id="dpd-clear-cache" style="'
            + 'padding:6px 14px;border:1px solid #ccc;border-radius:4px;'
            + 'background:#f44336;color:#fff;cursor:pointer;font-size:13px;'
            + '">清除缓存</button>'
            + '<button id="dpd-settings-close" style="'
            + 'padding:6px 14px;border:1px solid #ccc;border-radius:4px;'
            + 'background:#eee;cursor:pointer;font-size:13px;color:#333;'
            + '">关闭</button>'
            + "</div></div>"
            + '<style>'
            + "#dpd-settings-overlay{"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "color:#333;font-size:14px;line-height:1.5;}"
            + "#dpd-settings-overlay *{"
            + "color:inherit;font-size:inherit;line-height:inherit;"
            + "font-family:inherit;}"
            + "#dpd-settings-overlay h2{font-size:18px;font-weight:700;}"
            + "#dpd-settings-overlay button:hover{opacity:.85;}"
            + "#dpd-settings-overlay button:active{transform:translateY(1px);}"
            + "#dpd-settings-overlay input[type=checkbox]{accent-color:#8b4513;}"
            + "#dpd-settings-overlay input[type=number]{accent-color:#8b4513;width:60px;}"
            + "</style></div>";

        var container = document.createElement("div");
        container.innerHTML = html;
        document.body.appendChild(container);

        // ── 自动显示 ──────────────────────────────
        document.getElementById("dpd-auto-show").onchange = function () {
            GM_setValue("dpd_auto_show", this.checked);
            if (self.__DPD && self.__DPD.injector) {
                self.__DPD.injector._recheck();
            }
        };

        // ── 分析表行数 ────────────────────────────
        document.getElementById("dpd-max-rows").onchange = function () {
            GM_setValue("dpd_max_rows", parseInt(this.value, 10) || 5);
            if (self.__DPD && self.__DPD.injector) {
                self.__DPD.injector._recheck();
            }
        };

        // ── 调试 ──────────────────────────────────
        document.getElementById("dpd-debug").onchange = function () {
            GM_setValue("dpd_debug", this.checked);
            if (self.__DPD && self.__DPD.injector) {
                self.__DPD.injector._recheck();
            }
        };

        // ── 检查更新（请求远程 version.json） ──────
        document.getElementById("dpd-check-update").onclick = async function () {
            var statusEl = document.getElementById("dpd-update-status");
            statusEl.textContent = "\u68C0\u67E5\u4E2D\u2026";
            statusEl.style.color = "#888";
            try {
                // 请求发布目录上的 version.json
                var resp = await fetch(ver.checkUrl, { cache: "no-cache" });
                if (!resp.ok) throw new Error("HTTP " + resp.status);
                var remote = await resp.json();

                var curDataVer = GM_getValue("dpd_db_version", "");
                var dataUpToDate = curDataVer && curDataVer === remote.data;
                var scriptUpToDate = ver.script === remote.script;

                var lines = [];

                if (!scriptUpToDate) {
                    lines.push("\u2191 \u65B0\u811A\u672C " + remote.script + " \u53EF\u7528\uFF08\u5F53\u524D " + ver.script + "\uFF09");
                } else {
                    lines.push("\u2713 \u811A\u672C\u5DF2\u662F\u6700\u65B0");
                }

                if (!dataUpToDate) {
                    lines.push("\u2191 \u65B0\u6570\u636E " + remote.data + " \u53EF\u7528\uFF08\u5F53\u524D " + (curDataVer || "\u672A\u52A0\u8F7D") + "\uFF09");
                } else {
                    lines.push("\u2713 \u6570\u636E\u5DF2\u662F\u6700\u65B0");
                }

                statusEl.innerHTML = lines.join("<br>");
                statusEl.style.color = dataUpToDate && scriptUpToDate ? "#2d5a27" : "#8b4513";

                // 数据可更新时显示更新按钮
                if (!dataUpToDate && remote.dataUrl) {
                    var link = document.createElement("a");
                    link.href = "#";
                    link.textContent = "\u7ACB\u5373\u66F4\u65B0\u6570\u636E";
                    link.style.color = "#8b4513";
                    link.style.display = "inline-block";
                    link.style.marginTop = "6px";
                    link.onclick = async function (e) {
                        e.preventDefault();
                        statusEl.textContent = "\u4E0B\u8F7D\u4E2D\u2026";
                        statusEl.style.color = "#888";
                        var mod = await import("../storage/cache.js");
                        var cache = new mod.Cache();
                        var LoaderMod = await import("../db/loader.js");
                        var loader = new LoaderMod.Loader(remote.dataUrl);
                        try {
                            var buffer = await loader.load(function (pct) {
                                statusEl.textContent = "\u4E0B\u8F7D\u4E2D " + pct + "%";
                            });
                            await cache.delete("dpd_web_db");
                            await cache.set("dpd_web_db", buffer);
                            GM_setValue("dpd_db_version", remote.data);
                            self.__DPD.cache = self.__DPD.cache || cache;
                            statusEl.innerHTML = "\u2713 \u6570\u636E\u66F4\u65B0\u5B8C\u6210\uFF0C\u8BF7\u5237\u65B0\u9875\u9762";
                            statusEl.style.color = "#2d5a27";
                        } catch (err) {
                            statusEl.textContent = "\u66F4\u65B0\u5931\u8D25: " + err.message;
                            statusEl.style.color = "#c00";
                        }
                    };
                    statusEl.appendChild(document.createElement("br"));
                    statusEl.appendChild(link);
                }

            } catch (err) {
                statusEl.innerHTML = "\u68C0\u67E5\u5931\u8D25\uFF1A" + err.message;
                statusEl.style.color = "#c00";
            }
        };

        // ── 清除缓存 ──────────────────────────────
        document.getElementById("dpd-clear-cache").onclick = async function () {
            var mod = await import("../storage/cache.js");
            var cache = new mod.Cache();
            await cache.delete("dpd_web_db");
            GM_deleteValue("dpd_db_version");
            alert("缓存已清除，刷新页面后重新下载。");
            container.remove();
        };

        document.getElementById("dpd-settings-close").onclick = function () { container.remove(); };
    }
}
