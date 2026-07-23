import { Plugin, NovelItem, NovelDetails } from "../../src/types/plugin";

export const plugin: Plugin = {
  id: "ejemplo-novelas",
  name: "Ejemplo Novelas",
  icon: "icon.png",
  site: "https://ejemplo-novelas.com",
  version: "1.0.0",
  lang: "es",

  async popularNovels(pageNo: number): Promise<NovelItem[]> {
    const response = await fetch(`${this.site}/novelas/page/${pageNo}`);
    const html = await response.text();

    // Aquí utilizas Cheerio / Regex / DOMParser para extraer el listado de novelas
    const novels: NovelItem[] = [
      {
        name: "Novela de Prueba 1",
        path: "/novela/prueba-1",
        cover: "https://ejemplo-novelas.com/covers/1.jpg"
      },
      {
        name: "Novela de Prueba 2",
        path: "/novela/prueba-2",
        cover: "https://ejemplo-novelas.com/covers/2.jpg"
      }
    ];

    return novels;
  },

  async parseNovelAndChapters(novelPath: string): Promise<NovelDetails> {
    const response = await fetch(`${this.site}${novelPath}`);
    const html = await response.text();

    // Extraer detalles de la novela y su lista de capítulos
    return {
      name: "Novela de Prueba 1",
      path: novelPath,
      cover: "https://ejemplo-novelas.com/covers/1.jpg",
      summary: "Esta es una novela de prueba para el repositorio de IReader.",
      author: "Autor Ejemplo",
      status: "En emision",
      genres: ["Fantasía", "Aventura"],
      chapters: [
        {
          name: "Capítulo 1: El comienzo",
          path: `${novelPath}/capitulo-1`,
          chapterNumber: 1
        },
        {
          name: "Capítulo 2: El viaje",
          path: `${novelPath}/capitulo-2`,
          chapterNumber: 2
        }
      ]
    };
  },

  async parseChapter(chapterPath: string): Promise<string> {
    const response = await fetch(`${this.site}${chapterPath}`);
    const html = await response.text();

    // Extraer el texto HTML del contenido del capítulo
    const contentHtml = `
      <h1>Capítulo de Ejemplo</h1>
      <p>Había una vez en un reino muy lejano...</p>
      <p>El protagonista descubrió una poderosa habilidad.</p>
    `;

    return contentHtml;
  },

  async searchNovels(searchTerm: string, pageNo: number): Promise<NovelItem[]> {
    const url = `${this.site}/search?q=${encodeURIComponent(searchTerm)}&page=${pageNo}`;
    const response = await fetch(url);
    const html = await response.text();

    return [
      {
        name: `Resultado para: ${searchTerm}`,
        path: "/novela/resultado-busqueda",
        cover: "https://ejemplo-novelas.com/covers/search.jpg"
      }
    ];
  }
};

export default plugin;
