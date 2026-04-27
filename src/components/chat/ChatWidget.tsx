'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatWidgetProps {
  accentColor: string
  title: string
  subtitle?: string
  emptyText?: string
}

export function ChatWidget({
  accentColor,
  title,
  subtitle = 'Ask about features, pricing, or getting started',
  emptyText = 'Hi! How can I help you today?',
}: ChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const next: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let reply = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        reply += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: reply }
          return updated
        })
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-[#111111] px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">{title}</p>
              <p className="text-gray-400 text-xs">{subtitle}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-white transition-colors p-1"
              aria-label="Close chat"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80">
            {messages.length === 0 && (
              <p className="text-gray-400 text-sm text-center py-4">{emptyText}</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user' ? 'text-black' : 'bg-gray-100 text-gray-900'
                  }`}
                  style={m.role === 'user' ? { backgroundColor: accentColor } : undefined}
                >
                  {m.content || (
                    <span className="inline-flex gap-1">
                      <span className="animate-bounce">·</span>
                      <span className="animate-bounce [animation-delay:0.15s]">·</span>
                      <span className="animate-bounce [animation-delay:0.3s]">·</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-200 p-3 flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question…"
              disabled={loading}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50"
              style={{ '--tw-ring-color': accentColor } as React.CSSProperties}
            />
            <button
              onClick={send}
              disabled={!input.trim() || loading}
              className="hover:brightness-105 disabled:opacity-40 text-black px-3 py-2 rounded-lg transition-all"
              style={{ backgroundColor: accentColor }}
              aria-label="Send"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="w-14 h-14 rounded-full hover:brightness-105 shadow-lg flex items-center justify-center transition-all"
        style={{ backgroundColor: accentColor }}
        aria-label={open ? 'Close chat' : 'Open chat'}
      >
        {open ? (
          <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </div>
  )
}
