import type { Locator } from 'react-native-readium';

import type { Annotation } from '../../database/types';

type CreateAnnotationInput = {
  id: string;
  publicationId: string;
  kind: Annotation['kind'];
  locator: Locator;
  selectedText: string;
  noteText?: string;
  createdAt: string;
};

export function createAnnotation(input: CreateAnnotationInput): Annotation | null {
  const selectedText = input.selectedText.trim().slice(0, 4000);
  if (!selectedText) return null;

  return {
    id: input.id,
    publication_id: input.publicationId,
    kind: input.kind,
    selected_text: selectedText,
    note_text: (input.noteText ?? '').trim().slice(0, 2000),
    locator_json: JSON.stringify({
      ...input.locator,
      text: { ...input.locator.text, highlight: selectedText },
    }),
    color: input.kind === 'highlight' ? '#F3D879' : '#9CCFB5',
    created_at: input.createdAt,
  };
}
