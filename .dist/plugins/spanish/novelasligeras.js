"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

var fetchApi = require("@libs/fetch");
var cheerio = require("cheerio");
var defaultCover = require("@libs/defaultCover");
var novelStatus = require("@libs/novelStatus");

var SITE = "https://novelasligeras.net";

var NovelasLigerasPlugin = function () {
  this.id = "novelasligeras-net";
  this.name = "Novelas Ligeras (NOVA)";
  this.version = "1.0.0";
  this.icon = "src/es/novelasligeras/icon.png";
  this.site = SITE;
  this.filters = undefined;
};

NovelasLigerasPlugin.prototype.popularNovels = function (pageNo, options) {
  return fetchApi
    .fetchApi(this.site + "/?s=&post_type=product&paged=" + pageNo)
    .then(function (r) { return r.text(); })
    .then(function (body) {
      var loadedCheerio = cheerio.load(body);
      var novels = [];

      loadedCheerio("div.wf-cell").each(function (i, el) {
        var cell = loadedCheerio(el);
        var linkEl = cell.find("h4.entry-title a").first();
        var imgEl = cell.find("img.iso-lazy-load, img.preload-me, img.attachment-woocommerce_thumbnail").first();

        var name = linkEl.attr("title") || linkEl.text().trim();
        var path = (linkEl.attr("href") || "").replace(SITE, "");
        var cover = imgEl.attr("data-src") || imgEl.attr("data-srcset") || imgEl.attr("src") || defaultCover;

        if (cover && cover.indexOf(",") !== -1) {
          cover = cover.split(",")[0].trim().split(" ")[0];
        }
        if (cover && cover.indexOf("data:image") === 0) {
          cover = imgEl.attr("data-src") || defaultCover;
        }

        if (name && path) {
          novels.push({ name: name, path: path, cover: cover });
        }
      });

      return novels;
    });
};

NovelasLigerasPlugin.prototype.parseNovelAndChapters = function (novelUrl) {
  var self = this;
  var url = novelUrl.startsWith("http") ? novelUrl : self.site + novelUrl;

  return fetchApi
    .fetchApi(url)
    .then(function (r) { return r.text(); })
    .then(function (body) {
      var loadedCheerio = cheerio.load(body);

      var name = loadedCheerio("h1.product_title.entry-title").text().trim() ||
                 loadedCheerio("h1").first().text().trim() || "Sin título";

      var coverEl = loadedCheerio(".woocommerce-product-gallery__image img").first();
      var cover = coverEl.attr("data-src") || coverEl.attr("src") || defaultCover;

      var summary = "";
      loadedCheerio(".woocommerce-product-details__short-description p").each(function (i, el) {
        var text = loadedCheerio(el).text().trim();
        if (text && text.indexOf("Sinopsis por") === -1) {
          summary += (summary ? "\n\n" : "") + text;
        }
      });

      var genres = [];
      loadedCheerio("span.posted_in a[rel='tag']").each(function (i, el) {
        genres.push(loadedCheerio(el).text().trim());
      });
      loadedCheerio("span.tagged_as a[rel='tag']").each(function (i, el) {
        genres.push(loadedCheerio(el).text().trim());
      });

      var articleClasses = loadedCheerio("article.product").attr("class") || "";
      var status = novelStatus.NovelStatus.Ongoing;
      if (articleClasses.indexOf("pa_estado-completado") !== -1 ||
          articleClasses.indexOf("pa_estado-finalizado") !== -1) {
        status = novelStatus.NovelStatus.Completed;
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

      loadedCheerio("#tab-description a, .wpb_tour a, .woocommerce-Tabs-panel--description a").each(function (i, el) {
        var href = loadedCheerio(el).attr("href") || "";
        var chName = loadedCheerio(el).text().trim();

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
        path: novelUrl,
        cover: cover,
        summary: summary,
        author: author,
        status: status,
        genres: genres,
        chapters: chapters
      };
    });
};

NovelasLigerasPlugin.prototype.parseChapter = function (chapterUrl) {
  var self = this;
  var url = chapterUrl.startsWith("http") ? chapterUrl : self.site + chapterUrl;

  return fetchApi
    .fetchApi(url)
    .then(function (r) { return r.text(); })
    .then(function (body) {
      var loadedCheerio = cheerio.load(body);

      var contentEl = loadedCheerio(".entry-content .wpb-content-wrapper").first();
      if (contentEl.length === 0) {
        contentEl = loadedCheerio(".entry-content").first();
      }

      contentEl.find("script, style, .adsbygoogle, ins, .track-ad, .author-info, #comments, .comments-area").remove();

      contentEl.find("a").each(function (i, el) {
        var aEl = loadedCheerio(el);
        var text = aEl.text().trim().toLowerCase();
        if (text === "anterior" || text === "siguiente" || text === "indice" || text === "índice") {
          aEl.closest(".vc_row, .vc_column_inner, div").first().remove();
        }
      });

      contentEl.find("div").each(function (i, el) {
        var div = loadedCheerio(el);
        if (div.find("a.track-ad").length > 0) {
          div.remove();
        }
      });

      contentEl.find("img").each(function (i, el) {
        var img = loadedCheerio(el);
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

      var chapterText = contentEl.html() || "<p>No se pudo cargar el capítulo.</p>";
      return chapterText;
    });
};

NovelasLigerasPlugin.prototype.searchNovels = function (searchTerm, pageNo) {
  var self = this;
  var url = self.site + "/?s=" + encodeURIComponent(searchTerm) + "&post_type=product&paged=" + pageNo;

  return fetchApi
    .fetchApi(url)
    .then(function (r) { return r.text(); })
    .then(function (body) {
      var loadedCheerio = cheerio.load(body);
      var novels = [];

      loadedCheerio("div.wf-cell").each(function (i, el) {
        var cell = loadedCheerio(el);
        var linkEl = cell.find("h4.entry-title a").first();
        var imgEl = cell.find("img.iso-lazy-load, img.preload-me, img.attachment-woocommerce_thumbnail").first();

        var name = linkEl.attr("title") || linkEl.text().trim();
        var path = (linkEl.attr("href") || "").replace(SITE, "");
        var cover = imgEl.attr("data-src") || imgEl.attr("data-srcset") || imgEl.attr("src") || defaultCover;

        if (cover && cover.indexOf(",") !== -1) {
          cover = cover.split(",")[0].trim().split(" ")[0];
        }
        if (cover && cover.indexOf("data:image") === 0) {
          cover = imgEl.attr("data-src") || defaultCover;
        }

        if (name && path) {
          novels.push({ name: name, path: path, cover: cover });
        }
      });

      return novels;
    });
};

NovelasLigerasPlugin.prototype.fetchImage = function (url) {
  return fetchApi.fetchApi(url, {
    headers: { Referer: SITE }
  }).then(function (r) { return r.arrayBuffer(); });
};

var plugin = new NovelasLigerasPlugin();
exports.default = plugin;
