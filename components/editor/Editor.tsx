'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef } from 'react'
import type * as Monaco from 'monaco-editor'
import {
  EDITOR_FONT_FAMILY,
  EDITOR_FONT_SIZE,
  EDITOR_TAB_SIZE,
} from '@/lib/constants'
import { useEditorStore } from '@/stores/editorStore'
import { useFileStore } from '@/stores/fileStore'

// Monaco is heavy and browser-only — never render it on the server.
const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface EditorProps {
  path: string
  onChange: (content: string) => void
  onCursor?: (line: number, column: number) => void
}

export function Editor({ path, onChange, onCursor }: EditorProps) {
  const content = useFileStore(state => state.fileContents.get(path) ?? '')
  const cursors = useEditorStore(state => state.cursors)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const decorationsRef = useRef<Monaco.editor.IEditorDecorationsCollection | null>(null)

  // Remote cursors for THIS file become Monaco decorations.
  useEffect(() => {
    const decorations = decorationsRef.current
    const monaco = monacoRef.current
    if (!decorations || !monaco) return

    decorations.clear()

    for (const cursor of cursors.values()) {
      if (cursor.filePath !== path) continue

      const line = Math.max(1, cursor.line)
      const column = Math.max(1, cursor.column)

      decorations.set([
        {
          range: {
            startLineNumber: line,
            startColumn: column,
            endLineNumber: line,
            endColumn: column,
          },
          options: {
            className: 'remote-cursor',
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            hoverMessage: { value: cursor.userName },
            beforeContentClassName: 'remote-caret',
          },
        },
      ])
    }
  }, [cursors, path])

  return (
    <MonacoEditor
      path={path}
      language={languageFor(path)}
      value={content}
      theme="vs-dark"
      onChange={value => onChange(value ?? '')}
      onMount={(editor, monaco) => {
        editorRef.current = editor
        monacoRef.current = monaco
        decorationsRef.current = editor.createDecorationsCollection([])

        editor.onDidChangeCursorPosition(event => {
          onCursor?.(event.position.lineNumber, event.position.column)
        })
      }}
      options={{
        fontSize: EDITOR_FONT_SIZE,
        fontFamily: EDITOR_FONT_FAMILY,
        tabSize: EDITOR_TAB_SIZE,
        minimap: { enabled: true },
        lineNumbers: 'on',
        automaticLayout: true,
        renderWhitespace: 'selection',
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        suggest: { showWords: true },
        quickSuggestions: { other: false, comments: false, strings: false },
      }}
    />
  )
}

function languageFor(path: string): string {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    md: 'markdown',
    py: 'python',
  }
  return map[extension] ?? 'plaintext'
}