import type { RenderDocument, RenderElementNode, RenderNode, Renderer } from '@markvia/core'
import { escapeHtml } from '@markvia/core'

const voidTags = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])
const safeTag = /^[a-z][a-z0-9-]*$/
const safeAttribute = /^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/
const gfmDisallowedHtmlTag =
  /<(?=\/?(?:iframe|noembed|noframes|plaintext|script|style|textarea|title|xmp)(?:[\t\n\f\r />]|$))/gi

export interface HTMLRendererOptions {
  allowRawHtml?: boolean
}

function renderAttributes(node: RenderElementNode): string {
  return Object.entries(node.props)
    .filter(([, value]) => value !== false && value !== null)
    .filter(([name]) => safeAttribute.test(name) && !name.toLowerCase().startsWith('on'))
    .map(([name, value]) => {
      if (value === true) {
        return ` ${name}`
      }
      return ` ${name}="${escapeHtml(String(value))}"`
    })
    .join('')
}

function renderRaw(
  node: Extract<RenderNode, { kind: 'raw' }>,
  options: HTMLRendererOptions,
): string {
  if (!options.allowRawHtml) {
    return escapeHtml(node.value)
  }

  return node.value.replace(gfmDisallowedHtmlTag, '&lt;')
}

function renderNode(node: RenderNode, options: HTMLRendererOptions): string {
  if (node.kind === 'text') {
    return escapeHtml(node.value)
  }

  if (node.kind === 'raw') {
    return renderRaw(node, options)
  }

  if (!safeTag.test(node.tag)) {
    return node.children.map((child) => renderNode(child, options)).join('')
  }

  const attributes = renderAttributes(node)
  if (voidTags.has(node.tag)) {
    return `<${node.tag}${attributes}>`
  }

  return `<${node.tag}${attributes}>${node.children
    .map((child) => renderNode(child, options))
    .join('')}</${node.tag}>`
}

export function renderHTML(document: RenderDocument, options: HTMLRendererOptions = {}): string {
  return document.children.map((node) => renderNode(node, options)).join('')
}

export function createHTMLRenderer(options: HTMLRendererOptions = {}): Renderer<string> {
  return {
    name: 'html',
    render: (ir) => renderHTML(ir, options),
  }
}

export const htmlRenderer = createHTMLRenderer()
