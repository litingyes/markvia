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

function renderNode(node: RenderNode): string {
  if (node.kind === 'text') {
    return escapeHtml(node.value)
  }

  if (!safeTag.test(node.tag)) {
    return node.children.map(renderNode).join('')
  }

  const attributes = renderAttributes(node)
  if (voidTags.has(node.tag)) {
    return `<${node.tag}${attributes}>`
  }

  return `<${node.tag}${attributes}>${node.children.map(renderNode).join('')}</${node.tag}>`
}

export function renderHTML(document: RenderDocument): string {
  return document.children.map(renderNode).join('')
}

export function createHTMLRenderer(): Renderer<string> {
  return {
    name: 'html',
    render: renderHTML,
  }
}

export const htmlRenderer = createHTMLRenderer()
