export interface PluginItem {
  id: string;
  name: string;
  site: string;
  lang: string;
  version: string;
  url: string;
  iconUrl: string;
}

export interface NovelItem {
  name: string;
  path: string;
  cover?: string;
}

export interface ChapterItem {
  name: string;
  path: string;
  releaseTime?: string;
  chapterNumber?: number;
}

export interface NovelDetails {
  name: string;
  path: string;
  cover?: string;
  summary?: string;
  author?: string;
  artist?: string;
  status?: string;
  genres?: string[];
  chapters: ChapterItem[];
}

export interface Plugin {
  id: string;
  name: string;
  icon: string;
  site: string;
  version: string;
  lang: string;

  popularNovels(pageNo: number): Promise<NovelItem[]>;
  parseNovelAndChapters(novelPath: string): Promise<NovelDetails>;
  parseChapter(chapterPath: string): Promise<string>;
  searchNovels(searchTerm: string, pageNo: number): Promise<NovelItem[]>;
}
