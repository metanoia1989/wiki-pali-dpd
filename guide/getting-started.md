# 快速开始

5 分钟上手 Wikipali DPD。

## 总体步骤

1. **安装脚本管理器**（Chrome 用 Tampermonkey，Firefox/Edge 用 Violentmonkey）
2. **安装 Wikipali DPD 脚本**
3. **打开 Wikipali 下载词典数据**
4. **搜索单词开始使用**

> 如果还没有安装脚本管理器，请查看对应浏览器的安装指南：
>
> [Chrome 安装](install/chrome.html) · [Chrome（开发者模式）](install/chrome-unpacked.html) · [Firefox 安装](install/firefox.html) · [Edge 安装](install/edge.html)

## 安装脚本

安装好扩展后：

1. 打开 [Wikipali DPD 安装页面](https://pali-declension.mysticalpower.uk/)
2. 点击页面中央的 **「安装脚本」** 按钮
3. 扩展会自动弹出安装页面，点击 **「安装」** 即可

![安装脚本](../img/screenshots/dpd脚本主页-箭头提示指向安装按钮.webp)

## 首次使用

安装完成后：

1. 打开 <a href="https://next.wikipali.cc" target="_blank" rel="noopener">Wikipali 词典页面</a>（以新标签页打开）
2. 页面会自动弹出提示框询问是否下载词典数据

![下载数据提示](../img/screenshots/dpd首页下次词典数据确认弹窗.webp)

3. 点击 **「下载」**，等待进度条走完（约需几秒到十几秒，取决于网速）
4. 下载完成后，在搜索框中输入 `buddha` 搜索
5. 搜索结果上方会显示 DPD 信息栏，显示单词的词性、释义和更多信息

![查询结果展示](../img/screenshots/dpd注入查询结果到字典单页.webp)

## 常见问题

**问：词典数据下载失败怎么办？**
检查网络连接后重试。如果持续失败，可以在 DPD 设置中手动配置数据下载地址。

**问：脚本在 Wikipali 上没有反应？**
尝试刷新页面。如果仍然不行，检查扩展菜单中脚本是否已启用（图标应为彩色而非灰色）。

**问：词典数据会更新吗？**
如发现数据有更新，脚本会自动检测并提示你重新下载，无需手动操作。
