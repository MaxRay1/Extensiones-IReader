package ireader.spanish.novelasligeras

import ireader.core.source.model.Command
import ireader.core.source.model.FilterList
import ireader.core.source.model.MChapter
import ireader.core.source.model.MNovel
import ireader.core.source.model.Page
import ireader.core.source.ParsedHttpSource
import okhttp3.Request
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element

/**
 * Fuente Nativa de Kotlin para IReader: Novelas Ligeras (NOVA)
 * Sitio: https://novelasligeras.net/
 */
class NovelasLigeras : ParsedHttpSource() {

    override val name = "Novelas Ligeras (NOVA)"

    override val baseUrl = "https://novelasligeras.net"

    override val lang = "es"

    override val supportsLatest = true

    // 1. Explorar / Novelas Populares
    override fun popularNovelsRequest(page: Int): Request {
        return GET("$baseUrl/?s=&post_type=product&paged=$page")
    }

    override fun popularNovelsSelector(): String = "div.wf-cell"

    override fun popularNovelFromElement(element: Element): MNovel {
        val novel = MNovel.create()
        val link = element.select("h4.entry-title a").first()
        val img = element.select("img.attachment-woocommerce_thumbnail, img.iso-lazy-load, img.preload-me").first()

        novel.title = link?.attr("title")?.ifEmpty { link.text() } ?: link?.text() ?: "Sin título"
        novel.setUrlWithoutDomain(link?.attr("href") ?: "")

        var coverUrl = img?.attr("data-src")?.ifEmpty { img.attr("data-srcset") } ?: img?.attr("src") ?: ""
        if (coverUrl.contains(",")) {
            coverUrl = coverUrl.split(",")[0].trim().split(" ")[0]
        }
        novel.cover = coverUrl
        return novel
    }

    override fun popularNovelsNextPageSelector(): String = "a.next"

    override fun latestUpdatesRequest(page: Int): Request {
        return popularNovelsRequest(page)
    }

    override fun latestUpdatesSelector(): String = popularNovelsSelector()

    override fun latestUpdatesFromElement(element: Element): MNovel = popularNovelFromElement(element)

    override fun latestUpdatesNextPageSelector(): String = popularNovelsNextPageSelector()

    // 2. Detalle de Novela
    override fun novelDetailsParse(document: Document): MNovel {
        val novel = MNovel.create()
        novel.title = document.select("h1.product_title.entry-title").text().ifEmpty { 
            document.select("h1").first()?.text() ?: "Sin título" 
        }

        val img = document.select(".woocommerce-product-gallery__image img").first()
        novel.cover = img?.attr("data-src")?.ifEmpty { img.attr("data-large_image") } ?: img?.attr("src") ?: ""

        val summaryElements = document.select(".woocommerce-product-details__short-description p")
        novel.description = summaryElements
            .map { it.text() }
            .filter { it.isNotBlank() && !it.contains("Sinopsis por") }
            .joinToString("\n\n")

        novel.genres = document.select("span.posted_in a[rel='tag'], span.tagged_as a[rel='tag']").map { it.text() }

        val articleClasses = document.select("article.product").attr("class") ?: ""
        novel.status = when {
            articleClasses.contains("pa_estado-completado") || articleClasses.contains("pa_estado-finalizado") -> MNovel.COMPLETED
            else -> MNovel.ONGOING
        }

        val authorMatch = Regex("pa_escritor-([^\\s]+)").find(articleClasses)
        novel.author = authorMatch?.groupValues?.get(1)?.replace("-", " ")?.replaceFirstChar { it.uppercase() } ?: ""

        return novel
    }

    // 3. Lista de Capítulos
    override fun chapterListSelector(): String = "#tab-description a, .wpb_tour a, .woocommerce-Tabs-panel--description a"

    override fun chapterFromElement(element: Element): MChapter {
        val chapter = MChapter.create()
        chapter.setUrlWithoutDomain(element.attr("href"))
        chapter.name = element.text().trim()
        return chapter
    }

    override fun chapterListParse(document: Document): List<MChapter> {
        val chapters = mutableListOf<MChapter>()
        val elements = document.select(chapterListSelector())
        var number = 1.0f

        elements.forEach { el ->
            val href = el.attr("href")
            val name = el.text().trim()
            if (href.contains(baseUrl) && !href.contains("/producto/") && !href.contains("#") && name.isNotEmpty()) {
                val chapter = MChapter.create()
                chapter.setUrlWithoutDomain(href)
                chapter.name = name
                chapter.chapterNumber = number++
                chapters.add(chapter)
            }
        }
        return chapters
    }

    // 4. Lectura de Capítulo
    override fun pageListParse(document: Document): List<Page> = emptyList()

    override fun chapterContentParse(document: Document): String {
        val content = document.select(".entry-content .wpb-content-wrapper").first()
            ?: document.select(".entry-content").first()

        content?.select("script, style, .adsbygoogle, ins, .track-ad, .author-info, #comments, .comments-area")?.remove()

        content?.select("a")?.forEach { a ->
            val text = a.text().trim().lowercase()
            if (text == "anterior" || text == "siguiente" || text == "indice" || text == "índice") {
                a.closest(".vc_row, .vc_column_inner, div")?.remove()
            }
        }

        content?.select("img")?.forEach { img ->
            val realSrc = img.attr("data-src").ifEmpty { img.attr("src") }
            if (realSrc.isNotEmpty() && !realSrc.startsWith("data:image")) {
                img.attr("src", realSrc)
                img.removeAttr("data-src")
                img.removeAttr("data-srcset")
                img.removeAttr("srcset")
            }
        }

        return content?.html() ?: "<p>No se pudo cargar el capítulo.</p>"
    }

    // 5. Búsqueda
    override fun searchNovelsRequest(page: Int, query: String, filters: FilterList): Request {
        val url = "$baseUrl/?s=${java.net.URLEncoder.encode(query, "UTF-8")}&post_type=product&paged=$page"
        return GET(url)
    }

    override fun searchNovelsSelector(): String = popularNovelsSelector()

    override fun searchNovelFromElement(element: Element): MNovel = popularNovelFromElement(element)

    override fun searchNovelsNextPageSelector(): String = popularNovelsNextPageSelector()
}
