import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { yaml as yamlMode } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import { lineNumbers, keymap } from '@codemirror/view'
import { indentWithTab } from '@codemirror/commands'

interface UseYamlEditorOptions {
  initialValue: string
  onChange?: (value: string) => void
  readOnly?: boolean
}

export const useYamlEditor = ({ initialValue, onChange, readOnly = false }: UseYamlEditorOptions) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const state = EditorState.create({
        doc: initialValue,
        extensions: [
          basicSetup,
          yamlMode(),
          oneDark,
          lineNumbers(),
          EditorState.tabSize.of(4),
          keymap.of([indentWithTab]),
          EditorView.editable.of(!readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onChange) {
              onChange(update.state.doc.toString())
            }
          }),
        ],
      })

      viewRef.current = new EditorView({
        state,
        parent: editorRef.current,
      })
    }

    return () => {
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [])

  // Update content when initialValue changes externally
  useEffect(() => {
    if (viewRef.current && initialValue !== viewRef.current.state.doc.toString()) {
      const transaction = viewRef.current.state.update({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: initialValue,
        },
      })
      viewRef.current.dispatch(transaction)
    }
  }, [initialValue])

  return { editorRef, viewRef }
}
