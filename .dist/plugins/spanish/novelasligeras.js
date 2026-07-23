"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

var cheerio;
try { cheerio = require("cheerio"); } catch(e) { cheerio = null; }

var SITE = "https://novelasligeras.net";

function parseHTML(html, selector) {
  if (cheerio) {
    return cheerio.load(html);
  }
  return null;
}

function extractAttr(tag, attr) {
  var re = new RegExp(attr + '=["\']([^"\']+)["\']', 'i');
  var m = tag.match(re);
  return m ? m[1] : "";
}

function extractNovels(html) {
  var novels = [];
  var cellRegex = /<div[^>]*class="[^"]*wf-cell[^"]*"[^>]*data-name="([^"]*)"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*class="[^"]*alignnone[^"]*"[^>]*>[\s\S]*?<img[^>]+data-src="([^"]*)"[^>]*>[\s\S]*?<h4[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)<\/a>/gi;
  var match;
  var seen = {};

  while ((match = cellRegex.exec(html)) !== null) {
    var name = match[5] || match[6] || match[1];
    var path = (match[4] || match[2]).replace(SITE, "");
    var cover = match[3] || "";

    if (name && path && !seen[path]) {
      seen[path] = true;
      novels.push({ name: name.trim(), path: path, cover: cover });
    }
  }

  if (novels.length === 0) {
    var simpleRegex = /<h4[^>]*class="[^"]*entry-title[^"]*"[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*(?:title="([^"]*)")?[^>]*>([^<]*)<\/a>/gi;
    while ((match = simpleRegex.exec(html)) !== null) {
      var href = match[1];
      var title = match[2] || match[3];
      var p = href.replace(SITE, "");
      if (title && p && !seen[p] && p.indexOf("/producto/") !== -1) {
        seen[p] = true;

        var imgSearch = html.indexOf(href);
        var covr = "";
        if (imgSearch > -1) {
          var block = html.substring(Math.max(0, imgSearch - 2000), imgSearch + 500);
          var imgM = block.match(/data-src="(https:\/\/novelasligeras\.net\/wp-content\/uploads\/[^"]+)"/i);
          if (imgM) covr = imgM[1];
        }

        novels.push({ name: title.trim(), path: p, cover: covr });
      }
    }
  }

  return novels;
}

var plugin = {
  id: "novelasligeras-net",
  name: "Novelas Ligeras (NOVA)",
  version: "1.1.0",
  icon: "src/es/novelasligeras/icon.png",
  site: SITE,
  filters: undefined,

  popularNovels: function (pageNo, options) {
    var url = SITE + "/?s=&post_type=product&paged=" + pageNo;
    return fetch(url).then(function (r) { return r.text(); }).then(function (html) {
      return extractNovels(html);
    });
  },

  parseNovel: function (novelPath) {
    var url = novelPath.startsWith("http") ? novelPath : SITE + novelPath;

    return fetch(url).then(function (r) { return r.text(); }).then(function (html) {
      var titleM = html.match(/<h1[^>]*class="[^"]*product_title[^"]*"[^>]*>([^<]+)<\/h1>/i);
      var name = titleM ? titleM[1].trim() : "Sin título";

      var coverM = html.match(/woocommerce-product-gallery__image[\s\S]*?(?:data-src|src)="(https:\/\/novelasligeras\.net\/wp-content\/uploads\/[^"]+)"/i);
      var cover = coverM ? coverM[1] : "";

      var summary = "";
      var summaryM = html.match(/<div[^>]*class="[^"]*woocommerce-product-details__short-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
      if (summaryM) {
        var pTags = summaryM[1].match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
        summary = pTags
          .map(function (p) { return p.replace(/<[^>]+>/g, "").trim(); })
          .filter(function (t) { return t.length > 5 && t.indexOf("Sinopsis por") === -1; })
          .join("\n\n");
      }

      var genres = [];
      var genreRegex = /<span[^>]*class="[^"]*posted_in[^"]*"[^>]*>[\s\S]*?<\/span>/i;
      var genreBlock = html.match(genreRegex);
      if (genreBlock) {
        var gLinks = genreBlock[0].match(/<a[^>]+rel="tag"[^>]*>([^<]+)<\/a>/gi) || [];
        gLinks.forEach(function (a) {
          var gm = a.match(/>([^<]+)</);
          if (gm) genres.push(gm[1].trim());
        });
      }

      var tagBlock = html.match(/<span[^>]*class="[^"]*tagged_as[^"]*"[^>]*>[\s\S]*?<\/span>/i);
      if (tagBlock) {
        var tLinks = tagBlock[0].match(/<a[^>]+rel="tag"[^>]*>([^<]+)<\/a>/gi) || [];
        tLinks.forEach(function (a) {
          var tm = a.match(/>([^<]+)</);
          if (tm) genres.push(tm[1].trim());
        });
      }

      var articleClasses = "";
      var artM = html.match(/<article[^>]*class="([^"]*product[^"]*)"/i);
      if (artM) articleClasses = artM[1];

      var status = "Ongoing";
      if (articleClasses.indexOf("pa_estado-completado") !== -1 || articleClasses.indexOf("pa_estado-finalizado") !== -1) {
        status = "Completed";
      }

      var author = "";
      var authorM = articleClasses.match(/pa_escritor-([^\s]+)/);
      if (authorM) {
        author = authorM[1].replace(/-/g, " ");
      }

      var chapters = [];
      var chNum = 1;
      var seenCh = {};

      var descBlock = html.match(/id="tab-description"[\s\S]*?(?=<div[^>]*id="tab-(?:reviews|additional_information)"|<\/div>\s*<\/div>\s*<\/div>\s*<div[^>]*class="[^"]*related)/i);
      var descHtml = descBlock ? descBlock[0] : html;

      var chLinkRegex = /<a[^>]+href="(https?:\/\/novelasligeras\.net\/index\.php\/\d{4}\/\d{2}\/\d{2}\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;
      var chMatch;
      while ((chMatch = chLinkRegex.exec(descHtml)) !== null) {
        var chPath = chMatch[1].replace(SITE, "");
        var chName = chMatch[2].trim();
        if (chName && !seenCh[chPath]) {
          seenCh[chPath] = true;
          chapters.push({
            name: chName,
            path: chPath,
            chapterNumber: chNum++
          });
        }
      }

      return {
        name: name,
        path: novelPath,
        cover: cover,
        summary: summary,
        author: author,
        status: status,
        genres: genres,
        chapters: chapters
      };
    });
  },

  parseChapter: function (chapterPath) {
    var url = chapterPath.startsWith("http") ? chapterPath : SITE + chapterPath;

    return fetch(url).then(function (r) { return r.text(); }).then(function (html) {
      var contentM = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i) ||
                     html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)(?:<div[^>]*class="[^"]*author-info|<div[^>]*id="comments)/i);

      if (!contentM) return "<p>No se pudo cargar el capítulo.</p>";

      var content = contentM[1];

      content = content
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<ins[^>]*class="[^"]*adsbygoogle[^"]*"[\s\S]*?<\/ins>/gi, "")
        .replace(/<a[^>]*class="[^"]*track-ad[^"]*"[\s\S]*?<\/a>/gi, "")
        .replace(/<div[^>]*class="[^"]*vc_custom_1512571244059[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi, "")
        .replace(/<div[^>]*class="[^"]*btn-align-(?:left|center|right)[^"]*"[\s\S]*?<\/div>/gi, "");

      content = content.replace(/<img[^>]+>/gi, function (imgTag) {
        var dataSrc = extractAttr(imgTag, "data-src");
        var src = extractAttr(imgTag, "src");
        var realSrc = dataSrc || src;
        if (realSrc && realSrc.indexOf("data:image") !== 0 && realSrc.indexOf("wp-content/uploads") !== -1) {
          return '<p style="text-align:center;"><img src="' + realSrc + '" style="max-width:100%;height:auto;" /></p>';
        }
        return "";
      });

      return content;
    });
  },

  searchNovels: function (searchTerm, pageNo) {
    var url = SITE + "/?s=" + encodeURIComponent(searchTerm) + "&post_type=product&paged=" + pageNo;
    return fetch(url).then(function (r) { return r.text(); }).then(function (html) {
      return extractNovels(html);
    });
  },

  fetchImage: function (url) {
    return fetch(url, { headers: { Referer: SITE } });
  }
};

exports.default = plugin;
