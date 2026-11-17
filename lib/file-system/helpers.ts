import { getFileExtension, getFileName, getParentPath } from '@/lib/file-system/validation'
import type { FileNode } from '@/types/file'

/**
 * Pure tree helpers over FileNode[]. No store access, no side effects — every
 * function returns a new tree so Zustand state stays immutable.
 */

/** Build a nested tree from a flat path -> content map (what ZIP import yields). */
export function buildTree(files: Record<string, string>): FileNode[] {
  const root: FileNode[] = []

  for (const [path, content] of Object.entries(files)) {
    const segments = path.split('/').filter(Boolean)
    let level = root

    segments.forEach((segment, index) => {
      const isLeaf = index === segments.length - 1
      const currentPath = segments.slice(0, index + 1).join('/')

      let node = level.find(child => child.name === segment)

      if (!node) {
        node = isLeaf
          ? {
              path: currentPath,
              name: segment,
              content,
              type: 'file',
              extension: getFileExtension(segment),
              size: content.length,
            }
          : { path: currentPath, name: segment, type: 'folder', children: [] }
        level.push(node)
      }

      if (!isLeaf) {
        node.children ??= []
        level = node.children
      }
    })
  }

  sortTree(root)
  return root
}

export function sortTree(nodes: FileNode[]): FileNode[] {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const node of nodes) {
    if (node.children) sortTree(node.children)
  }
  return nodes
}

export function findNode(nodes: FileNode[], path: string): FileNode | undefined {
  for (const node of nodes) {
    if (node.path === path) return node
    if (node.children) {
      const found = findNode(node.children, path)
      if (found) return found
    }
  }
  return undefined
}

export function flattenTree(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = []
  const walk = (list: FileNode[]): void => {
    for (const node of list) {
      out.push(node)
      if (node.children) walk(node.children)
    }
  }
  walk(nodes)
  return out
}

/** Rebuild a flat path -> content map from the tree. */
export function treeToMap(nodes: FileNode[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const node of flattenTree(nodes)) {
    if (node.type === 'file') {
      out[node.path] = node.content ?? ''
    }
  }
  return out
}

function upsert(nodes: FileNode[], node: FileNode): FileNode[] {
  const index = nodes.findIndex(child => child.name === node.name)

  if (index === -1) {
    return sortTree([...nodes, node])
  }

  const next = [...nodes]
  next[index] = node
  return sortTree(next)
}

/** Insert a node at its own path, creating the parent chain if needed. */
export function insertNode(nodes: FileNode[], node: FileNode): FileNode[] {
  const parentPath = getParentPath(node.path)

  if (!parentPath) {
    return upsert(nodes, node)
  }

  const parent = findNode(nodes, parentPath)
  if (!parent || parent.type !== 'folder') {
    return nodes
  }

  return replaceNode(nodes, parentPath, {
    ...parent,
    children: upsert(parent.children ?? [], node),
  })
}

export function createFileNode(
  nodes: FileNode[],
  path: string,
  content = '',
  type: 'file' | 'folder' = 'file'
): FileNode[] {
  if (findNode(nodes, path)) {
    // First write wins — silently, per AGENTS.md §6.
    return nodes
  }

  const name = getFileName(path)

  const node: FileNode =
    type === 'folder'
      ? { path, name, type: 'folder', children: [] }
      : {
          path,
          name,
          content,
          type: 'file',
          extension: getFileExtension(name),
          size: content.length,
        }

  return insertNode(nodes, node)
}

export function deleteFileNode(nodes: FileNode[], path: string): FileNode[] {
  return nodes
    .filter(node => node.path !== path)
    .map(node =>
      node.children ? { ...node, children: deleteFileNode(node.children, path) } : node
    )
}

export function renameFileNode(nodes: FileNode[], oldPath: string, newPath: string): FileNode[] {
  const node = findNode(nodes, oldPath)
  if (!node) return nodes

  const renamed: FileNode = {
    ...node,
    path: newPath,
    name: getFileName(newPath),
    ...(node.type === 'file'
      ? { extension: getFileExtension(newPath), content: node.content ?? '' }
      : {}),
    ...(node.children ? { children: rebaseChildren(node.children, oldPath, newPath) } : {}),
  }

  // Remove the old path first, then insert under the new one.
  return insertNode(deleteFileNode(nodes, oldPath), renamed)
}

/** A renamed folder keeps every descendant's path in sync. */
function rebaseChildren(children: FileNode[], oldPath: string, newPath: string): FileNode[] {
  return children.map(child => {
    const rebasedPath = `${newPath}${child.path.slice(oldPath.length)}`
    return {
      ...child,
      path: rebasedPath,
      name: getFileName(rebasedPath),
      ...(child.children ? { children: rebaseChildren(child.children, oldPath, newPath) } : {}),
    }
  })
}

export function replaceNode(nodes: FileNode[], path: string, replacement: FileNode): FileNode[] {
  return nodes.map(node => {
    if (node.path === path) return replacement
    if (node.children) {
      return { ...node, children: replaceNode(node.children, path, replacement) }
    }
    return node
  })
}

export function updateFileContent(
  nodes: FileNode[],
  path: string,
  content: string
): FileNode[] {
  const node = findNode(nodes, path)
  if (!node) return nodes

  return replaceNode(nodes, path, {
    ...node,
    content,
    size: content.length,
  })
}

export function removeEmptyFolders(nodes: FileNode[]): FileNode[] {
  return nodes
    .map(node => (node.children ? { ...node, children: removeEmptyFolders(node.children) } : node))
    .filter(node => {
      if (node.type !== 'folder') return true
      return (node.children?.length ?? 0) > 0
    })
}