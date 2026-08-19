import { emitSessionIdentity, emitSessionState } from '@/utils/webViewSessionBridge'

describe('webViewSessionBridge', () => {
  let messages: string[]
  let originalRn: unknown
  const originalWindow = global.window

  beforeEach(() => {
    messages = []
    originalRn = (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView
    ;(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView = {
      postMessage: (msg: string) => {
        messages.push(msg)
      },
    }
  })

  afterEach(() => {
    if (originalRn === undefined) {
      delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView
    } else {
      ;(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView = originalRn
    }
    global.window = originalWindow
  })

  it('posts SESSION_STATE with the correct shape', () => {
    emitSessionState('authenticated')
    expect(messages).toHaveLength(1)
    const msg = JSON.parse(messages[0])
    expect(msg.type).toBe('SESSION_STATE')
    expect(msg.v).toBe(1)
    expect(msg.payload).toEqual({ state: 'authenticated' })
    expect(typeof msg.id).toBe('string')
    expect(typeof msg.ts).toBe('number')
  })

  it('posts SESSION_IDENTITY with only the user id', () => {
    emitSessionIdentity('42')
    expect(messages).toHaveLength(1)
    const msg = JSON.parse(messages[0])
    expect(msg.type).toBe('SESSION_IDENTITY')
    expect(msg.payload).toEqual({ userId: '42' })
  })

  it('emits nothing when ReactNativeWebView is absent', () => {
    delete (window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView
    emitSessionState('anonymous')
    emitSessionIdentity('42')
    expect(messages).toHaveLength(0)
  })

  it('never logs payload values', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    emitSessionState('authenticated')
    emitSessionIdentity('42')
    expect(logSpy).not.toHaveBeenCalled()
    expect(warnSpy).not.toHaveBeenCalled()
    logSpy.mockRestore()
    warnSpy.mockRestore()
  })
})