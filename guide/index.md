# Wiki Pali DPD 使用指南

欢迎使用 **Wiki Pali DPD**！本脚本为 [WikiPali](https://wikipali.cc) 巴利语词典页面注入 [DPD（Digital Pali Dictionary）](https://github.com/digitalpalidictionary/dpd-db)词典数据，让你在查询巴利语单词时获得更丰富的语法信息。

## 本指南包含

<div class="browse-icons">

<a href="./getting-started.html" class="browse-icon-link">
  <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="#8b4513"/><text x="12" y="32" fill="#fff" font-size="24">🚀</text></svg>
  <span>快速开始</span>
</a>

<a href="./features.html" class="browse-icon-link">
  <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="#8b4513"/><text x="12" y="32" fill="#fff" font-size="24">✨</text></svg>
  <span>功能介绍</span>
</a>

<a href="./install/chrome.html" class="browse-icon-link">
  <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="#8b4513"/><text x="12" y="32" fill="#fff" font-size="24">🌐</text></svg>
  <span>Chrome 安装</span>
</a>

<a href="./install/firefox.html" class="browse-icon-link">
  <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="#8b4513"/><text x="12" y="32" fill="#fff" font-size="24">🦊</text></svg>
  <span>Firefox 安装</span>
</a>

<a href="./install/edge.html" class="browse-icon-link">
  <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="#8b4513"/><text x="12" y="32" fill="#fff" font-size="24">🔷</text></svg>
  <span>Edge 安装</span>
</a>

<a href="./usage.html" class="browse-icon-link">
  <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="10" fill="#8b4513"/><text x="12" y="32" fill="#fff" font-size="24">📝</text></svg>
  <span>使用说明</span>
</a>

</div>

## 什么是 Violentmonkey？

本脚本基于 **Violentmonkey** 扩展运行。这类扩展就像一个「脚本管理器」——

- 你安装的各类脚本可以自动在特定网页上运行
- 脚本能为网页添加新功能、改善使用体验
- 安装和管理都很简单

> Violentmonkey 开源、轻量、无广告。如果你更习惯 **Tampermonkey**，同样兼容本脚本。

## 准备工作

开始之前，你需要：

1. **一个支持脚本管理的浏览器** — Chrome、Firefox、Edge 均可
2. **安装 Violentmonkey 扩展** — 从浏览器的扩展商店安装
3. **网络连接** — 首次使用需要下载词典数据（约 18MB），之后离线可用

> 💡 整个安装过程只需 3-5 分钟，跟着对应浏览器的安装指南一步步操作即可。

## 选择你的浏览器

| 浏览器 | 安装方式 | 难度 |
|--------|---------|------|
| [Chrome](install/chrome.html) | 扩展商店安装 Tampermonkey | ⭐ 简单 |
| [Chrome（开发者模式）](install/chrome-unpacked.html) | 解压加载 Violentmonkey | ⭐⭐ 中等 |
| [Firefox](install/firefox.html) | 扩展商店安装 Tampermonkey | ⭐ 简单 |
| [Edge](install/edge.html) | 扩展商店安装 Tampermonkey | ⭐ 简单 |
