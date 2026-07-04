// 版本信息 — 构建/发布时更新
// 数据包更新后递增 data，脚本逻辑变更后递增 script
// 版本号和部署 URL 均从 config.js 共享
import { DATA_URL, CHECK_URL, SCRIPT_VERSION, DATA_VERSION } from "./config.js";

export default {
    script: SCRIPT_VERSION,
    data: DATA_VERSION,
    dataUrl: DATA_URL,
    checkUrl: CHECK_URL,
};
