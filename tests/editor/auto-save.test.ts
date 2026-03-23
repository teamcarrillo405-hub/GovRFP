import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * Auto-save logic tests.
 *
 * The auto-save loop is extracted as a pure utility function to avoid
 * requiring Tiptap's browser DOM in the test environment.
 */

interface AutoSaveConfig {
  intervalMs: number
  saveFn: () => Promise<void>
  isDirty: () => boolean
  isSaving: () => boolean
  isStreaming: () => boolean
}

/**
 * Creates and starts an auto-save interval.
 * Returns a cleanup function to stop it.
 */
function startAutoSave(config: AutoSaveConfig): () => void {
  const { intervalMs, saveFn, isDirty, isSaving, isStreaming } = config

  const timerId = setInterval(async () => {
    if (!isDirty() || isSaving() || isStreaming()) return
    await saveFn()
  }, intervalMs)

  return () => clearInterval(timerId)
}

describe('auto-save logic', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls save after 30 seconds when content is dirty', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)
    let dirty = true

    const stop = startAutoSave({
      intervalMs: 30_000,
      saveFn,
      isDirty: () => dirty,
      isSaving: () => false,
      isStreaming: () => false,
    })

    expect(saveFn).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(30_000)
    expect(saveFn).toHaveBeenCalledTimes(1)

    stop()
  })

  it('does not save when content is not dirty', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)

    const stop = startAutoSave({
      intervalMs: 30_000,
      saveFn,
      isDirty: () => false,
      isSaving: () => false,
      isStreaming: () => false,
    })

    await vi.advanceTimersByTimeAsync(30_000)
    expect(saveFn).not.toHaveBeenCalled()

    // Advance another interval
    await vi.advanceTimersByTimeAsync(30_000)
    expect(saveFn).not.toHaveBeenCalled()

    stop()
  })

  it('does not save when isSaving is true (skip during in-flight save)', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)

    const stop = startAutoSave({
      intervalMs: 30_000,
      saveFn,
      isDirty: () => true,
      isSaving: () => true, // already saving
      isStreaming: () => false,
    })

    await vi.advanceTimersByTimeAsync(30_000)
    expect(saveFn).not.toHaveBeenCalled()

    stop()
  })

  it('suspends save during streaming', async () => {
    const saveFn = vi.fn().mockResolvedValue(undefined)

    const stop = startAutoSave({
      intervalMs: 30_000,
      saveFn,
      isDirty: () => true,
      isSaving: () => false,
      isStreaming: () => true, // streaming active
    })

    await vi.advanceTimersByTimeAsync(30_000)
    expect(saveFn).not.toHaveBeenCalled()

    // Multiple intervals still should not call save while streaming
    await vi.advanceTimersByTimeAsync(30_000)
    expect(saveFn).not.toHaveBeenCalled()

    stop()
  })
})
