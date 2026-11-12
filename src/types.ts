export interface Source {
  id: string;
  name: string;
  homepage: string;
  color: string;
}

export interface Article {
  source: string;
  title: string;
  link: string;
  summary: string;
  published: string | null;
  image: string | null;
  category: string | null;
}

export interface NewsFeed {
  sources: Source[];
  fetchedAt: string;
  items: Article[];
}
