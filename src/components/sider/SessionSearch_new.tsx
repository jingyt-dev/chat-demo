import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index_new.js'
import { IconSearchOutline16 } from '../base/icons.js'
import { loadSearchSources, type SearchSource } from '../../services/chat/db_new.js'
import { revealMessage, useChatStore } from '../../services/chat/store_new.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './SessionSearch_new.module.css'

/** 一次最多展示的结果数，够用且不会让面板变成无限长列表 */
const MAX_RESULTS = 50
/** 片段里匹配前后各保留的字数 */
const SNIPPET_PADDING = 24

type Snippet = { before: string; match: string; after: string }

const toSnippet = (text: string, keyword: string): Snippet => {
  const index = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (index < 0) {
    return { before: text.slice(0, SNIPPET_PADDING * 2), match: '', after: '' }
  }
  const start = Math.max(0, index - SNIPPET_PADDING)
  const end = Math.min(text.length, index + keyword.length + SNIPPET_PADDING)
  return {
    before: `${start > 0 ? '…' : ''}${text.slice(start, index)}`,
    match: text.slice(index, index + keyword.length),
    after: `${text.slice(index + keyword.length, end)}${end < text.length ? '…' : ''}`,
  }
}

const useDebouncedValue = (value: string, delay: number) => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/**
 * 会话正文搜索：输入关键词后按消息正文匹配，结果覆盖在会话列表上方。
 * 选中结果会展开命中的分支并把消息滚动到视口中间。
 */
export const SessionSearch = () => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const [query, setQuery] = useState('')
  const [sources, setSources] = useState<SearchSource[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const keyword = useDebouncedValue(query, 150).trim()
  // 会话增删或消息更新后索引不再准确，置空后按需重建
  const signature = sessions.map((session) => `${session.id}:${session.updatedAt}`).join('|')

  useEffect(() => {
    setSources(null)
    setFailed(false)
  }, [signature])

  useEffect(() => {
    if (!keyword || sources !== null || failed) {
      return
    }
    let alive = true
    void loadSearchSources()
      .then((loaded) => {
        if (alive) {
          setSources(loaded)
        }
      })
      .catch(() => {
        if (alive) {
          setFailed(true)
        }
      })
    return () => {
      alive = false
    }
  }, [keyword, sources, failed])

  const titles = useMemo(
    () => new Map(sessions.map((session) => [session.id, session.title || t('untitledChat')])),
    [sessions, t]
  )

  const results = useMemo(() => {
    if (!keyword || !sources) {
      return []
    }
    const lower = keyword.toLowerCase()
    const matched: { source: SearchSource; snippet: Snippet }[] = []
    for (const source of sources) {
      if (!source.text.toLowerCase().includes(lower)) {
        continue
      }
      matched.push({ source, snippet: toSnippet(source.text, keyword) })
      if (matched.length >= MAX_RESULTS) {
        break
      }
    }
    return matched
  }, [keyword, sources])

  useEffect(() => {
    setActiveIndex(0)
  }, [keyword])

  const open = keyword.length > 0
  const select = (source: SearchSource) => {
    setQuery('')
    void revealMessage(source.sessionId, source.messageId)
    closeMobileSider()
  }

  const pending = sources === null && !failed
  return (
    <div className={styles.wrapper}>
      <div className={styles.field}>
        <span className={styles.icon}>
          <IconSearchOutline16 />
        </span>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          placeholder={t('searchChatsPlaceholder')}
          aria-label={t('searchChatsPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) {
              return
            }
            if (event.key === 'Escape') {
              setQuery('')
              inputRef.current?.blur()
              return
            }
            if (!open || results.length === 0) {
              return
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActiveIndex((index) => (index + 1) % results.length)
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActiveIndex((index) => (index - 1 + results.length) % results.length)
            } else if (event.key === 'Enter') {
              event.preventDefault()
              const hit = results[activeIndex]
              if (hit) {
                select(hit.source)
              }
            }
          }}
        />
      </div>
      {open ? (
        <div className={styles.panel} role="listbox" aria-label={t('searchChatsPlaceholder')}>
          {results.length === 0 ? (
            <div className={styles.empty}>
              {pending ? t('searchChatsSearching') : t('searchChatsNoResult')}
            </div>
          ) : (
            results.map(({ source, snippet }, index) => (
              <button
                key={`${source.sessionId}:${source.messageId}`}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                data-active={index === activeIndex}
                className={styles.result}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(source)}
              >
                <span className={styles.resultTitle}>{titles.get(source.sessionId) ?? ''}</span>
                <span className={styles.resultText}>
                  {snippet.before}
                  <mark>{snippet.match}</mark>
                  {snippet.after}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
