'use client'

import { forwardRef, useImperativeHandle } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/react'
import { editorExtensions } from '@/lib/editor/extensions'

export interface SectionEditorHandle {
  editor: Editor | null
}

interface Props {
  content: JSONContent | null
  onUpdate: (json: JSONContent) => void
  isStreaming: boolean
  streamBuffer: string
}

const SectionEditor = forwardRef<SectionEditorHandle, Props>(function SectionEditor(
  { content, onUpdate, isStreaming, streamBuffer },
  ref
) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: content ?? '',
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON())
    },
    immediatelyRender: false,
  })

  useImperativeHandle(ref, () => ({
    editor: editor ?? null,
  }))

  if (!editor) return null

  return (
    <div className="relative">
      <div
        className={[
          'min-h-[600px] border rounded-b-md bg-white',
          isStreaming
            ? 'border-amber-200 bg-amber-50'
            : 'border-gray-200 focus-within:ring-2 focus-within:ring-blue-500',
          '[&_.ProseMirror]:outline-none',
          '[&_.ProseMirror]:min-h-[520px]',
          '[&_.ProseMirror]:p-6',
          '[&_.ProseMirror_h1]:text-2xl [&_.ProseMirror_h1]:font-semibold [&_.ProseMirror_h1]:leading-tight',
          '[&_.ProseMirror_h2]:text-xl [&_.ProseMirror_h2]:font-semibold [&_.ProseMirror_h2]:leading-snug',
          '[&_.ProseMirror_h3]:text-base [&_.ProseMirror_h3]:font-semibold [&_.ProseMirror_h3]:leading-snug',
          '[&_.ProseMirror_p]:text-base [&_.ProseMirror_p]:leading-relaxed [&_.ProseMirror_p]:mb-4',
          '[&_.ProseMirror_table]:border-collapse [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-gray-300 [&_.ProseMirror_td]:p-2',
          '[&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-gray-300 [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-gray-50',
          '[&_.ProseMirror_ul]:list-disc [&_.ProseMirror_ul]:pl-6 [&_.ProseMirror_ul]:my-2',
          '[&_.ProseMirror_ol]:list-decimal [&_.ProseMirror_ol]:pl-6 [&_.ProseMirror_ol]:my-2',
          '[&_.ProseMirror_li]:my-1 [&_.ProseMirror_li]:leading-relaxed',
          '[&_.ProseMirror_li_p]:m-0',
        ].join(' ')}
      >
        <EditorContent editor={editor} />

        {/* Streaming overlay */}
        {isStreaming && (
          <div className="absolute inset-0 bg-white/60 flex flex-col items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              {/* Spinner SVG */}
              <svg
                className="animate-spin h-5 w-5 text-blue-700"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <span className="text-sm text-blue-700 font-semibold">Generating...</span>
            </div>
            {streamBuffer && (
              <p className="text-xs text-gray-400 max-w-sm text-center line-clamp-2">{streamBuffer.slice(-120)}</p>
            )}
          </div>
        )}
      </div>

      {/* ComplianceGap mark styles */}
      <style>{`
        .compliance-gap {
          background-color: rgb(254 243 199);
          border-radius: 2px;
          padding: 0 2px;
        }
      `}</style>
    </div>
  )
})

export default SectionEditor
