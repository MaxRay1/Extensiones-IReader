"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

var cheerio = require("cheerio");
var fetchModule = require("@libs/fetch");
var fetchApi = fetchModule.fetchApi || fetchModule;
var fetchText = fetchModule.fetchText || function(url, options) {
  return fetchApi(url, options).then(function(r) { return r.text(); });
};
var novelStatus = require("@libs/novelStatus");
var NovelStatus = novelStatus.NovelStatus || { Ongoing: "Ongoing", Completed: "Completed", Unknown: "Unknown" };

var SITE = "https://novelasligeras.net";

var NovelasLigerasPlugin = function () {
  this.id = "novelasligeras-net";
  this.name = "Novelas Ligeras (NOVA)";
  this.version = "2.0.0";
  this.icon = "https://raw.githubusercontent.com/MaxRay1/Extensiones-IReader/main/icon.png";
  this.site = SITE;
  this.filters = undefined;
};

NovelasLigerasPlugin.prototype.popularNovels = function (pageNo, options) {
  var url = SITE + "/?s=&post_type=product&paged=" + (pageNo || 1);
  return fetchText(url).then(function (body) {
    var $ = cheerio.load(body);
    var novels = [];
    var seen = {};

    $("div.wf-cell").each(function (i, el) {
      var cell = $(el);
      var linkEl = cell.find("h4.entry-title a").first();
      var imgEl = cell.find("img.attachment-woocommerce_thumbnail, img.iso-lazy-load, img.preload-me").first();

      var name = linkEl.attr("title") || linkEl.text().trim();
      var href = linkEl.attr("href") || "";
      var path = href.replace(SITE, "");

      var cover = imgEl.attr("data-src") || imgEl.attr("data-srcset") || imgEl.attr("src") || "";

      if (cover && cover.indexOf(",") !== -1) {
        cover = cover.split(",")[0].trim().split(" ")[0];
      }
      if (cover && cover.indexOf("data:image") === 0) {
        cover = imgEl.attr("data-src") || "";
      }

      if (name && path && !seen[path]) {
        seen[path] = true;
        novels.push({ name: name, path: path, cover: cover });
      }
    });

    return novels;
  });
};

NovelasLigerasPlugin.prototype.parseNovel = function (novelPath) {
  var url = novelPath.startsWith("http") ? novelPath : SITE + novelPath;

  return fetchText(url).then(function (body) {
    var $ = cheerio.load(body);

    var name = $("h1.product_title.entry-title").text().trim() ||
               $("h1").first().text().trim() || "Sin título";

    var coverEl = $(".woocommerce-product-gallery__image img").first();
    var cover = coverEl.attr("data-src") || coverEl.attr("data-large_image") || coverEl.attr("src") || "";

    var summary = "";
    $(".woocommerce-product-details__short-description p").each(function (i, el) {
      var text = $(el).text().trim();
      if (text && text.indexOf("Sinopsis por") === -1) {
        summary += (summary ? "\n\n" : "") + text;
      }
    });

    var genres = [];
    $("span.posted_in a[rel='tag']").each(function (i, el) {
      var g = $(el).text().trim();
      if (g) genres.push(g);
    });
    $("span.tagged_as a[rel='tag']").each(function (i, el) {
      var t = $(el).text().trim();
      if (t) genres.push(t);
    });

    var articleClasses = $("article.product").attr("class") || "";
    var status = NovelStatus.Ongoing;
    if (articleClasses.indexOf("pa_estado-completado") !== -1 ||
        articleClasses.indexOf("pa_estado-finalizado") !== -1) {
      status = NovelStatus.Completed;
    }

    var author = "";
    var authorMatch = articleClasses.match(/pa_escritor-([^\s]+)/);
    if (authorMatch) {
      author = authorMatch[1].replace(/-/g, " ");
      author = author.charAt(0).toUpperCase() + author.slice(1);
    }

    var chapters = [];
    var chapterNum = 1;
    var seenPaths = {};

    $("#tab-description a, .wpb_tour a, .woocommerce-Tabs-panel--description a").each(function (i, el) {
      var href = $(el).attr("href") || "";
      var chName = $(el).text().trim();

      if (href.indexOf(SITE) !== -1 &&
          href.indexOf("/producto/") === -1 &&
          href.indexOf("#") === -1 &&
          chName.length > 0) {

        var chPath = href.replace(SITE, "");

        if (!seenPaths[chPath]) {
          seenPaths[chPath] = true;
          chapters.push({
            name: chName,
            path: chPath,
            chapterNumber: chapterNum++
          });
        }
      }
    });

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
};

NovelasLigerasPlugin.prototype.parseChapter = function (chapterPath) {
  var url = chapterPath.startsWith("http") ? chapterPath : SITE + chapterPath;

  return fetchText(url).then(function (body) {
    var $ = cheerio.load(body);

    var contentEl = $(".entry-content .wpb-content-wrapper").first();
    if (contentEl.length === 0) {
      contentEl = $(".entry-content").first();
    }

    contentEl.find("script, style, .adsbygoogle, ins, .track-ad, .author-info, #comments, .comments-area").remove();

    contentEl.find("a").each(function (i, el) {
      var aEl = $(el);
      var text = aEl.text().trim().toLowerCase();
      if (text === "anterior" || text === "siguiente" || text === "indice" || text === "índice") {
        aEl.closest(".vc_row, .vc_column_inner, div").first().remove();
      }
    });

    contentEl.find("div").each(function (i, el) {
      var div = $(el);
      if (div.find("a.track-ad").length > 0) {
        div.remove();
      }
    });

    contentEl.find("img").each(function (i, el) {
      var img = $(el);
      var realSrc = img.attr("data-src") || img.attr("src") || "";
      if (realSrc && realSrc.indexOf("data:image") !== 0) {
        img.attr("src", realSrc);
        img.removeAttr("data-src");
        img.removeAttr("data-srcset");
        img.removeAttr("srcset");
        img.css("max-width", "100%");
        img.css("height", "auto");
      }
    });

    return contentEl.html() || "<p>No se pudo cargar el capítulo.</p>";
  });
};

NovelasLigerasPlugin.prototype.searchNovels = function (searchTerm, pageNo) {
  var url = SITE + "/?s=" + encodeURIComponent(searchTerm) + "&post_type=product&paged=" + (pageNo || 1);
  return fetchText(url).then(function (body) {
    var $ = cheerio.load(body);
    var novels = [];
    var seen = {};

    $("div.wf-cell").each(function (i, el) {
      var cell = $(el);
      var linkEl = cell.find("h4.entry-title a").first();
      var imgEl = cell.find("img.attachment-woocommerce_thumbnail, img.iso-lazy-load, img.preload-me").first();

      var name = linkEl.attr("title") || linkEl.text().trim();
      var href = linkEl.attr("href") || "";
      var path = href.replace(SITE, "");

      var cover = imgEl.attr("data-src") || imgEl.attr("data-srcset") || imgEl.attr("src") || "";

      if (cover && cover.indexOf(",") !== -1) {
        cover = cover.split(",")[0].trim().split(" ")[0];
      }
      if (cover && cover.indexOf("data:image") === 0) {
        cover = imgEl.attr("data-src") || "";
      }

      if (name && path && !seen[path]) {
        seen[path] = true;
        novels.push({ name: name, path: path, cover: cover });
      }
    });

    return novels;
  });
};

NovelasLigerasPlugin.prototype.fetchImage = function (url) {
  return fetchApi(url, { headers: { Referer: SITE } }).then(function (r) {
    return r.arrayBuffer();
  });
};

exports.default = new NovelasLigerasPlugin();
