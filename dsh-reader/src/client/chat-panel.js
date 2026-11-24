import React from 'react'
import { buildTranscript, chatMessageCount } from './chat-transcript.js'
import { documentTitle } from './mindmap.js'
import { markdownRender } from './markdown.js'
import { sanitizeHtml } from './sanitize.js'
import { AttachmentFileCard, AttachmentImage } from './attachments.js'

/**
 * In-reader conversation panel.
 *
 * This is a module-level component on purpose: it owns the `useChat` /
 * `useInput` / `useSession` subscriptions so a streaming token re-renders the
 * panel only, never `ReaderView` (which covers the whole book).
 * See docs/superpowers/specs/2026-11-23-reader-chat-panel-design.md §3.2.
 */

const el = React.createElement

/** Wrap an optional platform hook so a missing one degrades instead of throwing. */
function safeHook(hook, fallback) {
  return (selector) => {
    if (typeof hook !== 'function') return typeof fallback === 'function' ? fallback() : fallback
    try {
      return hook(selector)
    } catch {
      return typeof fallback === 'function' ? fallback() : fallback
    }
  }
}

function renderMarkdown(text) {
  const source = String(text || '')
  if (!source.trim()) return ''
  try {
    return sanitizeHtml(markdownRender(source), () => null)
  } catch {
    return ''
  }
}

const STATUS_LABEL = {
  running: 'label.chatToolRunning',
  done: 'label.chatToolDone',
  error: 'label.chatToolError',
}

function renderBlock(block, index, t, attachments) {
  if (!block) return null
  if (block.kind === 'text') {
    return el('div', {
      key: index,
      className: 'rd-chat-md',
      dangerouslySetInnerHTML: { __html: renderMarkdown(block.text) },
    })
  }
  if (block.kind === 'reasoning') {
    return el(
      'details',
      { key: index, className: 'rd-chat-reasoning' },
      el('summary', null, t('label.chatReasoning')),
      el('div', { className: 'rd-chat-md rd-chat-muted' }, String(block.text || '')),
    )
  }
  if (block.kind === 'image') {
    return el(
      'div',
      { key: index, className: 'rd-chat-images' },
      el(AttachmentImage, { attachment: block.attachment, resolver: attachments, alt: t('label.chatImage') }),
    )
  }
  if (block.kind === 'tool-call') {
    return el(
      'div',
      { key: index, className: 'rd-chat-tool rd-chat-tool-done' },
      el('span', { className: 'rd-chat-dot', 'aria-hidden': 'true' }),
      el('span', { className: 'rd-chat-tool-name' }, block.name || t('label.chatTool')),
    )
  }
  return null
}

/** Native-chat style phrasing for the common tools, so process reads as actions. */
const TOOL_PHRASES = {
  read: 'tool.read',
  read_image: 'tool.read',
  write: 'tool.write',
  edit: 'tool.write',
  apply_patch: 'tool.write',
  bash: 'tool.command',
  pwsh: 'tool.command',
  terminal: 'tool.command',
  grep: 'tool.search',
  glob: 'tool.search',
  search: 'tool.search',
  web_search: 'tool.webSearch',
  web_fetch: 'tool.webFetch',
  todo_write: 'tool.plan',
  task: 'tool.subagents',
  subagent: 'tool.subagents',
  workflow: 'tool.subagents',
}

function toolPhrase(name, t) {
  const key = TOOL_PHRASES[String(name || '').trim()]
  return key ? t(key) : String(name || '').trim() || t('label.chatTool')
}

/** Present-continuous phrasing for the tool a running answer is using. */
const LIVE_PHRASES = {
  read: 'tool.liveRead',
  read_image: 'tool.liveRead',
  write: 'tool.liveWrite',
  edit: 'tool.liveWrite',
  apply_patch: 'tool.liveWrite',
  bash: 'tool.liveCommand',
  pwsh: 'tool.liveCommand',
  terminal: 'tool.liveCommand',
  grep: 'tool.liveSearch',
  glob: 'tool.liveSearch',
  search: 'tool.liveSearch',
  web_search: 'tool.liveWebSearch',
  web_fetch: 'tool.liveWebFetch',
  todo_write: 'tool.livePlan',
}

function livePhrase(name, t) {
  const key = LIVE_PHRASES[String(name || '').trim()]
  return t(key || 'label.chatToolRunning')
}

/** What the running answer is doing right now, shown while it has no text yet. */
function renderLiveStatus(row, t) {
  const names = Array.isArray(row.activities) ? row.activities.filter(Boolean) : []
  return el(
    'div',
    {
      className: 'rd-chat-live',
      role: 'status',
      'data-chat-live': '',
      title: names.length > 1 ? names.map((name) => livePhrase(name, t)).join('、') : undefined,
    },
    el('span', { className: 'rd-chat-live-dot', 'aria-hidden': 'true' }),
    el('span', { className: 'rd-chat-live-text' }, names.length > 0 ? livePhrase(names[0], t) : t('label.chatThinking')),
    names.length > 1 ? el('span', { className: 'rd-chat-live-extra' }, `+${names.length - 1}`) : null,
  )
}

/** First meaningful line of one reasoning text, stripped of Markdown markers. */
function reasoningSummary(text, max = 60) {
  const line = String(text || '')
    .split('\n')
    .map((value) => value.replace(/[*_`#>]/g, '').trim())
    .find(Boolean)
  if (!line) return ''
  return line.length > max ? line.slice(0, max) + '…' : line
}

/** Aggregate repeated tool names so a long loop reads as `bash × 12`, not 12 chips. */
function aggregateTools(tools) {
  const counts = new Map()
  for (const name of tools) {
    const label = String(name || '').trim() || 'tool'
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
}

/**
 * Folded process of one assistant step: counts on the summary, tool names on the
 * first level, and the reasoning one level further down. Expanding the process
 * must not dump a long chain of thought into the reading panel; the reasoning
 * opens only when the reader asks for it again.
 */
function renderProcess(process, t) {
  if (!process) return null
  const tools = aggregateTools(process.tools || [])
  const reasoning = process.reasoning || []
  return el(
    'details',
    { className: 'rd-chat-process', 'data-chat-process': '' },
    el('summary', null, `${t('label.chatProcess')} · ${process.count}`),
    tools.length > 0
      ? el(
          'div',
          { className: 'rd-chat-process-tools' },
          tools.map(({ name, count }, index) => {
            const phrase = toolPhrase(name, t)
            return el('span', { key: index, className: 'rd-chat-chip' }, count > 1 ? `${phrase} × ${count}` : phrase)
          }),
        )
      : null,
    reasoning.length > 0
      ? el(
          'details',
          { className: 'rd-chat-reasoning-sub', 'data-chat-reasoning': '' },
          el('summary', null, `${t('label.chatReasoning')} ${reasoningSummary(reasoning[0])}`),
          el('div', {
            className: 'rd-chat-md rd-chat-muted rd-chat-process-reasoning',
            dangerouslySetInnerHTML: { __html: renderMarkdown(reasoning.join('\n\n')) },
          }),
        )
      : null,
  )
}

/**
 * Split a quoted user message into its location line and the passage, so the
 * citation reads as a source chip instead of one long preformatted block.
 */
function splitUserText(text) {
  const value = String(text || '')
  const newline = value.indexOf('\n')
  const first = (newline >= 0 ? value.slice(0, newline) : value).trim()
  // Only the shape `buildQuoteText` writes becomes a source line: a book name
  // followed by a position marker. A plain question that happens to open with a
  // book title stays a normal message.
  const looksLikeSource = /^《[^》]{1,120}》/.test(first) && /第\s*\d|%|·/.test(first)
  if (!looksLikeSource) return { source: '', body: value }
  const body = newline >= 0 ? value.slice(newline + 1).trim() : ''
  return { source: first, body }
}

const GLYPHS = {
  user: () =>
    el(
      'svg',
      { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('circle', { cx: 12, cy: 8, r: 3.3 }),
      el('path', { d: 'M5.5 19.5a6.5 6.5 0 0 1 13 0' }),
    ),
  assistant: () =>
    el(
      'svg',
      { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
      el('path', { d: 'M12 3.4c3 3.5 5.2 6.2 5.2 8.8a5.2 5.2 0 0 1-10.4 0c0-2.6 2.2-5.3 5.2-8.8z' }),
      el('path', { d: 'M9.8 13.6a2.4 2.4 0 0 0 3.3 1.6' }),
    ),
}

function roleTag(role, t) {
  return el('div', { className: `rd-chat-role rd-chat-role-${role}` }, t(role === 'user' ? 'label.chatRoleUser' : 'label.chatRoleAssistant'))
}

function renderRow(row, t, motion, attachments) {
  if (row.kind === 'user') {
    const parts = splitUserText(row.text)
    return el(
      'div',
      {
        key: row.key,
        className: 'rd-chat-row rd-chat-user',
        'data-chat-row': '',
        'data-kind': 'user',
        'data-role': 'user',
        'data-motion': motion ? 'in' : undefined,
      },
      el(
        'div',
        { className: 'rd-chat-bubble rd-chat-bubble-user' },
        roleTag('user', t),
        row.images && row.images.length > 0
          ? el(
              'div',
              { className: `rd-chat-images${row.images.length > 1 ? ' multi' : ''}` },
              row.images.map((attachment, index) =>
                el(AttachmentImage, { key: `image-${index}`, attachment, resolver: attachments }),
              ),
            )
          : null,
        row.files && row.files.length > 0
          ? el(
              'div',
              { className: 'rd-chat-files' },
              row.files.map((file, index) => el(AttachmentFileCard, { key: `file-${index}`, file })),
            )
          : null,
        parts.source ? el('div', { className: 'rd-chat-source' }, parts.source) : null,
        parts.body
          ? el('div', {
              className: 'rd-chat-md',
              dangerouslySetInnerHTML: { __html: renderMarkdown(parts.body) },
            })
          : null,
      ),
    )
  }
  if (row.kind === 'assistant') {
    return el(
      'div',
      {
        key: row.key,
        className: `rd-chat-row rd-chat-assistant${row.streaming ? ' rd-chat-streaming' : ''}`,
        'data-chat-row': '',
        'data-kind': 'assistant',
        'data-role': 'assistant',
        'data-motion': motion ? 'in' : undefined,
      },
      el(
        'div',
        { className: 'rd-chat-bubble rd-chat-bubble-assistant' },
        roleTag('assistant', t),
        el(
          'div',
          { className: 'rd-chat-body' },
          row.blocks.map((block, index) => renderBlock(block, index, t, attachments)),
          row.streaming && row.blocks.length === 0 ? renderLiveStatus(row, t) : null,
          renderProcess(row.process, t),
          row.streaming && row.blocks.length > 0
            ? el('span', { className: 'rd-chat-streaming-dot', 'aria-hidden': 'true' })
            : null,
        ),
      ),
    )
  }
  if (row.kind === 'status') {
    return el(
      'div',
      { key: row.key, className: 'rd-chat-status', 'data-chat-row': '', 'data-kind': 'status' },
      el('span', { className: 'rd-chat-dot rd-chat-dot-running', 'aria-hidden': 'true' }),
      `${t('label.chatRunning')}${row.text ? ` ${row.text}` : ''}`,
    )
  }
  if (row.kind === 'tool') {
    return el(
      'div',
      {
        key: row.key,
        className: `rd-chat-tool rd-chat-tool-${row.status}`,
        'data-chat-row': '',
        'data-kind': 'tool',
        title: row.detail || undefined,
      },
      el('span', { className: 'rd-chat-dot', 'aria-hidden': 'true' }),
      el('span', { className: 'rd-chat-tool-name' }, row.name || t('label.chatTool')),
      el('span', { className: 'rd-chat-tool-status' }, t(STATUS_LABEL[row.status] || STATUS_LABEL.done)),
    )
  }
  if (row.kind === 'error') {
    return el(
      'div',
      {
        key: row.key,
        className: 'rd-chat-row rd-chat-error',
        'data-chat-row': '',
        'data-kind': 'error',
        'data-motion': motion ? 'in' : undefined,
      },
      el('span', { className: 'rd-chat-dot', 'aria-hidden': 'true' }),
      row.text || t('label.chatError'),
    )
  }
  if (row.kind === 'interrupted') {
    return el(
      'div',
      {
        key: row.key,
        className: 'rd-chat-row rd-chat-interrupted',
        'data-chat-row': '',
        'data-kind': 'interrupted',
        'data-motion': motion ? 'in' : undefined,
      },
      el(
        'div',
        { className: 'rd-chat-bubble rd-chat-bubble-assistant rd-chat-bubble-muted' },
        roleTag('assistant', t),
        el(
          'div',
          { className: 'rd-chat-body' },
          (row.blocks || []).map((block, index) => renderBlock(block, index, t, attachments)),
          el('span', { className: 'rd-chat-stopped' }, t('label.chatStopped')),
        ),
      ),
    )
  }
  return null
}

/** Follow threshold for the transcript scroller: within 40px of the bottom counts as pinned. */
export function isNearBottom(metrics, threshold = 40) {
  if (!metrics) return true
  const scrollHeight = Number(metrics.scrollHeight) || 0
  const scrollTop = Number(metrics.scrollTop) || 0
  const clientHeight = Number(metrics.clientHeight) || 0
  return scrollHeight - scrollTop - clientHeight <= threshold
}

/**
 * @param {{t?: (key: string) => string, doc?: object|null, position?: object|null,
 *          useChat?: Function, useInput?: Function, useSession?: Function,
 *          openView?: Function, onClose?: Function}} props
 */
export function ReaderChatPanel(props) {
  const safeProps = props || {}
  const t = typeof safeProps.t === 'function' ? safeProps.t : (key) => key
  const useChat = safeHook(safeProps.useChat, () => null)
  const useInput = safeHook(safeProps.useInput, () => null)
  const useSession = safeHook(safeProps.useSession, () => null)
  const chat = useChat((snapshot) => snapshot)
  const phase = useInput((snapshot) => (snapshot ? snapshot.phase : null))
  const running = useSession((snapshot) => Boolean(snapshot && snapshot.running))
  const [nearBottom, setNearBottom] = React.useState(true)
  const attachments = safeProps.attachments || null
  const scrollRef = React.useRef(null)
  const unavailable =
    typeof safeProps.useChat !== 'function' ||
    typeof safeProps.useInput !== 'function' ||
    typeof safeProps.useSession !== 'function'
  const rows = React.useMemo(
    // The panel always renders the compact transcript: tool rows and raw
    // reasoning belong to each answer's folded "process", not to the reading
    // column. The full trajectory is one click away in the native chat page.
    () => (chat ? buildTranscript(chat, { all: safeProps.showAll === true }) : []),
    [chat, safeProps.showAll],
  )
  const streamingRow = rows.some((row) => row.kind === 'assistant' && row.streaming)
  const busy = Boolean(phase && phase !== 'plain') || running

  React.useEffect(() => {
    const node = scrollRef.current
    if (!node || !nearBottom) return
    node.scrollTop = node.scrollHeight
  }, [rows, nearBottom])

  const motionRows = React.useRef({ mounted: false, seen: new Set(), marked: new Set() })
  const rowMotion = rows.map((row) => {
    const state = motionRows.current
    return state.marked.has(row.key) || (state.mounted && !state.seen.has(row.key))
  })
  React.useEffect(() => {
    const state = motionRows.current
    for (const row of rows) {
      if (state.mounted && !state.seen.has(row.key)) state.marked.add(row.key)
      state.seen.add(row.key)
    }
    state.mounted = true
  }, [rows])

  if (unavailable) {
    return el(
      'div',
      { className: 'rd-chat' },
      el(
        'div',
        { className: 'rd-chat-unavailable' },
        el('div', { className: 'rd-chat-empty-icon', 'aria-hidden': 'true' }, el(GLYPHS.assistant)),
        el('div', { className: 'rd-chat-unavailable-text' }, t('label.chatUnavailable')),
      ),
    )
  }

  const onScroll = (event) => setNearBottom(isNearBottom(event.currentTarget))
  const backToBottom = () => {
    const node = scrollRef.current
    setNearBottom(true)
    if (node) node.scrollTop = node.scrollHeight
  }
  return el(
    'div',
    { className: 'rd-chat', 'data-chat-panel': '' },
    el(
      'div',
      { className: 'rd-chat-scroll', ref: scrollRef, onScroll },
      rows.length > 0
        ? rows.map((row, index) => renderRow(row, t, rowMotion[index], attachments))
        : el(
            'div',
            { className: 'rd-chat-empty' },
            el(
              'div',
              { className: 'rd-chat-empty-icon', 'aria-hidden': 'true' },
              el(
                'svg',
                { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
                el('path', { d: 'M20 14.2a2.6 2.6 0 0 1-2.6 2.6H9.2L5 20v-3.2h-.4A2.6 2.6 0 0 1 2 14.2V6.6A2.6 2.6 0 0 1 4.6 4h12.8A2.6 2.6 0 0 1 20 6.6z' }),
                el('path', { d: 'M7.5 9.5h9M7.5 12.5h5.5' }),
              ),
            ),
            el('div', { className: 'rd-chat-empty-title' }, t('label.chatEmptyTitle')),
            el('div', { className: 'rd-chat-empty-desc' }, t('label.chatEmpty')),
            safeProps.doc && safeProps.doc.name
              ? el('div', { className: 'rd-chat-empty-book' }, `《${documentTitle(safeProps.doc.name)}》`)
              : null,
            el(
              'div',
              { className: 'rd-chat-empty-hints' },
              el('span', null, t('label.chatEmptyHintSelect')),
              el('span', null, t('label.chatEmptyHintSession')),
            ),
          ),
      busy && !streamingRow
        ? el(
            'div',
            { className: 'rd-chat-busy', role: 'status' },
            el('span', { className: 'rd-chat-busy-dot', 'aria-hidden': 'true' }),
            t('label.chatBusy'),
          )
        : null,
      !nearBottom && rows.length > 0
        ? el(
            'button',
            { className: 'rd-btn rd-chat-back-to-bottom', onClick: backToBottom },
            t('label.chatBackToBottom'),
          )
        : null,
    ),
  )
}

/**
 * Toolbar entry with the in-memory unread dot. Own component so chat snapshots
 * re-render only this button.
 */
export function ChatToolbarButton(props) {
  const safeProps = props || {}
  const t = typeof safeProps.t === 'function' ? safeProps.t : (key) => key
  const open = safeProps.open === true
  const useChat = safeHook(safeProps.useChat, () => null)
  const chat = useChat((snapshot) => snapshot)
  const count = chatMessageCount(chat)
  const [seen, setSeen] = React.useState(0)
  const initialized = React.useRef(false)

  React.useEffect(() => {
    if (open) {
      setSeen(count)
      initialized.current = true
      return
    }
    if (!initialized.current && chat) {
      setSeen(count)
      initialized.current = true
    }
  }, [open, count, chat])

  if (typeof safeProps.useChat !== 'function') return null
  const unread = !open && initialized.current && count > seen
  return el(
    'button',
    {
      className: 'rd-btn rd-chat-btn',
      'aria-pressed': open ? 'true' : 'false',
      'data-action': 'toggle-chat',
      title: t('tab.chat'),
      onClick: safeProps.onToggle,
    },
    t('tab.chat'),
    unread
      ? el('span', { className: 'rd-chat-unread', role: 'status', 'aria-label': t('label.chatUnread') })
      : null,
  )
}

/**
 * Renders nothing: watches the composer phase and reports the transition from
 * `plain` to busy once, so submitting from the native composer opens the panel.
 */
export function ChatSubmitWatcher(props) {
  const safeProps = props || {}
  const useInput = safeHook(safeProps.useInput, () => null)
  const phase = useInput((snapshot) => (snapshot ? snapshot.phase : null)) || 'plain'
  const lastRef = React.useRef(phase)
  const onSendRef = React.useRef(safeProps.onSend)
  onSendRef.current = safeProps.onSend
  React.useEffect(() => {
    const previous = lastRef.current
    lastRef.current = phase
    if (previous === 'plain' && phase !== 'plain' && typeof onSendRef.current === 'function') {
      onSendRef.current()
    }
  }, [phase])
  return null
}
