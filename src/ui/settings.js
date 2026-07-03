/**
 * Settings panel.
 */
export class Settings {
    static show() {
        var isDebug = !!GM_getValue("dpd_debug", false);
        var html = '<div id="dpd-settings-overlay" style="'
            + 'position:fixed;inset:0;background:rgba(0,0,0,0.4);'
            + 'display:flex;align-items:center;justify-content:center;z-index:99999;'
            + '">'
            + '<div style="'
            + 'background:#fff;border-radius:8px;padding:24px;'
            + 'max-width:400px;width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.2);'
            + '">'
            + '<h2 style="margin:0 0 16px;font-size:18px;color:#333;">Wiki Pali DPD</h2>'
            + '<p style="margin:4px 0;font-size:14px;color:#555;">Version: ' + self.__DPD_META__.version + '</p>'
            + '<p style="margin:4px 0;font-size:14px;color:#555;">Cache: ' + (GM_getValue("dpd_db_version") ? "Loaded" : "Empty") + '</p>'
            + '<label style="display:flex;align-items:center;gap:8px;margin:12px 0;cursor:pointer;font-size:14px;color:#333;">'
            + '<input type="checkbox" id="dpd-debug"'
            + (isDebug ? ' checked' : '')
            + ' style="width:16px;height:16px;">'
            + '<span>调试模式（输出日志到控制台）</span>'
            + '</label>'
            + '<div style="margin-top:16px;display:flex;gap:8px;">'
            + '<button id="dpd-clear-cache" style="'
            + 'padding:6px 14px;border:1px solid #ccc;border-radius:4px;'
            + 'background:#f44336;color:#fff;cursor:pointer;font-size:14px;'
            + '">Clear Cache</button>'
            + '<button id="dpd-settings-close" style="'
            + 'padding:6px 14px;border:1px solid #ccc;border-radius:4px;'
            + 'background:#eee;cursor:pointer;font-size:14px;color:#333;'
            + '">Close</button>'
            + "</div></div>"
            + '<style>'
            + "#dpd-settings-overlay{"
            + "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;"
            + "color:#333;font-size:14px;line-height:1.5;}"
            + "#dpd-settings-overlay *{"
            + "color:inherit;font-size:inherit;line-height:inherit;"
            + "font-family:inherit;}"
            + "#dpd-settings-overlay h2{font-size:18px;font-weight:700;}"
            + "#dpd-settings-overlay button{"
            + "font-family:inherit;text-transform:none;letter-spacing:normal;"
            + "box-shadow:none;text-shadow:none;}"
            + "#dpd-settings-overlay input[type=checkbox]{accent-color:#8b4513;}"
            + "</style></div>";

        var container = document.createElement("div");
        container.innerHTML = html;
        document.body.appendChild(container);

        document.getElementById("dpd-debug").onchange = function () {
            GM_setValue("dpd_debug", this.checked);
            if (self.__DPD && self.__DPD.injector) {
                // 重新查询当前词以显示调试信息
                self.__DPD.injector._recheck();
            }
        };

        document.getElementById("dpd-settings-close").onclick = function () { container.remove(); };
        document.getElementById("dpd-clear-cache").onclick = async function () {
            var mod = await import("../storage/cache.js");
            var cache = new mod.Cache();
            await cache.delete("dpd_web_db");
            GM_deleteValue("dpd_db_version");
            alert("Cache cleared. Reload to re-download.");
            container.remove();
        };
    }
}
