// This syntax-only implementation is adapted from micromark-extension-math (MIT).
/** @typedef {import('micromark-util-types').Extension} Extension */
/** @typedef {import('./math-text.js').Options} Options */
import { mathFlow } from './math-flow.js'
import { mathText } from './math-text.js'

/**
 * @param {Options | null} [options]
 * @returns {Extension}
 */
export function math(options) {
  return {
    flow: { [36]: mathFlow },
    text: { [36]: mathText(options) },
  }
}
