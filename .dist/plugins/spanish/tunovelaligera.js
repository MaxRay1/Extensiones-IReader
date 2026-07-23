"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

var tunovelaligera_exports = {};
__export(tunovelaligera_exports, {
  default: () => tunovelaligera_default,
  plugin: () => plugin
});
module.exports = __toCommonJS(tunovelaligera_exports);

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

function extractImageUrl(elementHtml) {
  const lazyMatch = elementHtml.match(/data-(?:lazy-)?src=["']([^"']+)["']/i);
  if (lazyMatch && lazyMatch[1]) return lazyMatch[1].trim();

  const srcMatch = elementHtml.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1] && !srcMatch[1].startsWith("data:")) {
    return srcMatch[1].trim();
  }

  return "";
}

function parseMangaListHtml(html) {
  const novels = [];
  const itemRegex = /<div[^>]*class=["'][^"']*(?:c-tabs-item__content|page-item-detail|manga-item)[^"']*["'][\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  
  const matches = html.match(itemRegex) || [];

  for (const block of matches) {
    const linkMatch = block.match(/<a[^>]+href=["'](https?:\/\/tunovelaligera\.com\/novela\/[^"']+)["'][^>]*>(?:<img[^>]+alt=["']([^"']+)["'])?/i) ||
                      block.match(/<h3[^>]*class=["'][^"']*h4[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);

    if (!linkMatch) continue;

    const fullUrl = linkMatch[1];
    let name = (linkMatch[2] || "").trim();

    if (!name) {
      const titleMatch = block.match(/<a[^>]+href=["'][^"']+novela\/[^"']+["'][^>]*>([^<]+)<\/a>/i);
      if (titleMatch) name = titleMatch[1].trim();
    }

    if (!name || name.length < 2) continue;

    let path = fullUrl.replace("https://tunovelaligera.com", "");
    const cover = extractImageUrl(block);

    if (!novels.some((n) => n.path === path)) {
      novels.push({ name, path, cover });
    }
  }

  return novels;
}

const plugin = {
  id: "tunovelaligera",
  name: "TuNovelaLigera",
  icon: "icon.png",
  site: "https://tunovelaligera.com",
  version: "1.0.0",
  lang: "es",

  async popularNovels(pageNo) {
    const url = pageNo === 1
      ? `${this.site}/novelas/`
      : `${this.site}/novelas/page/${pageNo}/`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    if (response.status === 403 || response.status === 503) {
      throw new Error("Protección Cloudflare activa. Abre el WebView para verificar.");
    }
    const html = await response.text();

    if (html.includes("Just a moment...") || html.includes("cf-challenge-running")) {
      throw new Error("Protección Cloudflare activa. Abre el WebView.");
    }

    return parseMangaListHtml(html);
  },

  async parseNovelAndChapters(novelPath) {
    const url = novelPath.startsWith("http") ? novelPath : `${this.site}${novelPath}`;
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await response.text();

    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<div[^>]*class=["'][^"']*post-title[^"']*["'][^>]*>\s*<h1[^>]*>([^<]+)<\/h1>/i);
    const name = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "Sin título";

    const coverMatch = html.match(/<div[^>]*class=["'][^"']*summary_image[^"']*["'][\s\S]*?<img[^>]+>/i);
    const cover = coverMatch ? extractImageUrl(coverMatch[0]) : extractImageUrl(html);

    let summary = "";
    const summaryMatch = html.match(/<div[^>]*class=["'][^"']*(?:summary__content|description-summary)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (summaryMatch) {
      summary = summaryMatch[1].replace(/<[^>]+>/g, "").trim();
    }

    const genres = [];
    const genreRegex = /<a[^>]+href=["'][^"']*\/(?:genero|manga-genre)\/([^"']+)\/["'][^>]*>([^<]+)<\/a>/gi;
    let gMatch;
    while ((gMatch = genreRegex.exec(html)) !== null) {
      const gName = gMatch[2].trim();
      if (gName && !genres.includes(gName)) genres.push(gName);
    }

    let status = "En emisión";
    if (html.toLowerCase().includes("completado") || html.toLowerCase().includes("finalizado")) {
      status = "Finalizado";
    }

    const chapters = [];
    const chapterRegex = /<li[^>]*class=["'][^"']*wp-manga-chapter[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
    let chMatch;
    let chNum = 1;

    while ((chMatch = chapterRegex.exec(html)) !== null) {
      const chHref = chMatch[1];
      const chTitle = chMatch[2].trim();
      const chPath = chHref.replace("https://tunovelaligera.com", "");

      if (!chapters.some((c) => c.path === chPath)) {
        chapters.push({
          name: chTitle || `Capítulo ${chNum}`,
          path: chPath,
          chapterNumber: chNum++,
        });
      }
    }

    return {
      name,
      path: novelPath,
      cover,
      summary,
      author: "",
      status,
      genres,
      chapters: chapters.reverse(),
    };
  },

  async parseChapter(chapterPath) {
    const url = chapterPath.startsWith("http") ? chapterPath : `${this.site}${chapterPath}`;
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await response.text();

    const contentMatch = html.match(/<div[^>]*class=["'][^"']*(?:text-left|entry-content|reading-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (!contentMatch) return "<p>No se pudo cargar el capítulo.</p>";

    let content = contentMatch[1];

    content = content.replace(/<img[^>]+>/gi, (imgTag) => {
      const src = extractImageUrl(imgTag);
      return src ? `<p style="text-align:center;"><img src="${src}" style="max-width:100%;height:auto;" /></p>` : imgTag;
    });

    content = content
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<div[^>]*class=["'][^"']*(?:cha-words|nav-links|cha-nav)[^"']*["'][\s\S]*?<\/div>/gi, "");

    return content;
  },

  async searchNovels(searchTerm, pageNo) {
    const term = searchTerm.trim();
    const url = `${this.site}/page/${pageNo}/?s=${encodeURIComponent(term)}&post_type=wp-manga`;

    try {
      const response = await fetch(url, { headers: DEFAULT_HEADERS });
      if (!response.ok) return [];
      const html = await response.text();
      return parseMangaListHtml(html);
    } catch (_) {
      return [];
    }
  }
};

var tunovelaligera_default = plugin;
