export interface GrammarIssue {
  type: 'passive-voice' | 'weak-word' | 'jargon' | 'long-sentence' | 'repeated-word' | 'grammar'
  severity: 'error' | 'warning' | 'suggestion'
  text: string           // the offending phrase
  suggestion: string     // what to do instead
  sentenceContext: string // the full sentence it appears in (truncated to 120 chars)
}

export interface GrammarReport {
  issues: GrammarIssue[]
  readabilityGrade: number   // Flesch-Kincaid grade level (1-20)
  readabilityLabel: string   // "Grade 8 — Optimal for government" etc
  passiveVoicePercent: number
  avgSentenceWords: number
  wordCount: number
  score: number  // 0-100, higher = better
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split text into sentences using punctuation boundaries. */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** Split a sentence into words (alpha tokens only). */
function words(sentence: string): string[] {
  return sentence.match(/\b[a-zA-Z']+\b/g) ?? []
}

/** Count syllables in a single word using vowel-group heuristic. */
function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  if (w.length === 0) return 0
  // Remove trailing silent e
  const stripped = w.replace(/e$/, '')
  const vowelGroups = stripped.match(/[aeiou]+/g) ?? []
  return Math.max(1, vowelGroups.length)
}

/** Truncate a string to maxLen chars, appending ellipsis if needed. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

// ---------------------------------------------------------------------------
// Passive voice
// ---------------------------------------------------------------------------

// Matches: was/were/is/are/am/been/be/being + optional adverb + past participle
// Past participle pattern: ends in -ed, -en, -ied, or common irregulars
const PASSIVE_REGEX =
  /\b(was|were|is|are|am|been|be|being)\s+(?:\w+ly\s+)?([a-z]+(?:ed|en|ied))\b/gi

const COMMON_PAST_PARTICIPLES = new Set([
  'completed', 'provided', 'required', 'performed', 'given', 'taken',
  'written', 'done', 'made', 'known', 'shown', 'seen', 'found', 'used',
  'developed', 'created', 'implemented', 'conducted', 'established',
  'identified', 'reviewed', 'approved', 'submitted', 'delivered',
  'managed', 'coordinated', 'designed', 'defined', 'assigned', 'tested',
  'validated', 'verified', 'documented', 'reported', 'maintained',
  'supported', 'selected', 'awarded', 'considered', 'determined',
  'recommended', 'required', 'expected', 'included', 'excluded',
  'addressed', 'evaluated', 'assessed', 'noted', 'achieved',
  'broken', 'chosen', 'driven', 'fallen', 'frozen', 'gotten',
  'hidden', 'risen', 'spoken', 'stolen', 'sworn', 'thrown', 'worn', 'woven',
])

function detectPassiveVoice(sentence: string): string | null {
  PASSIVE_REGEX.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PASSIVE_REGEX.exec(sentence)) !== null) {
    const participle = match[2].toLowerCase()
    // Accept if it ends in -ed/-ied OR is a known irregular participle
    if (
      participle.endsWith('ed') ||
      participle.endsWith('ied') ||
      COMMON_PAST_PARTICIPLES.has(participle)
    ) {
      return match[0]
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Weak words
// ---------------------------------------------------------------------------

const WEAK_WORDS: Record<string, string> = {
  very: 'Remove or use a stronger adjective',
  really: 'Remove or use a stronger adjective',
  quite: 'Remove or choose a more precise word',
  somewhat: 'Remove or be more specific',
  basically: 'Remove — it adds no meaning',
  generally: 'Be specific; state the actual scope',
  usually: 'Be specific; qualify with data if needed',
  often: 'Quantify with frequency data instead',
  many: 'Quantify with a specific number',
  some: 'Quantify or name the specific items',
}

const WEAK_WORD_REGEX = new RegExp(
  `\\b(${Object.keys(WEAK_WORDS).join('|')})\\b`,
  'gi'
)

// ---------------------------------------------------------------------------
// Jargon / buzzwords
// ---------------------------------------------------------------------------

const JARGON_MAP: Record<string, string> = {
  synergy: 'Describe the specific collaboration or combined effect',
  leverage: 'Use "use" or "apply" instead',
  utilize: 'Use "use" instead',
  facilitate: 'Use "help", "enable", or "support" instead',
  robust: 'Describe the specific quality or capability',
  innovative: 'Describe what makes it new or different',
  'cutting-edge': 'Describe the specific advancement',
  'world-class': 'Provide evidence or a specific differentiator',
  'best-in-class': 'Provide evidence or a specific differentiator',
  paradigm: 'Use "model", "approach", or "method" instead',
}

const JARGON_REGEX = new RegExp(
  `\\b(${Object.keys(JARGON_MAP)
    .map((k) => k.replace('-', '\\-'))
    .join('|')})\\b`,
  'gi'
)

// ---------------------------------------------------------------------------
// Long sentences
// ---------------------------------------------------------------------------

const LONG_SENTENCE_THRESHOLD = 35

// ---------------------------------------------------------------------------
// Repeated words
// ---------------------------------------------------------------------------

// Words so common they should not trigger repeated-word detection
const COMMON_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'that', 'this', 'these',
  'those', 'it', 'its', 'we', 'our', 'they', 'their', 'which', 'who',
  'not', 'no', 'as', 'if', 'so', 'than', 'then', 'also', 'all', 'each',
  'both', 'any', 'such', 'more', 'most', 'other', 'into', 'about',
])

const REPEAT_WINDOW = 50   // words within which repetition is flagged
const REPEAT_THRESHOLD = 3 // occurrences within the window

function detectRepeatedWords(text: string): { word: string; context: string }[] {
  const allWords = text.match(/\b[a-zA-Z']{4,}\b/g) ?? []
  const results: { word: string; context: string }[] = []
  const flagged = new Set<string>()

  for (let i = 0; i < allWords.length; i++) {
    const word = allWords[i].toLowerCase()
    if (COMMON_WORDS.has(word) || flagged.has(word)) continue

    // Count occurrences within the next REPEAT_WINDOW words
    const window = allWords.slice(i, i + REPEAT_WINDOW).map((w) => w.toLowerCase())
    const count = window.filter((w) => w === word).length

    if (count >= REPEAT_THRESHOLD) {
      flagged.add(word)
      // Find the sentence that contains this word for context
      const sentences = splitSentences(text)
      const ctxSentence =
        sentences.find((s) => s.toLowerCase().includes(word)) ?? text.slice(0, 120)
      results.push({ word, context: ctxSentence })
    }
  }

  return results
}

// ---------------------------------------------------------------------------
// Readability: Flesch-Kincaid Grade Level
// ---------------------------------------------------------------------------

function computeReadability(
  text: string,
  sentenceList: string[],
  totalWords: number
): { grade: number; label: string } {
  if (totalWords === 0 || sentenceList.length === 0) {
    return { grade: 0, label: 'No content' }
  }

  const totalSyllables = text
    .match(/\b[a-zA-Z']+\b/g)
    ?.reduce((sum, w) => sum + countSyllables(w), 0) ?? 0

  const avgWordsPerSentence = totalWords / sentenceList.length
  const avgSyllablesPerWord = totalSyllables / totalWords

  const grade = Math.round(
    0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59
  )

  const clamped = Math.min(20, Math.max(1, grade))

  let label: string
  if (clamped <= 6) {
    label = `Grade ${clamped} — Very easy (below government standard)`
  } else if (clamped <= 9) {
    label = `Grade ${clamped} — Easy, good for executive summaries`
  } else if (clamped <= 12) {
    label = `Grade ${clamped} — Optimal for government proposals`
  } else if (clamped <= 16) {
    label = `Grade ${clamped} — Complex; consider simplifying`
  } else {
    label = `Grade ${clamped} — Very complex; significantly simplify`
  }

  return { grade: clamped, label }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function analyzeGrammar(plainText: string): GrammarReport {
  const text = plainText.trim()

  if (text.length === 0) {
    return {
      issues: [],
      readabilityGrade: 0,
      readabilityLabel: 'No content',
      passiveVoicePercent: 0,
      avgSentenceWords: 0,
      wordCount: 0,
      score: 100,
    }
  }

  const sentences = splitSentences(text)
  const allWords = text.match(/\b[a-zA-Z']+\b/g) ?? []
  const wordCount = allWords.length
  const avgSentenceWords =
    sentences.length > 0 ? Math.round(wordCount / sentences.length) : 0

  const issues: GrammarIssue[] = []

  // --- 1. Passive voice ---
  let passiveSentenceCount = 0
  for (const sentence of sentences) {
    const match = detectPassiveVoice(sentence)
    if (match) {
      passiveSentenceCount++
      issues.push({
        type: 'passive-voice',
        severity: 'warning',
        text: match,
        suggestion: 'Rewrite in active voice: identify who performs the action and make them the subject',
        sentenceContext: truncate(sentence, 120),
      })
    }
  }

  const passiveVoicePercent =
    sentences.length > 0
      ? Math.round((passiveSentenceCount / sentences.length) * 100)
      : 0

  // --- 2. Weak words ---
  WEAK_WORD_REGEX.lastIndex = 0
  const seenWeakWords = new Set<string>()
  let weakMatch: RegExpExecArray | null
  while ((weakMatch = WEAK_WORD_REGEX.exec(text)) !== null) {
    const word = weakMatch[1].toLowerCase()
    if (seenWeakWords.has(word)) continue
    seenWeakWords.add(word)

    // Find the sentence containing this occurrence
    const pos = weakMatch.index
    const ctxSentence =
      sentences.find((s) => {
        const idx = text.indexOf(s)
        return idx <= pos && pos < idx + s.length
      }) ?? sentences[0]

    issues.push({
      type: 'weak-word',
      severity: 'suggestion',
      text: weakMatch[1],
      suggestion: WEAK_WORDS[word] ?? 'Use a more precise word',
      sentenceContext: truncate(ctxSentence ?? '', 120),
    })
  }

  // --- 3. Jargon ---
  JARGON_REGEX.lastIndex = 0
  const seenJargon = new Set<string>()
  let jargonMatch: RegExpExecArray | null
  while ((jargonMatch = JARGON_REGEX.exec(text)) !== null) {
    const word = jargonMatch[1].toLowerCase()
    if (seenJargon.has(word)) continue
    seenJargon.add(word)

    const pos = jargonMatch.index
    const ctxSentence =
      sentences.find((s) => {
        const idx = text.indexOf(s)
        return idx <= pos && pos < idx + s.length
      }) ?? sentences[0]

    issues.push({
      type: 'jargon',
      severity: 'warning',
      text: jargonMatch[1],
      suggestion: JARGON_MAP[word] ?? 'Replace with plain language',
      sentenceContext: truncate(ctxSentence ?? '', 120),
    })
  }

  // --- 4. Long sentences ---
  for (const sentence of sentences) {
    const wCount = words(sentence).length
    if (wCount > LONG_SENTENCE_THRESHOLD) {
      issues.push({
        type: 'long-sentence',
        severity: 'warning',
        text: `${wCount}-word sentence`,
        suggestion: 'Consider breaking into 2 sentences for clarity',
        sentenceContext: truncate(sentence, 120),
      })
    }
  }

  // --- 5. Repeated words ---
  const repeats = detectRepeatedWords(text)
  for (const { word, context } of repeats) {
    issues.push({
      type: 'repeated-word',
      severity: 'suggestion',
      text: word,
      suggestion: `"${word}" appears frequently — vary your word choice`,
      sentenceContext: truncate(context, 120),
    })
  }

  // --- Readability ---
  const { grade: readabilityGrade, label: readabilityLabel } = computeReadability(
    text,
    sentences,
    wordCount
  )

  // --- Score ---
  const passiveIssues = issues.filter((i) => i.type === 'passive-voice').length
  const weakIssues = issues.filter((i) => i.type === 'weak-word').length
  const jargonIssues = issues.filter((i) => i.type === 'jargon').length
  const longIssues = issues.filter((i) => i.type === 'long-sentence').length
  const repeatIssues = issues.filter((i) => i.type === 'repeated-word').length

  const penalty =
    Math.min(30, passiveIssues * 5) +
    Math.min(20, weakIssues * 3) +
    Math.min(20, jargonIssues * 5) +
    Math.min(15, longIssues * 3) +
    Math.min(10, repeatIssues * 2)

  const score = Math.max(0, 100 - penalty)

  return {
    issues,
    readabilityGrade,
    readabilityLabel,
    passiveVoicePercent,
    avgSentenceWords,
    wordCount,
    score,
  }
}
