// 版本信息 — 构建/发布时更新
// 数据包更新后递增 data，脚本逻辑变更后递增 script
// checkUrl 指向发布目录上的 version.json，检测更新时请求
export default {
    script: "0.6.0",
    data: "20260703.2",
    dataUrl: "https://pali-declension.mysticalpower.uk/dpd-web.db.gz",
    checkUrl: "https://pali-declension.mysticalpower.uk/version.json",
};
