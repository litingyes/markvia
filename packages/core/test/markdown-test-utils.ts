import { parseFragment, serialize, type DefaultTreeAdapterTypes } from 'parse5'
import type { MarkdownDocument, MarkdownNode } from '../src/types'

type HTMLNode = DefaultTreeAdapterTypes.Node

function normalizeHTMLNode(node: HTMLNode): void {
  if ('attrs' in node) {
    node.attrs = node.attrs
      .filter((attribute) => attribute.name !== 'data-markvia-node-id')
      .sort((left, right) => left.name.localeCompare(right.name))
  }

  if ('childNodes' in node) {
    node.childNodes = node.childNodes.filter((child) => {
      if (child.nodeName !== 'link' || !('attrs' in child)) {
        return true
      }

      const attrs = new Map(child.attrs.map((attribute) => [attribute.name, attribute.value]))
      return !(attrs.get('rel') === 'preload' && attrs.get('as') === 'image')
    })

    for (const child of node.childNodes) {
      normalizeHTMLNode(child)
    }
  }
}

export function canonicalHtml(value: string): string {
  const fragment = parseFragment(value.replace(/<!--\[-->|<!--\]-->/g, ''))
  normalizeHTMLNode(fragment)
  return serialize(fragment)
}

export function projectNode(node: MarkdownNode): unknown {
  switch (node.type) {
    case 'text':
      return { type: node.type, value: node.value }
    case 'inlineCode':
      return { type: node.type, value: node.value }
    case 'heading':
      return { type: node.type, level: node.level, children: node.children.map(projectNode) }
    case 'paragraph':
    case 'emphasis':
    case 'strong':
    case 'delete':
    case 'blockquote':
    case 'listItem':
    case 'tableCell':
    case 'tableRow':
      return {
        type: node.type,
        ...(node.type === 'listItem' ? { checked: node.checked, spread: node.spread } : {}),
        children: node.children.map(projectNode),
      }
    case 'link':
      return {
        type: node.type,
        url: node.url,
        title: node.title,
        children: node.children.map(projectNode),
      }
    case 'image':
      return { type: node.type, url: node.url, alt: node.alt, title: node.title }
    case 'list':
      return {
        type: node.type,
        ordered: node.ordered,
        start: node.start,
        spread: node.spread,
        children: node.children.map(projectNode),
      }
    case 'code':
      return {
        type: node.type,
        language: node.language,
        meta: node.meta,
        value: node.value,
        incomplete: node.incomplete,
      }
    case 'mathInline':
      return { type: node.type, value: node.value }
    case 'mathBlock':
      return {
        type: node.type,
        meta: node.meta,
        value: node.value,
        incomplete: node.incomplete,
      }
    case 'diagram':
      return {
        type: node.type,
        language: node.language,
        meta: node.meta,
        value: node.value,
        incomplete: node.incomplete,
      }
    case 'html':
      return { type: node.type, value: node.value, block: node.block }
    case 'definition':
      return {
        type: node.type,
        identifier: node.identifier,
        label: node.label,
        url: node.url,
        title: node.title,
      }
    case 'table':
      return {
        type: node.type,
        alignments: node.alignments,
        children: node.children.map(projectNode),
      }
    case 'thematicBreak':
    case 'break':
      return { type: node.type }
  }
}

export function projectDocument(document: MarkdownDocument): unknown {
  return document.children.map(projectNode)
}

export function walkNodes(document: MarkdownDocument): MarkdownNode[] {
  const result: MarkdownNode[] = []

  const visit = (node: MarkdownNode) => {
    result.push(node)
    if ('children' in node) {
      node.children.forEach(visit)
    }
  }

  document.children.forEach(visit)
  return result
}
