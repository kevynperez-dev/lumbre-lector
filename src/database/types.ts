export type Publication = {
  id: string;
  title: string;
  author: string;
  language: string;
  format: string;
  local_uri: string;
  cover_uri: string | null;
  source_name: string | null;
  rights_notice: string | null;
  added_at: string;
  last_opened_at: string | null;
  progress: number;
  file_size: number;
  collection_id?: string | null;
  collection_name?: string | null;
};

export type Collection = {
  id: string;
  name: string;
  created_at: string;
};

export type Bookmark = {
  id: string;
  publication_id: string;
  label: string;
  locator_json: string;
  created_at: string;
};

export type Annotation = {
  id: string;
  publication_id: string;
  kind: 'highlight' | 'note';
  selected_text: string;
  note_text: string;
  locator_json: string;
  color: string;
  created_at: string;
};
