/**
 * 使用指南构建脚本
 *
 * 编译期：Markdown → 静态 HTML，含：
 * - 侧边栏导航（按当前页深度计算相对路径）
 * - 右侧章节导航（从 h2/h3 自动生成）
 * - 上下页导航（相对路径）
 * - 面包屑（相对路径）
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const GUIDE_SRC = resolve(ROOT, "guide");
const GUIDE_DIST = resolve(ROOT, "dist", "guide");

// ── Marked 配置（为标题自动生成 ID） ──────────
const renderer = new marked.Renderer();
renderer.heading = function (token) {
  const text = token.text;
  const level = token.depth;
  const id = text
    .replace(/<[^>]*>/g, "")
    .replace(/&[^;]+;/g, "")
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `<h${level} id="${id}">${text}</h${level}>`;
};
marked.use({ renderer, gfm: true, breaks: false });

// ── 工具函数 ──────────────────────────────────

function readJSON(file) {
  return JSON.parse(readFileSync(file, "utf-8"));
}
function readText(file) {
  return readFileSync(file, "utf-8");
}
function writeText(file, content) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content, "utf-8");
}

/** 从当前页面路径计算到目标页面的相对 href（含 .html） */
function relativeHref(from, to) {
  // from: "install/chrome", to: "getting-started"
  const depth = from.split("/").length - 1;
  let prefix = "";
  for (let i = 0; i < depth; i++) prefix += "../";
  if (!prefix) prefix = "./";
  return prefix + to + ".html";
}

/** 展平导航页（含 children） */
function flattenPages(pages) {
  const flat = [];
  for (const p of pages) {
    if (p.path) flat.push(p);
    if (p.children) flat.push(...flattenPages(p.children));
  }
  return flat;
}

/** 根据当前页面深度计算图标标签 */
function iconTag(icon, currentPath) {
  if (icon && icon.startsWith("img/")) {
    const depth = currentPath.split("/").length - 1;
    const prefix = depth > 0 ? "../".repeat(depth) : "./";
    return `<img src="${prefix}${icon}" alt="" class="nav-icon" />`;
  }
  return icon || "";
}

/** 构建侧边栏导航 HTML（所有链接带相对路径） */
function buildNavHTML(pages, activeId, currentPath, depth) {
  if (depth === undefined) depth = 0;
  let html = "";
  for (const p of pages) {
    if (p.path) {
      const active = p.id === activeId ? " active" : "";
      const cls = depth > 0 ? "nav-link nav-child" : "nav-link";
      const href = relativeHref(currentPath, p.path);
      const icon = iconTag(p.icon, currentPath);
      html += `<a href="${href}" class="${cls}${active}">${icon} ${p.title}</a>\n`;
    } else if (p.children) {
      const icon = iconTag(p.icon, currentPath);
      html += `<div class="nav-section">${icon} ${p.title}</div>\n`;
      html += buildNavHTML(p.children, activeId, currentPath, depth + 1);
    }
  }
  return html;
}

/** 构建面包屑 HTML */
function buildBreadcrumb(navPages, pageId, currentPath) {
  function find(navPages, parents) {
    for (const p of navPages) {
      if (p.id === pageId) return [...parents, p];
      if (p.children) {
        const result = find(p.children, [...parents, p]);
        if (result) return result;
      }
    }
    return null;
  }

  const path = find(navPages, []);
  if (!path || path.length === 0) return "";

  let html = `<a href="${relativeHref(currentPath, "index")}">首页</a>`;
  for (let i = 1; i < path.length; i++) {
    html += ` <span class="breadcrumb-sep">›</span> `;
    if (i === path.length - 1) {
      html += `<span class="breadcrumb-current">${path[i].title}</span>`;
    } else {
      html += `<span>${path[i].title}</span>`;
    }
  }
  return html;
}

/** 从渲染后的 HTML 提取章节导航（h2/h3） */
function extractTOC(html) {
  const regex = /<h([23])\s+id="([^"]+)"[^>]*>(.*?)<\/h[23]>/g;
  const items = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    items.push({
      level: parseInt(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]*>/g, ""),
    });
  }

  if (items.length < 2) return "";

  let toc = '<ul class="toc-list">';
  for (const item of items) {
    const cls = item.level === 3 ? ' class="toc-h3"' : "";
    toc += `<li${cls}><a href="#${item.id}">${item.text}</a></li>`;
  }
  toc += "</ul>";
  return toc;
}

/** 递归复制整个 img/ 目录到输出目录，缺失文件用占位 SVG 补充 */
function ensureImages(srcDir, distDir) {
  const imgSrc = resolve(srcDir, "img");
  const imgDst = resolve(distDir, "img");
  if (!existsSync(imgSrc)) { mkdirSync(imgSrc, { recursive: true }); return; }

  function copyRecursive(currentSrc, currentDst) {
    mkdirSync(currentDst, { recursive: true });
    const entries = readdirSync(currentSrc, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const s = resolve(currentSrc, entry.name);
      const d = resolve(currentDst, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(s, d);
      } else {
        copyFileSync(s, d);
      }
    }
  }

  copyRecursive(imgSrc, imgDst);
  console.log("  ✓ img/ (递归复制)");
}

// ── 主流程 ────────────────────────────────────

function main() {
  console.log("\n📖 构建使用指南...\n");

  const nav = readJSON(resolve(GUIDE_SRC, "nav.json"));
  let template = readText(resolve(GUIDE_SRC, "template.html"));
  const flatPages = flattenPages(nav.pages);

  mkdirSync(GUIDE_DIST, { recursive: true });

  for (const page of flatPages) {
    const mdPath = resolve(GUIDE_SRC, `${page.path}.md`);
    if (!existsSync(mdPath)) {
      console.warn(`  ⚠️  跳过: ${page.path}.md (不存在)`);
      continue;
    }

    const md = readText(mdPath);
    const content = marked.parse(md);

    // 导航
    const navHtml = buildNavHTML(nav.pages, page.id, page.path);
    const breadcrumbHtml = buildBreadcrumb(nav.pages, page.id, page.path);

    // 上下页
    const currentIdx = flatPages.findIndex((p) => p.id === page.id);
    const prev = currentIdx > 0 ? flatPages[currentIdx - 1] : null;
    const next = currentIdx < flatPages.length - 1 ? flatPages[currentIdx + 1] : null;
    const prevHtml = prev ? `<a href="${relativeHref(page.path, prev.path)}">← ${prev.title}</a>` : "";
    const nextHtml = next ? `<a href="${relativeHref(page.path, next.path)}">${next.title} →</a>` : "";

    // 章节导航 TOC
    const tocHtml = extractTOC(content);

    // style.css、icon 相对路径
    const depth = page.path.split("/").length - 1;
    const toRoot = depth > 0 ? "../".repeat(depth) : "./";

    // 也把 icon-tampermonkey 的相对路径传进去
    const siteRoot = depth > 0 ? "../".repeat(depth + 1) : "../";
    const tmIconSrc = `${toRoot}img/icon-tampermonkey.svg`;

    let html = template;
    html = html.replace(/\{\{page_title\}\}/g, page.title);
    html = html.replace(/\{\{content\}\}/g, content);
    html = html.replace(/\{\{nav_html\}\}/g, navHtml);
    html = html.replace(/\{\{breadcrumb_html\}\}/g, breadcrumbHtml);
    html = html.replace(/\{\{prev_html\}\}/g, prevHtml);
    html = html.replace(/\{\{next_html\}\}/g, nextHtml);
    html = html.replace(/\{\{toc_html\}\}/g, tocHtml);
    html = html.replace(/\{\{style_path\}\}/g, `${toRoot}style.css`);
    html = html.replace(/\{\{tm_icon_path\}\}/g, tmIconSrc);
    html = html.replace(/\{\{to_root\}\}/g, toRoot);
    html = html.replace(/\{\{site_root\}\}/g, siteRoot);

    const outPath = resolve(GUIDE_DIST, `${page.path}.html`);
    writeText(outPath, html);
    console.log(`  ✓ ${page.path}.html`);
  }

  // 复制样式
  copyFileSync(resolve(GUIDE_SRC, "style.css"), resolve(GUIDE_DIST, "style.css"));
  console.log("  ✓ style.css");

  // 图片
  ensureImages(GUIDE_SRC, GUIDE_DIST);

  console.log("\n✅ 使用指南构建完成: dist/guide/\n");
}

main();
