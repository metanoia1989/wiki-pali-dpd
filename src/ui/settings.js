/**
 * Settings panel.
 */
export class Settings {
    static show(history) {
        const html = `
            <div id="dpd-settings-overlay" style="
                position: fixed; inset: 0; background: rgba(0,0,0,0.4);
                display: flex; align-items: center; justify-content: center; z-index: 99999;
            ">
                <div style="
                    background: #fff; border-radius: 8px; padding: 24px;
                    max-width: 400px; width: 90%; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
                ">
                    <h2 style="margin: 0 0 16px; font-size: 18px;">Wiki Pali DPD Settings</h2>
                    <p>Version: ${self.__DPD_META__.version}</p>
                    <p>Cache: ${GM_getValue("dpd_db_version") ? "Loaded" : "Empty"}</p>
                    <div style="margin-top: 16px; display: flex; gap: 8px;">
                        <button id="dpd-clear-cache" style="
                            padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px;
                            background: #f44336; color: #fff; cursor: pointer;
                        ">Clear Cache</button>
                        <button id="dpd-settings-close" style="
                            padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px;
                            background: #eee; cursor: pointer;
                        ">Close</button>
                    </div>
                </div>
            </div>`;

        const container = document.createElement("div");
        container.innerHTML = html;
        document.body.appendChild(container);

        document.getElementById("dpd-settings-close").onclick = () => container.remove();
        document.getElementById("dpd-clear-cache").onclick = async () => {
            const { Cache } = await import("../storage/cache.js");
            const cache = new Cache();
            await cache.delete("dpd_web_db");
            GM_deleteValue("dpd_db_version");
            alert("Cache cleared. Reload to re-download.");
            container.remove();
        };
    }
}
