# 快速开始

5 分钟上手 Wiki Pali DPD。

## 总体步骤

1. **安装脚本管理器**（推荐 Violentmonkey，Tampermonkey 也兼容）
2. **安装 Wiki Pali DPD 脚本**
3. **打开 WikiPali 搜索单词**
4. **下载词典数据**
5. **开始使用**

> 如果还没有安装脚本管理器，请先查看对应浏览器的安装指南：
>
> [Chrome 安装](install/chrome.html) · [Chrome（开发者模式）](install/chrome-unpacked.html) · [Firefox 安装](install/firefox.html) · [Edge 安装](install/edge.html)

## 安装脚本

安装好扩展后：

1. 打开 [Wiki Pali DPD 安装页面](https://pali-declension.mysticalpower.uk/)
2. 点击页面中央的 **「安装脚本」** 按钮
3. 扩展会自动弹出安装页面，点击 **「安装」** 即可

![安装脚本](../img/chrome-script-install.svg)

## 首次使用

安装完成后：

1. 打开 [WikiPali](https://wikipali.cc) 词典页面
2. 在搜索框中输入任意巴利语单词（如 `buddha`）
3. 页面会弹出提示框询问是否下载词典数据

![下载数据提示](../img/chrome-download-data.svg)

4. 点击 **「下载」**，等待进度条走完（约需几秒到十几秒，取决于网速）
5. 下载完成后，词典数据即缓存到浏览器中，后续完全离线使用

## 验证安装

词典数据加载完成后，搜索 `buddha`，搜索结果上方会出现一个棕色的 DPD 信息栏，显示单词的词性、释义和更多信息。

![查询结果展示](../img/dpd-demo-result.svg)

## 常见问题

**问：词典数据下载失败怎么办？**
检查网络连接后重试。如果持续失败，可以在 DPD 设置中手动配置数据下载地址。

**问：脚本在 WikiPali 上没有反应？**
尝试刷新页面。如果仍然不行，检查扩展菜单中脚本是否已启用（图标应为彩色而非灰色）。

**问：词典数据会更新吗？**
如发现数据有更新，脚本会自动检测并提示你重新下载，无需手动操作。
