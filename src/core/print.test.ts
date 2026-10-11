import { describe, expect, it, vi } from 'vitest'
import { onBeforePrint } from './print'

describe('onBeforePrint', () => {
  it('runs every registered callback on beforeprint, until it is unregistered', () => {
    const first = vi.fn()
    const second = vi.fn()
    const offFirst = onBeforePrint(first)
    const offSecond = onBeforePrint(second)

    window.dispatchEvent(new Event('beforeprint'))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    offFirst()
    window.dispatchEvent(new Event('beforeprint'))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
    offSecond()
  })

  it('lets a callback unregister itself while the print runs', () => {
    const later = vi.fn()
    const off = onBeforePrint(() => off())
    const offLater = onBeforePrint(later)
    window.dispatchEvent(new Event('beforeprint'))
    expect(later).toHaveBeenCalledTimes(1)
    offLater()
  })
})
