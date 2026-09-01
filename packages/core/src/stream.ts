import type {
  MarkdownDocument,
  MarkdownRuntime,
  MarkdownStream as MarkdownStreamContract,
  MarkdownNode,
  StreamChanges,
  StreamUpdate,
} from './types'

interface BlockMatch {
  oldIndex: number
  newIndex: number
}

function firstText(node: MarkdownNode): string {
  if (node.type === 'text' || node.type === 'inlineCode' || node.type === 'code') {
    return node.value
  }
  if ('children' in node) {
    return node.children.map(firstText).join(' ')
  }
  return ''
}

function signature(node: MarkdownNode): string {
  const content = firstText(node).trim().toLowerCase()
  const anchor = content.split(/\s+/)[0] ?? ''

  switch (node.type) {
    case 'heading':
      return `${node.type}:${node.level}:${anchor}`
    case 'code':
      return `${node.type}:${node.language ?? ''}`
    case 'list':
      return `${node.type}:${node.ordered ? 'ordered' : 'unordered'}`
    default:
      return `${node.type}:${anchor}`
  }
}

function sameKind(left: MarkdownNode, right: MarkdownNode): boolean {
  return left.type === right.type
}

function contentKey(node: MarkdownNode): string {
  switch (node.type) {
    case 'text':
    case 'inlineCode':
      return `${node.type}:${node.value}`
    case 'heading':
      return `${node.type}:${node.level}:${node.children.map(contentKey).join('|')}`
    case 'paragraph':
    case 'emphasis':
    case 'strong':
    case 'delete':
    case 'blockquote':
    case 'tableCell':
    case 'tableRow':
      return `${node.type}:${node.children.map(contentKey).join('|')}`
    case 'listItem':
      return `${node.type}:${node.checked ?? 'null'}:${node.spread}:${node.children.map(contentKey).join('|')}`
    case 'link':
      return `${node.type}:${node.url}:${node.title ?? ''}:${node.children.map(contentKey).join('|')}`
    case 'image':
      return `${node.type}:${node.url}:${node.alt}:${node.title ?? ''}`
    case 'list':
      return `${node.type}:${node.ordered}:${node.start ?? ''}:${node.spread}:${node.children.map(contentKey).join('|')}`
    case 'code':
      return `${node.type}:${node.language ?? ''}:${node.meta ?? ''}:${node.value}:${node.incomplete}`
    case 'thematicBreak':
    case 'break':
      return node.type
    case 'html':
      return `${node.type}:${node.value}`
    case 'definition':
      return `${node.type}:${node.identifier}:${node.url}:${node.title ?? ''}`
    case 'table':
      return `${node.type}:${node.alignments.join(',')}:${node.children.map(contentKey).join('|')}`
  }
}

function childMatches(oldChildren: MarkdownNode[], newChildren: MarkdownNode[]): BlockMatch[] {
  const matches: BlockMatch[] = []
  let oldCursor = 0

  for (let newIndex = 0; newIndex < newChildren.length; newIndex += 1) {
    const next = newChildren[newIndex]
    if (!next) {
      continue
    }

    let matchIndex = -1
    for (let oldIndex = oldCursor; oldIndex < oldChildren.length; oldIndex += 1) {
      const previous = oldChildren[oldIndex]
      if (previous && sameKind(previous, next) && signature(previous) === signature(next)) {
        matchIndex = oldIndex
        break
      }
    }

    if (matchIndex < 0) {
      const positional = oldChildren[oldCursor]
      if (positional && sameKind(positional, next) && oldChildren.length === newChildren.length) {
        matchIndex = oldCursor
      }
    }

    if (matchIndex >= 0) {
      matches.push({ oldIndex: matchIndex, newIndex })
      oldCursor = matchIndex + 1
    }
  }

  return matches
}

function reconcileNode(oldNode: MarkdownNode, newNode: MarkdownNode): MarkdownNode {
  if (!sameKind(oldNode, newNode)) {
    return newNode
  }

  if (!('children' in oldNode) || !('children' in newNode)) {
    return { ...newNode, id: oldNode.id } as MarkdownNode
  }

  const matches = childMatches(oldNode.children, newNode.children)
  const byNewIndex = new Map(matches.map((match) => [match.newIndex, match.oldIndex]))
  const children = newNode.children.map((child, index) => {
    const oldIndex = byNewIndex.get(index)
    const oldChild = oldIndex === undefined ? undefined : oldNode.children[oldIndex]
    return oldChild ? reconcileNode(oldChild, child) : child
  })

  return { ...newNode, id: oldNode.id, children } as MarkdownNode
}

function reconcileDocument(
  oldDocument: MarkdownDocument,
  newDocument: MarkdownDocument,
): MarkdownDocument {
  const matches = childMatches(oldDocument.children, newDocument.children)
  const byNewIndex = new Map(matches.map((match) => [match.newIndex, match.oldIndex]))
  const children = newDocument.children.map((child, index) => {
    const oldIndex = byNewIndex.get(index)
    const oldChild = oldIndex === undefined ? undefined : oldDocument.children[oldIndex]
    return oldChild ? reconcileNode(oldChild, child) : child
  })

  return { ...newDocument, id: oldDocument.id, children }
}

function diffBlocks(oldDocument: MarkdownDocument, newDocument: MarkdownDocument): StreamChanges {
  const oldById = new Map(oldDocument.children.map((node) => [node.id, node]))
  const newById = new Map(newDocument.children.map((node) => [node.id, node]))
  const added = newDocument.children.filter((node) => !oldById.has(node.id)).map((node) => node.id)
  const removed = oldDocument.children
    .filter((node) => !newById.has(node.id))
    .map((node) => node.id)
  const updated = newDocument.children
    .filter((node) => {
      const oldNode = oldById.get(node.id)
      return oldNode !== undefined && contentKey(oldNode) !== contentKey(node)
    })
    .map((node) => node.id)

  return { added, updated, removed }
}

export class MarkdownStream implements MarkdownStreamContract {
  private source = ''
  private version = 0
  private currentDocument: MarkdownDocument
  private isFinished = false
  private readonly listeners = new Set<(update: StreamUpdate) => void>()
  private readonly queue: StreamUpdate[] = []
  private readonly pending: Array<(result: IteratorResult<StreamUpdate>) => void> = []

  constructor(private readonly runtime: MarkdownRuntime) {
    this.currentDocument = runtime.parse('')
  }

  get document(): MarkdownDocument {
    return this.currentDocument
  }

  get finished(): boolean {
    return this.isFinished
  }

  getDocument(): MarkdownDocument {
    return this.currentDocument
  }

  write(chunk: string): void {
    if (this.isFinished) {
      throw new Error('Cannot write to a finished MarkdownStream.')
    }
    if (chunk.length === 0) {
      return
    }

    const previous = this.currentDocument
    this.source += chunk
    const parsed = this.runtime.parse(this.source)
    this.currentDocument = reconcileDocument(previous, parsed)
    this.version += 1

    const update: StreamUpdate = {
      version: this.version,
      document: this.currentDocument,
      changes: diffBlocks(previous, this.currentDocument),
    }

    for (const listener of this.listeners) {
      listener(update)
    }

    const waiter = this.pending.shift()
    if (waiter) {
      waiter({ done: false, value: update })
    } else {
      this.queue.push(update)
    }
  }

  finish(): void {
    if (this.isFinished) {
      return
    }

    this.isFinished = true
    while (this.pending.length > 0) {
      this.pending.shift()?.({ done: true, value: undefined })
    }
  }

  subscribe(listener: (update: StreamUpdate) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  [Symbol.asyncIterator](): AsyncIterator<StreamUpdate> {
    return {
      next: () => {
        const update = this.queue.shift()
        if (update) {
          return Promise.resolve({ done: false, value: update })
        }
        if (this.isFinished) {
          return Promise.resolve({ done: true, value: undefined })
        }
        return new Promise((resolve) => this.pending.push(resolve))
      },
    }
  }
}
