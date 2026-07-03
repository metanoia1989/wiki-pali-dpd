/**
 * Entry point: init banner → download → db ready → watch WikiPali searches.
 *
 * 多域名支持：
 *   wikipali.cc / wikipali.org — DPD 词典 + LLM 选中菜单
 *   chat.deepseek.com         — DeepSeek Agent（自动填充/回复捕获）
 */
import VERSION from "./version.js";

self.__DPD_META__ = { name: "Wiki Pali DPD", version: VERSION.script };
self.__DPD_VERSION__ = VERSION;

// ── 域名路由 ──────────────────────────────────────────
var host = location.hostname;
var isDeepSeek = host.indexOf("chat.deepseek.com") >= 0
    || host.indexOf("deepseek.com") >= 0;

if (isDeepSeek) {
    // DeepSeek Agent：监听 GM storage 请求，自动填充并回复
    self.__DPD_MAIN__ = (async function () {
        try {
            var mod = await import("./llm/deepseek-agent.js");
            var agent = new mod.DeepSeekAgent();
            agent.start();
            self.__DPD = { agent: agent };
            console.log("[DPD] DeepSeek Agent 已启动");
        } catch (e) {
            console.error("[DPD] 启动 DeepSeek Agent 失败:", e);
        }
    })();
} else {
    // WikiPali 主逻辑
    self.__DPD_MAIN__ = _initWikiPali();
}

// ── WikiPali 初始化 ───────────────────────────────────
async function _initWikiPali() {
    const { Cache } = await import("./storage/cache.js");
    const { Loader } = await import("./db/loader.js");
    const { Query } = await import("./db/query.js");
    const { Injector } = await import("./ui/injector.js");
    const { Panel } = await import("./ui/panel.js");
    const { Settings } = await import("./ui/settings.js");
    const { History } = await import("./storage/history.js");

    const DB_CACHE_KEY = "dpd_web_db";
    const DB_VER_KEY = "dpd_db_version";
    const DB_SCHEMA_VERSION = VERSION.data;
    const DATA_URL = VERSION.dataUrl;
    const cache = new Cache();
    const history = new History();

    // ── init banner & download ──────────────────────────────────
    async function ensureDb() {
        // 版本不匹配 → 清除旧缓存强制重下
        const cachedVer = GM_getValue(DB_VER_KEY, "");
        if (cachedVer !== DB_SCHEMA_VERSION) {
            console.log("[DPD] schema version mismatch", cachedVer, "→", DB_SCHEMA_VERSION);
            await cache.delete(DB_CACHE_KEY);
            GM_setValue(DB_VER_KEY, DB_SCHEMA_VERSION);
        }

        let dbBuffer = await cache.get(DB_CACHE_KEY);
        if (dbBuffer) return dbBuffer;

        // 无缓存 → 显示初始化提示
        const banner = _initBanner();
        document.body.appendChild(banner);

        const result = await new Promise((resolve) => {
            banner.querySelector(".dpd-init-yes").onclick = async () => {
                banner.querySelector(".dpd-init-msg").textContent =
                    "下载词典数据 0%";
                banner.querySelector(".dpd-init-btns").remove();

                // 显示进度条
                const barWrap = document.createElement("div");
                barWrap.className = "dpd-progress-wrap";
                barWrap.innerHTML = `<div class="dpd-progress-bar"><div class="dpd-progress-fill"></div></div>`;
                banner.querySelector(".dpd-init-body").appendChild(barWrap);
                const fill = barWrap.querySelector(".dpd-progress-fill");

                // 如果没有配置 URL，尝试本地复制（开发环境）
                let buffer;
                if (!DATA_URL) {
                    banner.querySelector(".dpd-init-msg").textContent =
                        "词典数据 URL 未配置，请在 GM_setValue 中设置 dpd_data_url";
                    return;
                }

                try {
                    const loader = new Loader(DATA_URL);
                    buffer = await loader.load((pct) => {
                        fill.style.width = pct + "%";
                        banner.querySelector(".dpd-init-msg").textContent =
                            `下载词典数据 ${pct}%`;
                    });
                } catch (err) {
                    banner.querySelector(".dpd-init-msg").textContent =
                        "下载失败: " + err.message;
                    return;
                }

                // 写入 IndexedDB 缓存
                banner.querySelector(".dpd-init-msg").textContent =
                    "正在写入缓存…";
                fill.style.width = "100%";
                await cache.set(DB_CACHE_KEY, buffer);

                // 初始化 SQL 引擎
                banner.querySelector(".dpd-init-msg").textContent =
                    "正在初始化引擎…";
                await new Promise((r) => setTimeout(r, 100));

                banner.remove();
                resolve(buffer);
            };

            banner.querySelector(".dpd-init-no").onclick = () => {
                banner.remove();
                resolve(null);
            };
        });

        return result;
    }

    // ── main ────────────────────────────────────────────────────
    const dbBuffer = await ensureDb();
    if (!dbBuffer) {
        console.log("[DPD] 用户跳过初始化");
        return;
    }

    const SQL = await initSqlJs({
        locateFile: () =>
            "https://cdn.jsdelivr.net/npm/sql.js@1.11.0/dist/sql-wasm.wasm",
    });
    const query = new Query(dbBuffer, SQL);
    await query.ready;

    // 注册菜单
    GM_registerMenuCommand("⚙️ 设置", () => Settings.show());
    GM_registerMenuCommand("📜 查询历史", () => history.show());

    // 启动 LLM 模块（选中文本浮动菜单 + DeepSeek 通信）
    // 默认关闭，通过菜单命令或设置面板开启
    var llm = null;
    var LlmMod;
    try {
        LlmMod = (await import("./llm/llm-main.js")).LlmMain;
        GM_registerMenuCommand(
            "🤖 LLM 选中浮窗" + (LlmMod.isEnabled() ? " ✅" : ""),
            function () {
                var on = LlmMod.toggle();
                if (on) {
                    llm = new LlmMod();
                    llm.start();
                    self.__DPD.llm = llm;
                    _toast("LLM 选中浮窗 \u2705 已开启");
                } else if (llm) {
                    llm.stop();
                    llm = null;
                    self.__DPD.llm = null;
                    _toast("LLM 选中浮窗 \u274C 已关闭");
                }
            }
        );
        llm = new LlmMod();
        llm.start();
    } catch (e) {
        console.warn("[DPD] LLM 模块未加载（可忽略）:", e);
    }

    // 启动监听
    const injector = new Injector(query, Panel, history);
    injector.start();

    self.__DPD = { query, cache, history, injector, llm };

    // 通知页面脚本：DPD 引擎就绪
    document.dispatchEvent(new CustomEvent("dpd-ready", {
        detail: { version: self.__DPD_META__.version },
    }));
}

function _initBanner() {
    const div = document.createElement("div");
    div.id = "dpd-init-banner";
    div.innerHTML = `
        <div class="dpd-init-overlay">
            <div class="dpd-init-card">
                <div class="dpd-init-body">
                    <div class="dpd-init-msg">加载 DPD 巴利语词典数据？</div>
                    <div style="font-size:13px;color:#666;margin:4px 0 12px">
                        首次使用需下载 ~16MB 词典数据，之后离线可用
                    </div>
                    <div class="dpd-init-btns">
                        <button class="dpd-init-yes">下载</button>
                        <button class="dpd-init-no">取消</button>
                    </div>
                </div>
            </div>
        </div>
        <style>
            .dpd-init-overlay {
                position:fixed;inset:0;background:rgba(0,0,0,0.35);
                display:flex;align-items:center;justify-content:center;z-index:999999;
            }
            .dpd-init-card {
                background:#fff;border-radius:10px;padding:24px 28px;
                max-width:380px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.2);
                font-family:-apple-system,BlinkMacSystemFont,sans-serif;
            }
            .dpd-init-body { text-align:center; }
            .dpd-init-msg { font-size:16px;font-weight:600;color:#333; }
            .dpd-init-btns { display:flex;gap:10px;justify-content:center; }
            .dpd-init-btns button {
                padding:7px 22px;border:none;border-radius:6px;
                cursor:pointer;font-size:14px;font-weight:500;
            }
            .dpd-init-yes { background:#8b4513;color:#fff; }
            .dpd-init-yes:hover { background:#a0522d; }
            .dpd-init-no { background:#eee;color:#555; }
            .dpd-init-no:hover { background:#ddd; }
            .dpd-progress-wrap { margin-top:12px; }
            .dpd-progress-bar {
                height:6px;background:#eee;border-radius:3px;overflow:hidden;
            }
            .dpd-progress-fill {
                height:100%;width:0%;background:#8b4513;
                transition:width .3s ease;
            }
        </style>`;
    return div;
}

/** 短暂提示（2s 自动消失） */
function _toast(msg) {
    var el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
        position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
        background: "#333", color: "#fff", padding: "10px 20px", borderRadius: "8px",
        fontSize: "14px", zIndex: "999999", fontFamily: "-apple-system,sans-serif",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        opacity: "0", transition: "opacity .25s ease",
    });
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = "1"; });
    setTimeout(function () {
        el.style.opacity = "0";
        setTimeout(function () { el.remove(); }, 300);
    }, 2000);
}
