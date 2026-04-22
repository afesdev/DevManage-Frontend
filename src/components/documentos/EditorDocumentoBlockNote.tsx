import { useEffect, useRef } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

export function EditorDocumentoBlockNote({
  initialMarkdown,
  onMarkdownChange,
  editable = true,
}: {
  initialMarkdown: string;
  onMarkdownChange: (md: string) => void;
  editable?: boolean;
}) {
  const editor = useCreateBlockNote();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAppliedRef = useRef<string>('');

  // Carga/re-carga contenido inicial de forma segura (API async según versión).
  useEffect(() => {
    let cancelled = false;
    const markdown = initialMarkdown ?? '';
    if (markdown === lastAppliedRef.current) return;

    const apply = async () => {
      try {
        if (!markdown.trim()) {
          if (!cancelled) {
            lastAppliedRef.current = markdown;
          }
          return;
        }
        const blocks = await editor.tryParseMarkdownToBlocks(markdown);
        if (cancelled) return;
        editor.replaceBlocks(editor.document, blocks);
        lastAppliedRef.current = markdown;
      } catch (error) {
        console.error('Error cargando markdown en BlockNote:', error);
      }
    };
    void apply();
    return () => {
      cancelled = true;
    };
  }, [editor, initialMarkdown]);

  useEffect(() => {
    const unsub = editor.onChange(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const md = editor.blocksToMarkdownLossy(editor.document);
        lastAppliedRef.current = md;
        onMarkdownChange(md);
      }, 200);
    });
    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor, onMarkdownChange]);

  return (
    <div className="min-h-[180px]">
      <BlockNoteView editor={editor} editable={editable} theme="light" />
    </div>
  );
}
