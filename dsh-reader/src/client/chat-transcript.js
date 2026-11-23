/**
 * Pure row model for the in-reader conversation panel.
 *
 * The panel never keeps a second copy of the conversation: it projects the
 * platform `ChatSnapshot` into a flat list of rows with `buildTranscript`,
 * and every helper here is side-effect free so it can be unit tested without
 * React or a DOM. See docs/superpowers/specs/2026-11-23-reader-chat-panel-design.md §3.
 */

/** Node kinds that are platform bookkeeping, never shown in the panel. */
const SKIP_KINDS = new Set([
  'context',
  'system-prompt',
  'command',
  'command-input',
  'model-retry',
  'compaction',
  'manual-compaction',
  'unknown',
  'turn-start',
  'turn-end',
  'turn-trigger',
  'turn-process',
  'turn-tail',
  'turn-abort',
  'notification',
])

/** Node kinds that render as a message row. */
const USER_KINDS = new Set(['user', 'steering', 'question-reply'])
const ASSISTANT_KINDS = new Set(['assistant-step', 'assistant'])

const DEFAULT_LIMIT_TURNS = 8
const DEFAULT_MAX_TEXT = 16000
const QUOTE_MAX_TEXT = 2000
const MAX_ROWS = 240

/**
 * How much of the assistant's working is shown.
 *
 * `compact` is the reading default: only the answer text is a row of its own,
 * while reasoning and tool calls fold into one collapsible process summary per
 * assistant step. `full` keeps every block and every tool-call node as a row,
 * for readers who want the trace.
 */
const DEFAULT_DETAIL = 'compact'
const DETAIL_FULL = 'full'

/** Quick follow-up questions offered next to the selection toolbar, in a fixed order. */
export const QUICK_ASKS = Object.freeze([
  { id: 'explain', question: '请解释这段内容' },
  { id: 'example', question: '请举个例子' },
  { id: 'relation', question: '这段和上文有什么关系' },
  { id: 'intent', question: '作者为什么这么说' },
])

function truncate(text, maxText) {
  const value = String(text || '')
  if (!(maxText > 0) || value.length <= maxText) return value
  return value.slice(0, maxText) + '…'
}

/**
 * Tolerant text extraction: the platform wraps message text in several shapes
 * (`string`, `{ text }`, `{ content: [...] }`, `{ blocks: [...] }`, `{ message }`).
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {string}
 */
function textOf(value, depth = 0) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (depth > 4) return ''
  if (Array.isArray(value)) {
    return value
      .map((item) => textOf(item, depth + 1))
      .filter(Boolean)
      .join('\n')
  }
  if (typeof value !== 'object') return ''
  if (typeof value.text === 'string') return value.text
  if (value.content != null) return textOf(value.content, depth + 1)
  if (value.blocks != null) return textOf(value.blocks, depth + 1)
  if (value.message != null) return textOf(value.message, depth + 1)
  return ''
}

/** Merge two folded process summaries from steps of the same turn. */
function mergeProcess(left, right) {
  if (!left) return right
  if (!right) return left
  return {
    tools: left.tools.concat(right.tools),
    reasoning: left.reasoning.concat(right.reasoning),
    count: left.count + right.count,
  }
}

/** Normalize one assistant block; unknown shapes fall back to their text. */
function normalizeBlock(block, maxText) {
  if (typeof block === 'string') return { kind: 'text', text: truncate(block, maxText) }
  if (!block || typeof block !== 'object') return null
  const kind = String(block.kind || block.type || '')
  if (kind === 'tool-call' || kind === 'tool') {
    return {
      kind: 'tool-call',
      name: String(block.name || block.toolName || block.tool || ''),
      callId: String(block.callId || block.id || ''),
    }
  }
  if (kind === 'image') return { kind: 'image' }
  const text = truncate(textOf(block), maxText)
  if (!text) return null
  return { kind: kind === 'reasoning' ? 'reasoning' : 'text', text }
}

/** Fold reasoning text and tool names into the compact process summary. */
function summarizeProcess(blocks) {
  const tools = []
  const reasoning = []
  for (const block of blocks) {
    if (!block) continue
    if (block.kind === 'tool-call') tools.push(block.name || '')
    else if (block.kind === 'reasoning') reasoning.push(block.text)
  }
  if (tools.length === 0 && reasoning.length === 0) return null
  return { tools, reasoning, count: tools.length + reasoning.length }
}

function normalizeBlocks(value, maxText) {
  const list = Array.isArray(value) ? value : Array.isArray(value && value.blocks) ? value.blocks : []
  return list.map((block) => normalizeBlock(block, maxText)).filter(Boolean)
}

function nodeTurn(node) {
  const located = node && node.location && node.location.turn ? node.location.turn.turn : undefined
  const value = Number.isFinite(located) ? located : node && node.data ? node.data.turn : undefined
  return Number.isFinite(value) ? Number(value) : 0
}

function toolStatus(node) {
  const data = node && node.data ? node.data : {}
  const root = data.root && typeof data.root === 'object' ? data.root : data
  if (root.isError === true || root.error != null) return 'error'
  const phase = String(root.phase || root.status || '').toLowerCase()
  if (phase === 'preparing' || phase === 'start' || phase === 'started' || phase === 'running' || phase === 'pending' || phase === 'waiting') {
    return 'running'
  }
  if (phase === 'error' || phase === 'failed' || phase === 'failure' || phase === 'rejected') return 'error'
  return 'done'
}

function toolArgs(node) {
  const data = node && node.data ? node.data : {}
  const root = data.root && typeof data.root === 'object' ? data.root : data
  return root.call && root.call.argsRaw != null ? root.call.argsRaw : root.argsRaw != null ? root.argsRaw : data.argsRaw
}

function toolCallId(node) {
  const data = node && node.data ? node.data : {}
  const root = data.root && typeof data.root === 'object' ? data.root : data
  return String((root.call && (root.call.callId || root.call.id)) || root.callId || data.callId || '')
}

function getNode(chat, key) {
  const nodes = chat && chat.nodes
  if (!nodes) return null
  if (typeof nodes.get === 'function') return nodes.get(key) || null
  if (typeof nodes === 'object') return nodes[key] || null
  return null
}

function orderedNodes(chat) {
  if (!chat) return []
  if (Array.isArray(chat.order)) {
    return chat.order.map((key) => getNode(chat, key)).filter(Boolean)
  }
  const legacy = chat.legacy && Array.isArray(chat.legacy.nodes) ? chat.legacy.nodes : []
  return legacy.filter(Boolean)
}

function rowOf(node, maxText, detail) {
  const kind = node.kind
  if (SKIP_KINDS.has(kind)) return null
  const turn = nodeTurn(node)
  const data = node.data || {}
  if (USER_KINDS.has(kind)) {
    return { kind: 'user', key: node.key, turn, text: truncate(textOf(data), maxText) }
  }
  if (ASSISTANT_KINDS.has(kind)) {
    let blocks = normalizeBlocks(data, maxText)
    // A settled step can keep its visible text only on the finalized message.
    if (!blocks.some((block) => block.kind === 'text' || block.kind === 'image') && data.finalNode) {
      const finalized = normalizeBlocks(data.finalNode, maxText)
      if (finalized.length > 0) blocks = finalized
    }
    const full = detail === DETAIL_FULL
    const visible = full ? blocks : blocks.filter((block) => block.kind === 'text' || block.kind === 'image')
    if (data.status === 'interrupted') {
      // A stopped answer keeps the prefix it had already streamed.
      return { kind: 'interrupted', key: node.key, turn, blocks: visible }
    }
    return {
      kind: 'assistant',
      key: node.key,
      turn,
      step: Number.isFinite(data.step) ? Number(data.step) : 0,
      blocks: visible,
      process: full ? null : summarizeProcess(blocks),
      streaming: data.status === 'running' || data.streaming === true,
    }
  }
  if (kind === 'tool-call') {
    // A tool call is process, not conversation: the compact reading view folds
    // it into the assistant step's summary instead of spending a row on it.
    if (detail !== DETAIL_FULL) return null
    return {
      kind: 'tool',
      key: node.key,
      turn,
      callId: toolCallId(node),
      name: String(data.name || (data.root && data.root.name) || ''),
      status: toolStatus(node),
      detail: truncate(textOf(toolArgs(node)), 200),
    }
  }
  if (kind === 'turn-error' || kind === 'turn-max-tokens') {
    return { kind: 'error', key: node.key, turn, text: truncate(textOf(data), maxText) || kind }
  }
  return null
}

function limitRows(rows, limitTurns, maxRows) {
  let out = rows
  if (maxRows > 0 && out.length > maxRows) out = out.slice(-maxRows)
  if (limitTurns > 0) {
    const turns = [...new Set(out.map((row) => row.turn).filter((turn) => turn > 0))].sort((a, b) => a - b)
    if (turns.length > limitTurns) {
      const cutoff = turns[turns.length - limitTurns]
      out = out.filter((row) => row.turn >= cutoff)
    }
  }
  return out
}

/**
 * Project a `ChatSnapshot` into panel rows.
 *
 * @param {{order?: string[], nodes?: {get: (key: string) => any}, legacy?: {nodes?: any[], partial?: any, runningCalls?: any[]}} | null | undefined} chat
 * @param {{limitTurns?: number, all?: boolean, maxText?: number, detail?: 'compact' | 'full'}} [options]
 * @returns {Array<Record<string, any>>}
 */
export function buildTranscript(chat, options = {}) {
  const all = options.all === true
  const limitTurns = Number.isFinite(options.limitTurns) ? Math.max(0, Math.floor(options.limitTurns)) : DEFAULT_LIMIT_TURNS
  const maxText = Number.isFinite(options.maxText) ? Math.max(0, Math.floor(options.maxText)) : DEFAULT_MAX_TEXT
  const detail = options.detail === DETAIL_FULL ? DETAIL_FULL : DEFAULT_DETAIL
  const rows = []
  for (const node of orderedNodes(chat)) {
    if (!node || node.visibility === 'hidden') continue
    const row = rowOf(node, maxText, detail)
    if (row) rows.push(row)
  }
  // One turn commonly produces several assistant steps (reasoning + tool calls
  // between text). The reading panel shows the turn, not the steps: merge them so
  // a long tool loop reads as one answer with one collapsed process line.
  if (detail !== DETAIL_FULL) {
    const merged = []
    for (const row of rows) {
      const previous = merged[merged.length - 1]
      if (row.kind === 'assistant' && previous && previous.kind === 'assistant' && previous.turn === row.turn) {
        previous.blocks = previous.blocks.concat(row.blocks)
        previous.process = mergeProcess(previous.process, row.process)
        previous.streaming = previous.streaming || row.streaming
        continue
      }
      merged.push(row)
    }
    // A step with no text of its own is only process; the merged turn row already
    // carries it, so a text-less assistant row would be pure noise.
    rows.length = 0
    for (const row of merged) {
      if (row.kind === 'assistant' && row.blocks.length === 0 && !row.streaming) continue
      rows.push(row)
    }
  }
  // The platform publishes one streaming answer twice: a running `assistant`
  // Node and the derived `legacy.partial`. Render whichever exists exactly once.
  const streamingSteps = new Set(
    rows.filter((row) => row.kind === 'assistant' && row.streaming).map((row) => `${row.turn}:${row.step}`),
  )
  const streamingTurns = new Set(rows.filter((row) => row.kind === 'assistant' && row.streaming).map((row) => row.turn))
  const renderedCalls = new Set(rows.filter((row) => row.kind === 'tool' && row.callId).map((row) => row.callId))
  const legacy = (chat && chat.legacy) || {}
  const partial = legacy.partial
  if (partial && typeof partial === 'object') {
    const blocks = normalizeBlocks(partial, maxText)
    const turn = Number.isFinite(partial.turn) ? Number(partial.turn) : rows.length ? rows[rows.length - 1].turn : 0
    const step = Number.isFinite(partial.step) ? Number(partial.step) : 0
    const alreadyRendered = streamingSteps.has(`${turn}:${step}`) || streamingTurns.has(turn)
    if (!alreadyRendered && (blocks.length > 0 || rows.length === 0)) {
      const full = detail === DETAIL_FULL
      rows.push({
        kind: 'assistant',
        key: `partial:${turn}:${step}`,
        turn,
        step,
        blocks: full ? blocks : blocks.filter((block) => block.kind === 'text' || block.kind === 'image'),
        process: full ? null : summarizeProcess(blocks),
        streaming: partial.status !== 'settled',
      })
    }
  }
  const calls = (Array.isArray(legacy.runningCalls) ? legacy.runningCalls : []).filter(
    (call) => call && typeof call === 'object' && !renderedCalls.has(String(call.callId || call.id || '')),
  )
  if (calls.length > 0 && detail !== DETAIL_FULL) {
    // One status line for all live work keeps the reading transcript quiet.
    const names = calls.map((call) => String(call.name || '')).filter(Boolean)
    rows.push({
      kind: 'status',
      key: 'status:running',
      turn: Number.isFinite(calls[0].turn) ? Number(calls[0].turn) : rows.length ? rows[rows.length - 1].turn : 0,
      names,
      text: names.join(' · '),
    })
  }
  for (const call of calls) {
    if (detail !== DETAIL_FULL) break
    rows.push({
      kind: 'tool',
      key: `call:${call.callId || call.id || rows.length}`,
      turn: Number.isFinite(call.turn) ? Number(call.turn) : rows.length ? rows[rows.length - 1].turn : 0,
      name: String(call.name || ''),
      status: 'running',
      detail: truncate(textOf(call.argsRaw), 200),
    })
  }
  return all ? rows : limitRows(rows, limitTurns, MAX_ROWS)
}

/**
 * Human location line for a quote: book name plus the most precise position
 * the document type offers (PDF page, EPUB/Markdown chapter and percent).
 */
export function formatLocation(doc, position) {
  const name = String((doc && (doc.name || doc.path)) || '')
  if (!name) return ''
  const head = `《${name}》`
  const pos = position || {}
  const isPdf = (doc && doc.ext === '.pdf') || /\.pdf$/i.test(name)
  if (isPdf) {
    const page = Number(pos.page)
    if (!Number.isFinite(page) || page <= 0) return head
    const total = Number(pos.total)
    if (Number.isFinite(total) && total > 0) {
      return `${head} 第 ${Math.round(page)} 页 / 共 ${Math.round(total)} 页`
    }
    return `${head} 第 ${Math.round(page)} 页`
  }
  const parts = [head]
  const chapter = Number(pos.chapter)
  const title = String(pos.chapterTitle || '').trim()
  const percent = Number(pos.percent)
  if (Number.isFinite(chapter) && chapter > 0) parts.push(`第 ${Math.round(chapter) + 1} 章`)
  if (title) parts.push(title)
  if (Number.isFinite(percent)) parts.push(`${Math.round(Math.min(100, Math.max(0, percent)))}%`)
  return `${head}${parts.length > 1 ? ' ' + parts.slice(1).join(' · ') : ''}`
}

/**
 * Quote block handed to `inputActions.insertQuote`: location first line, then
 * the selected passage with whitespace flattened and length capped.
 */
export function buildQuoteText(location, text, maxText = QUOTE_MAX_TEXT) {
  const head = String(location || '').trim()
  let body = String(text || '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .replace(/[ \t]*\n(?:[ \t]*\n)*[ \t]*/g, ' ')
  const limit = Number.isFinite(maxText) ? Math.max(0, Math.floor(maxText)) : QUOTE_MAX_TEXT
  if (limit > 0 && body.length > limit) body = body.slice(0, limit) + '…'
  if (!head) return body
  return body ? `${head}\n${body}` : head
}

/** Number of visible user/assistant messages, used for the unread dot. */
export function chatMessageCount(chat) {
  let count = 0
  for (const node of orderedNodes(chat)) {
    if (!node || node.visibility === 'hidden') continue
    if (USER_KINDS.has(node.kind) || ASSISTANT_KINDS.has(node.kind)) count += 1
  }
  return count
}
