# Wiki Pali DPD

Tampermonkey 用户脚本，为 [WikiPali](https://wikipali.cc)（wikipali.cc / wikipali.org）注入 DPD（Digital Pali Dictionary）词典数据，
提供巴利语单词的变格表、复合词拆解、释义查询功能。

## 功能

- **词典查询** — 在 WikiPali（wikipali.cc / wikipali.org）搜索巴利语单词时，自动查询 DPD 词典数据并显示释义、词性、语法信息
- **变格表** — 名词、形容词的完整变格表一键展开，支持所有常见词干类型
- **复合词拆解** — 自动识别复合词并拆解为组成部分
- **离线可用** — 数据通过 IndexedDB 缓存，首次加载后完全离线使用

## 安装（用户）

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 或 [Violentmonkey](https://violentmonkey.github.io/) 浏览器扩展
2. 打开 [Wiki Pali DPD 页面](https://pali-declension.pages.dev/) 点击「安装脚本」
3. 在扩展弹出的安装页面中确认安装
4. 打开 [wikipali.cc](https://wikipali.cc) 或 [wikipali.org](https://wikipali.org) 搜索任意巴利语单词，首次使用时按提示下载词典数据

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器（介绍页 + 油猴脚本构建监听）
npm run dev

# 单独构建油猴脚本（输出到 dist/wiki-pali-dpd.user.js）
npm run build
```

开发服务器启动后：
- 介绍页：`http://localhost:5173/`
- 油猴脚本下载：`http://localhost:5173/wiki-pali-dpd.user.js`
  → 可在 Tampermonkey 中通过「从 URL 安装」添加，方便调试

## 构建

```bash
npm run build
```

输出到 `dist/` 目录：

```
dist/
├── index.html                   # 介绍页
├── wiki-pali-dpd.user.js        # 油猴脚本（安装用）
└── dpd-web.db.gz（可选）        # 词典数据（运行过 export-db 才会生成）
```

## 词典数据

脚本使用的轻量级词典数据从 [dpd-db](https://github.com/digitalpalidictionary/dpd-db) 项目中导出。

```bash
# 前置条件：dpd-db 仓库已 clone 到 ~/WorkSpace/dpd-db，
# 且已构建生成 dpd.db

# 导出数据到 exporter/share/dpd-web.db.gz
npm run export-db

# 然后构建时自动拷贝到 dist/
npm run build
```

数据文件可自行托管，在脚本设置中配置 `dpd_data_url` 即可。

## 部署（Cloudflare Pages）

项目使用 [Cloudflare Pages](https://pages.cloudflare.com/) 部署，通过 Wrangler CLI 发布。

```bash
# 首次：创建项目（已执行）
npx wrangler pages project create pali-declension

# 部署（将 dist/ 部署到指定分支）
npx wrangler pages deploy dist --branch <分支名>
```

> 注意：Wrangler CLI 单次部署最多 20,000 个文件，单个文件上限 25 MiB。
> 本项目 dist/ 产物通常仅 2-3 个文件（含 DB 数据约 11MB），远低于限制。

## 项目结构

```
wiki-pali-dpd/
├── index.html                     # 介绍页（Vite 入口）
├── vite.config.js                 # Vite 配置
├── scripts/
│   ├── vite-userscript.js         # Vite 插件：油猴脚本构建 + DB 数据拷贝
│   └── export/
│       └── web_db.py              # DPD 词典数据导出脚本
├── src/
│   ├── meta.js                    # 油猴脚本元数据（@match, @grant 等）
│   ├── main.js                    # 入口
│   ├── db/                        # 数据库查询
│   ├── inflection/                # 变格表渲染
│   ├── storage/                   # IndexedDB 缓存 + 查询历史
│   └── ui/                        # 注入 UI 组件
├── docs/technical/                # 技术文档
└── dist/                          # 构建输出
```

## 许可

MIT License
