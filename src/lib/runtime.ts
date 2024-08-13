import Bowser from 'bowser'
import { createRoot } from 'react-dom/client'

/**
 * @private
 *
 * Bowser parser instance.
 */
let parser: Bowser.Parser.Parser

/**
 * @private
 *
 * Cached result from `bowser`.
 */
let browserResult: Bowser.Parser.ParsedResult

/**
 * Throws an error if called outside of a browser context.
 */
export function assertIsBrowser(label?: string) {
  if (
    typeof window !== 'undefined' &&
    // eslint-disable-next-line unicorn/no-typeof-undefined
    typeof window.navigator !== 'undefined' &&
    typeof window.navigator.userAgent === 'string'
  ) return
  throw new Error(
    `[tsx:${label ?? 'assertIsBrowser'}] Not in a browser environment.`
  )
}

/**
 * Injects a <script> tag with the provided URL into the document and returns a
 * Promise that resolves when the script has finished loading.
 */
export async function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', err => reject(err))
    script.src = src
    document.head.append(script)
  })
}

/**
 * Renders a React app at the indicated selector using the provided element and
 * returns the root's `unmount` method.
 */
export function render(selector: string, element: JSX.Element) {
  assertIsBrowser('render')
  const container = document.querySelector(selector)
  if (!container) throw new Error(`[tsx:render] Element matching selector "${selector}" could not be found.`)
  const root = createRoot(container)
  root.render(element)
  return root.unmount.bind(root)
}

/**
 * Returns information about the user's browser, OS, and platform.
 */
export function getPlatformDetails() {
  assertIsBrowser('getBrowser')
  if (!parser) parser = Bowser.getParser(window.navigator.userAgent)
  if (!browserResult) browserResult = parser.getResult()
  return browserResult
}

/**
 * Returns `true` if the current platform is a tablet or other mobile device.
 */
export function isMobile() {
  assertIsBrowser('isMobile')
  const details = getPlatformDetails()
  if (!details.platform.type) return false
  return ['tablet', 'mobile'].includes(details.platform.type)
}

/**
 * Returns `true` if in a "standalone" context (ie: a PWA opened from the home
 * screen).
 */
export function isStandalone() {
  assertIsBrowser('isStandalone')
  return Boolean(Reflect.get(navigator, 'standalone'))
}