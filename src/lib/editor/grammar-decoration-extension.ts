'use client'

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { DecorationSet, Decoration } from '@tiptap/pm/view'
import type { Node } from '@tiptap/pm/model'
import type { GrammarIssue } from './grammar-analyzer'

export interface GrammarClickPayload {
  issue: GrammarIssue
  screenX: number
  screenY: number
  from: number
  to: number
}

export const grammarPluginKey = new PluginKey<DecorationSet>('grammarDecoration')

/**
 * Compute the dismiss key for an issue.
 * Long-sentence text is "42-word sentence" (non-unique) — use sentenceContext instead.
 */
export function grammarDismissKey(issue: GrammarIssue): string {
  return issue.type === 'long-sentence'
    ? issue.sentenceContext.slice(0, 40)
    : issue.text
}

function buildDecorations(
  doc: Node,
  issues: GrammarIssue[],
  dismissed: Set<string>,
): DecorationSet {
  const decos: Decoration[] = []

  // ── Word / phrase issues (all types except long-sentence) ──────────────────
  const wordIssues = issues.filter(
    (i) => !dismissed.has(grammarDismissKey(i)) && i.type !== 'long-sentence',
  )

  if (wordIssues.length > 0) {
    doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return
      const text = node.text
      const textLower = text.toLowerCase()

      for (const issue of wordIssues) {
        const searchLower = issue.text.toLowerCase()
        let idx = 0
        while ((idx = textLower.indexOf(searchLower, idx)) !== -1) {
          decos.push(
            Decoration.inline(pos + idx, pos + idx + issue.text.length, {
              class: `grammar-highlight grammar-type-${issue.type} grammar-sev-${issue.severity}`,
              'data-grammar-text': issue.text,
              'data-grammar-type': issue.type,
              'data-grammar-sev': issue.severity,
            }),
          )
          idx += issue.text.length
        }
      }
    })
  }

  // ── Long-sentence issues: search by sentenceContext inside block nodes ─────
  const sentIssues = issues.filter(
    (i) => i.type === 'long-sentence' && !dismissed.has(grammarDismissKey(i)),
  )

  if (sentIssues.length > 0) {
    doc.descendants((node, pos) => {
      // Only look inside block nodes (paragraph, heading, etc.)
      if (!node.isBlock || node.type.name === 'doc') return
      const blockText = node.textContent
      if (!blockText) return

      // pos+1: skip the block's opening token to reach its text content start
      const blockStart = pos + 1

      for (const issue of sentIssues) {
        // Strip trailing ellipsis from truncated context and use first 40 chars
        const ctx = issue.sentenceContext.replace(/…$/, '').slice(0, 40)
        const idx = blockText.indexOf(ctx)
        if (idx === -1) continue

        // Extend highlight to the end of the sentence
        let sentEnd = idx + ctx.length
        for (let i = sentEnd; i < blockText.length; i++) {
          if ('.!?'.includes(blockText[i])) {
            sentEnd = i + 1
            break
          }
        }

        decos.push(
          Decoration.inline(blockStart + idx, blockStart + sentEnd, {
            class: 'grammar-highlight grammar-type-long-sentence grammar-sev-warning',
            // Store sentenceContext slice as text so click handler can match issue
            'data-grammar-text': issue.text,
            'data-grammar-type': 'long-sentence',
            'data-grammar-sev': 'warning',
            // Extra attribute lets us find the sentence on click
            'data-grammar-ctx': ctx,
          }),
        )
      }
    })
  }

  return DecorationSet.create(doc, decos)
}

export interface GrammarDecorationOptions {
  onIssueClick: (payload: GrammarClickPayload) => void
}

export const GrammarDecorationExtension = Extension.create<GrammarDecorationOptions>({
  name: 'grammarDecoration',

  addOptions() {
    return { onIssueClick: () => {} }
  },

  addStorage() {
    return {
      issues: [] as GrammarIssue[],
      dismissed: new Set<string>(),
    }
  },

  addProseMirrorPlugins() {
    const ext = this

    return [
      new Plugin<DecorationSet>({
        key: grammarPluginKey,

        state: {
          init() { return DecorationSet.empty },
          apply(tr, old) {
            const meta = tr.getMeta(grammarPluginKey) as
              | { issues: GrammarIssue[]; dismissed: Set<string> }
              | undefined
            if (meta) return buildDecorations(tr.doc, meta.issues, meta.dismissed)
            return old.map(tr.mapping, tr.doc)
          },
        },

        props: {
          decorations(state) {
            return grammarPluginKey.getState(state) ?? DecorationSet.empty
          },

          handleClick(view, _pos, event) {
            const target = event.target as HTMLElement
            const el = target.closest('[data-grammar-text]') as HTMLElement | null
            if (!el) return false

            const grammarText = el.getAttribute('data-grammar-text')
            if (!grammarText) return false

            const issues = ext.storage.issues as GrammarIssue[]
            const issue = issues.find((i) => i.text === grammarText)
            if (!issue) return false

            const rect = el.getBoundingClientRect()
            ext.options.onIssueClick({
              issue,
              screenX: rect.left + rect.width / 2,
              screenY: rect.bottom + 4,
              from: _pos,
              to: _pos + grammarText.length,
            })
            return false
          },
        },
      }),
    ]
  },
})
