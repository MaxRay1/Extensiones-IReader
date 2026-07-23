import { Plugin, NovelItem, NovelDetails, ChapterItem } from "../../src/types/plugin";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
};

/**
 * Convierte un texto a slug URL (ej: "Acción y Fantasía" -> "accion-y-fantasia")
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Limpia y resuelve URLs de imágenes de lazy-loading o srcset
 */
function extractImageUrl(elementHtml: string): string {
  const lazyMatch = elementHtml.match(/data-(?:lazy-)?src=["']([^"']+)["']/i);
  if (lazyMatch && lazyMatch[1]) return lazyMatch[1].trim();

  const srcMatch = elementHtml.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1] && !srcMatch[1].startsWith("data:")) {
    return srcMatch[1].trim();
  }

  const srcsetMatch = elementHtml.match(/srcset=["']([^"']+)["']/i);
  if (srcsetMatch && srcsetMatch[1]) {
    const firstUrl = srcsetMatch[1].split(",")[0].trim().split(" ")[0];
    if (firstUrl) return firstUrl;
  }

  return "";
}

/**
 * Extrae ítems de novela (portada, título, enlace) del HTML de un listado
 */
function parseNovelListHtml(html: string): NovelItem[] {
  const novels: NovelItem[] = [];
  const articleRegex = /<article[\s\S]*?<\/article>|<div[^>]*class=["'][^"']*(?:post|entry-card|elementor-post|novel-item)[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi;
  
  const matches = html.match(articleRegex) || [];

  for (const block of matches) {
    const titleLinkMatch = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>(?:<h[1-6][^>]*>)?\s*([^<]+)\s*(?:<\/h[1-6]>)?<\/a>/i) ||
                           block.match(/<h[1-6][^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/i);
    
    if (!titleLinkMatch) continue;

    const fullUrl = titleLinkMatch[1];
    let name = titleLinkMatch[2].trim().replace(/<[^>]+>/g, "").trim();

    if (!name || name.length < 2) continue;

    let path = fullUrl;
    if (path.startsWith("https://novelasligeras.net")) {
      path = path.replace("https://novelasligeras.net", "");
    }

    const cover = extractImageUrl(block);

    if (!novels.some((n) => n.path === path)) {
      novels.push({ name, path, cover });
    }
  }

  // Fallback si no encuentra bloques de artículo
  if (novels.length === 0) {
    const linkRegex = /<a[^>]+href=["'](https?:\/\/novelasligeras\.net\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      const innerHtml = match[2];
      
      if (href.includes("/category/") || href.includes("/tag/") || href.includes("/page/") || href.includes("/contacto/")) {
        continue;
      }

      const imgCover = extractImageUrl(innerHtml);
      const titleMatch = innerHtml.match(/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/i) || [null, innerHtml.replace(/<[^>]+>/g, "").trim()];
      const name = titleMatch[1]?.trim();

      if (name && name.length > 2 && imgCover) {
        let path = href.replace("https://novelasligeras.net", "");
        if (!novels.some((n) => n.path === path)) {
          novels.push({ name, path, cover: imgCover });
        }
      }
    }
  }

  return novels;
}

export const plugin: Plugin = {
  id: "novelasligeras-net",
  name: "Novelas Ligeras",
  icon: "icon.png",
  site: "https://novelasligeras.net",
  version: "1.0.1",
  lang: "es",

  async popularNovels(pageNo: number): Promise<NovelItem[]> {
    const url = pageNo === 1 
      ? `${this.site}/` 
      : `${this.site}/page/${pageNo}/`;

    const response = await fetch(url, { headers: DEFAULT_HEADERS });

    if (response.status === 403 || response.status === 503) {
      throw new Error("Protección Cloudflare activa. Por favor abre el WebView en IReader (icono de la web) para resolver la verificación.");
    }

    const html = await response.text();

    if (html.includes("Just a moment...") || html.includes("cf-challenge-running") || html.includes("Attention Required!")) {
      throw new Error("Protección Cloudflare activa. Abre el WebView para autenticar tu navegador.");
    }

    const list = parseNovelListHtml(html);
    if (list.length === 0) {
      throw new Error("No se encontraron novelas. Si el sitio no carga en WebView, puede requerir VPN o solución de Cloudflare.");
    }

    return list;
  },

  async parseNovelAndChapters(novelPath: string): Promise<NovelDetails> {
    const url = novelPath.startsWith("http") ? novelPath : `${this.site}${novelPath}`;
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await response.text();

    const titleMatch = html.match(/<h1[^>]*class=["'][^"']*(?:entry-title|novel-title)[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const name = titleMatch ? titleMatch[1].trim() : "Sin título";

    const coverMatch = html.match(/<div[^>]*class=["'][^"']*(?:post-thumbnail|novel-cover|entry-content)[^"']*["'][\s\S]*?<img[^>]+>/i) ||
                       html.match(/<img[^>]+class=["'][^"']*wp-post-image[^"']*["'][^>]*>/i);
    const cover = coverMatch ? extractImageUrl(coverMatch[0]) : extractImageUrl(html);

    let summary = "";
    const summaryBlockMatch = html.match(/<div[^>]*class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (summaryBlockMatch) {
      const paragraphs = summaryBlockMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi);
      if (paragraphs) {
        summary = paragraphs
          .map((p) => p.replace(/<[^>]+>/g, "").trim())
          .filter((text) => text.length > 20 && !text.includes("Capítulo") && !text.includes("Descargar"))
          .slice(0, 5)
          .join("\n\n");
      }
    }

    const genres: string[] = [];
    const tagRegex = /<a[^>]+href=["'][^"']*\/(?:tag|genero|category|etiqueta)\/([^"']+)\/["'][^>]*>([^<]+)<\/a>/gi;
    let tagMatch: RegExpExecArray | null;
    while ((tagMatch = tagRegex.exec(html)) !== null) {
      const genreName = tagMatch[2].trim();
      if (genreName && !genres.includes(genreName)) {
        genres.push(genreName);
      }
    }

    let status = "En emisión";
    if (html.toLowerCase().includes("finalizado") || html.toLowerCase().includes("completado")) {
      status = "Finalizado";
    }

    let author = "";
    const authorMatch = html.match(/(?:Autor|Author):\s*<\/strong>\s*([^<]+)/i) ||
                        html.match(/<strong>(?:Autor|Author):<\/strong>\s*([^<]+)/i);
    if (authorMatch) {
      author = authorMatch[1].trim();
    }

    const chapters: ChapterItem[] = [];
    const chapterLinkRegex = /<a[^>]+href=["'](https?:\/\/novelasligeras\.net\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let chMatch: RegExpExecArray | null;
    let chapterNumber = 1;

    while ((chMatch = chapterLinkRegex.exec(html)) !== null) {
      const chHref = chMatch[1];
      const chTitleRaw = chMatch[2].replace(/<[^>]+>/g, "").trim();

      const isChapterLink = /capitulo|capítul|cap[\s.-]*\d+|\b\d+\b/i.test(chHref) ||
                            /capitulo|capítul|cap[\s.-]*\d+/i.test(chTitleRaw);

      if (isChapterLink && chTitleRaw.length > 0 && !chHref.includes("#")) {
        let chPath = chHref.replace("https://novelasligeras.net", "");
        
        if (!chapters.some((c) => c.path === chPath)) {
          chapters.push({
            name: chTitleRaw || `Capítulo ${chapterNumber}`,
            path: chPath,
            chapterNumber: chapterNumber++,
          });
        }
      }
    }

    return {
      name,
      path: novelPath,
      cover,
      summary,
      author,
      status,
      genres,
      chapters,
    };
  },

  async parseChapter(chapterPath: string): Promise<string> {
    const url = chapterPath.startsWith("http") ? chapterPath : `${this.site}${chapterPath}`;
    const response = await fetch(url, { headers: DEFAULT_HEADERS });
    const html = await response.text();

    const contentMatch = html.match(/<div[^>]*class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<!--/i) ||
                         html.match(/<div[^>]*class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    if (!contentMatch) {
      return "<p>No se pudo cargar el contenido del capítulo.</p>";
    }

    let chapterContent = contentMatch[1];

    chapterContent = chapterContent.replace(/<img[^>]+>/gi, (imgTag) => {
      const realSrc = extractImageUrl(imgTag);
      if (realSrc) {
        return `<p style="text-align: center;"><img src="${realSrc}" style="max-width: 100%; height: auto;" /></p>`;
      }
      return imgTag;
    });

    chapterContent = chapterContent
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<div[^>]*class=["'][^"']*(?:code-block|ads|navigation|post-navigation|share)[^"']*["'][\s\S]*?<\/div>/gi, "")
      .replace(/<a[^>]*>(?:Anterior|Siguiente|Índice|Siguiente Capítulo|Capítulo Anterior)<\/a>/gi, "");

    return chapterContent;
  },

  async searchNovels(searchTerm: string, pageNo: number): Promise<NovelItem[]> {
    const term = searchTerm.trim();
    let searchUrl = "";

    if (term.toLowerCase().startsWith("tag:") || term.toLowerCase().startsWith("etiqueta:")) {
      const tagSlug = slugify(term.split(":")[1] || "");
      searchUrl = pageNo === 1 
        ? `${this.site}/tag/${tagSlug}/` 
        : `${this.site}/tag/${tagSlug}/page/${pageNo}/`;
    } else if (term.toLowerCase().startsWith("genero:") || term.toLowerCase().startsWith("category:")) {
      const genreSlug = slugify(term.split(":")[1] || "");
      searchUrl = pageNo === 1 
        ? `${this.site}/genero/${genreSlug}/` 
        : `${this.site}/genero/${genreSlug}/page/${pageNo}/`;
    } else {
      searchUrl = pageNo === 1
        ? `${this.site}/?s=${encodeURIComponent(term)}`
        : `${this.site}/page/${pageNo}/?s=${encodeURIComponent(term)}`;
    }

    try {
      const response = await fetch(searchUrl, { headers: DEFAULT_HEADERS });
      if (!response.ok) return [];
      const html = await response.text();
      
      let results = parseNovelListHtml(html);

      if (results.length === 0 && pageNo === 1 && !term.includes(":")) {
        const tagSlug = slugify(term);
        const tagUrl = `${this.site}/tag/${tagSlug}/`;
        try {
          const tagResponse = await fetch(tagUrl, { headers: DEFAULT_HEADERS });
          if (tagResponse.ok) {
            const tagHtml = await tagResponse.text();
            results = parseNovelListHtml(tagHtml);
          }
        } catch (_) {}
      }

      return results;
    } catch (e) {
      console.error("Error en searchNovels:", e);
      return [];
    }
  }
};

export default plugin;
