'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import { editorExtensions } from '@/lib/editor/extensions'

interface Props {
  content: JSONContent | null
}

export function ReadOnlySectionContent({ content }: Props) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: content ?? '',
    editable: false,
    immediatelyRender: false,
  })

  if (!editor) return null

  return (
    <div
      className={[
        '[&_.ProseMirror]:outline-none [&_.ProseMirror]:p-0',
        '[&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:leading-tight [&_.ProseMirror_h1]:mb-3',
        '[&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:leading-snug [&_.ProseMirror_h2]:mb-2',
        '[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:mb-1',
        '[&_.ProseMirror_p]:text-base [&_.ProseMirror_p]:leading-relaxed [&_.ProseMirror_p]:mb-3',
        '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:my-2',
        '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:my-2',
        '[&_.ProseMirror_li]:my-1 [&_.ProseMirror_li]:leading-relaxed',
        '[&_.ProseMirror_li_p]:m-0',
        '[&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2',
        '[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-50',
      ].join(' ')}
    >
      <EditorContent editor={editor} />
    </div>
  )
}
