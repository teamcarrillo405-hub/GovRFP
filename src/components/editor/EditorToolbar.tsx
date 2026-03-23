'use client'

import type { Editor } from '@tiptap/react'

interface Props {
  editor: Editor | null
}

function Separator() {
  return <div className="w-px h-5 bg-gray-300 mx-1" aria-hidden="true" />
}

const btnBase =
  'p-1.5 rounded text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center'
const btnActive = 'bg-gray-200 text-gray-900'

export default function EditorToolbar({ editor }: Props) {
  if (!editor) return null

  return (
    <div
      className="flex items-center gap-1 p-2 bg-gray-100 border border-b-0 border-gray-200 rounded-t-md flex-wrap"
      role="toolbar"
      aria-label="Text formatting"
    >
      {/* Headings group */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        aria-label="Heading 1"
        className={`${btnBase} ${editor.isActive('heading', { level: 1 }) ? btnActive : ''}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <text x="1" y="13" fontSize="12" fontWeight="bold" fill="currentColor">H1</text>
        </svg>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        aria-label="Heading 2"
        className={`${btnBase} ${editor.isActive('heading', { level: 2 }) ? btnActive : ''}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <text x="1" y="13" fontSize="12" fontWeight="bold" fill="currentColor">H2</text>
        </svg>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        aria-label="Heading 3"
        className={`${btnBase} ${editor.isActive('heading', { level: 3 }) ? btnActive : ''}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <text x="1" y="13" fontSize="12" fontWeight="bold" fill="currentColor">H3</text>
        </svg>
      </button>

      <Separator />

      {/* Marks group */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Bold"
        className={`${btnBase} ${editor.isActive('bold') ? btnActive : ''}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 3h4.5a2.5 2.5 0 010 5H4V3zm0 5h5a2.5 2.5 0 010 5H4V8z" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Italic"
        className={`${btnBase} ${editor.isActive('italic') ? btnActive : ''}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="10" y1="3" x2="6" y2="13" />
          <line x1="7" y1="3" x2="11" y2="3" />
          <line x1="5" y1="13" x2="9" y2="13" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Underline"
        className={`${btnBase} ${editor.isActive('underline') ? btnActive : ''}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 3v5a4 4 0 008 0V3" />
          <line x1="3" y1="14" x2="13" y2="14" />
        </svg>
      </button>

      <Separator />

      {/* Lists group */}
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Bullet list"
        className={`${btnBase} ${editor.isActive('bulletList') ? btnActive : ''}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="3" cy="4" r="1" fill="currentColor" stroke="none" />
          <line x1="6" y1="4" x2="14" y2="4" />
          <circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" />
          <line x1="6" y1="8" x2="14" y2="8" />
          <circle cx="3" cy="12" r="1" fill="currentColor" stroke="none" />
          <line x1="6" y1="12" x2="14" y2="12" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Numbered list"
        className={`${btnBase} ${editor.isActive('orderedList') ? btnActive : ''}`}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <text x="1" y="5.5" fontSize="5" fill="currentColor" stroke="none">1.</text>
          <line x1="6" y1="4" x2="14" y2="4" />
          <text x="1" y="9.5" fontSize="5" fill="currentColor" stroke="none">2.</text>
          <line x1="6" y1="8" x2="14" y2="8" />
          <text x="1" y="13.5" fontSize="5" fill="currentColor" stroke="none">3.</text>
          <line x1="6" y1="12" x2="14" y2="12" />
        </svg>
      </button>

      <Separator />

      {/* Table group */}
      <button
        type="button"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        aria-label="Insert table"
        className={btnBase}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="2" y="2" width="12" height="12" rx="1" />
          <line x1="2" y1="6" x2="14" y2="6" />
          <line x1="2" y1="10" x2="14" y2="10" />
          <line x1="6" y1="6" x2="6" y2="14" />
          <line x1="10" y1="6" x2="10" y2="14" />
        </svg>
      </button>
    </div>
  )
}
