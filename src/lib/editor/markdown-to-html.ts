/**
 * Minimal Markdown → HTML converter for inserting LLM-drafted content
 * into TipTap. Handles:
 *   - ATX headings (# / ## / ### → h2/h3/h4 — h1 is the section title)
 *   - Bold (**text**) and italic (*text*)
 *   - Unordered lists (- / *) and ordered lists (1.)
 *   - Paragraphs separated by blank lines
 *   - Hard line breaks within paragraphs
 *
 * NOT a full Markdown parser. Drafted content from Claude tailoring sticks
 * to this subset — anything richer is escaped as plain text. If we need
 * more later (tables, code, links), swap for `marked` or `markdown-it`.
 */
export function markdownToBasicHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').trim().split('\n')
  const out: string[] = []

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Blank line — flush
    if (!line.trim()) {
      i++
      continue
    }

    // Heading
    const heading = line.match(/^(#{1,4})\s+(.*)$/)
    if (heading) {
      const level = Math.min(4, Math.max(2, heading[1].length + 1))
      out.push(`<h${level}>${inline(heading[2].trim())}</h${level}>`)
      i++
      continue
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^[-*]\s+/, '').trim())}</li>`)
        i++
      }
      out.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${inline(lines[i].replace(/^\d+\.\s+/, '').trim())}</li>`)
        i++
      }
      out.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    // Paragraph — gather contiguous non-blank, non-special lines
    const paragraph: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].match(/^(#{1,4}\s|[-*]\s|\d+\.\s)/)
    ) {
      paragraph.push(lines[i])
      i++
    }
    out.push(`<p>${inline(paragraph.join(' '))}</p>`)
  }

  return out.join('')
}

function inline(text: string): string {
  // Escape first to prevent XSS from LLM output
  let out = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // Bold (**text**)
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Italic (*text*)
  out = out.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, '$1<em>$2</em>')
  return out
}
