import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import { ComplianceGapMark } from './compliance-gap-mark'

export const editorExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
  }),
  Underline,
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  ComplianceGapMark,
]
