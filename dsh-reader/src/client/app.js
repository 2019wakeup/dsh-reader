const VIEW_STATE_PREFIX = 'dsh-reader:view:'

function viewStateKey(sessionId) {
  return sessionId ? `${VIEW_STATE_PREFIX}${sessionId}` : ''
}

function readSavedViewState(sessionId) {
  const key = viewStateKey(sessionId)
  if (!key || typeof localStorage === 'undefined') return null
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null')
    return parsed && typeof parsed === 'object' && typeof parsed.path === 'string' ? parsed : null
  } catch {
    return null
  }
}

function writeSavedViewState(sessionId, value) {
  const key = viewStateKey(sessionId)
  if (!key || typeof localStorage === 'undefined') return
  try {
    if (value) localStorage.setItem(key, JSON.stringify(value))
    else localStorage.removeItem(key)
  } catch {
    /* private mode or quota; reading still works without restore */
  }
}

const COLORS = ['#f2c94c', '#6fcf97', '#56ccf2', '#bb6bd9']
const TRANSLATE_TARGETS = ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'pt']
const TRANSLATE_SOURCES = ['auto', ...TRANSLATE_TARGETS]

function markdownImageResolver(sessionId, doc) {
  if (!sessionId || !doc || !doc.path) return undefined
  return (source) => {
    if (/^(https?:|data:image\/)/i.test(source)) return source
    if (source.startsWith('/') || source.startsWith('#')) return null
    let decoded = source
    try {
      decoded = decodeURIComponent(source)
    } catch {
      /* keep the raw path */
    }
    const parts = normalizeRelPath(doc.path).split('/')
    parts.pop()
    for (const part of normalizeRelPath(decoded).split('/')) {
      if (!part || part === '.') continue
      if (part === '..') parts.pop()
      else parts.push(part)
    }
    const path = parts.filter(Boolean).join('/')
    return path ? api.fileUrl(sessionId, path) : null
  }
}

function headingsOf(text) {
  const out = []
  let inFence = false
  for (const line of String(text || '').split('\n')) {
    if (/^(```|~~~)/.test(line.trim())) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = line.match(/^(#{1,3})\s+(.*)$/)
    if (match) out.push({ level: match[1].length, label: match[2].trim() })
  }
  return out
}

function conceptFormOf(concept) {
  return {
    term: concept.term || '',
    definition: concept.definition || '',
    intuition: concept.intuition || '',
    context: concept.context || '',
    examples: (concept.examples || []).join('\n'),
    aliases: (concept.aliases || []).join(', '),
    related: (concept.related || []).join(', '),
  }
}

function positionCard(rect, estimatedHeight = 260, bounds = null) {
  const area = bounds || {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  }
  return panelPosition({ anchor: rect, height: estimatedHeight, bounds: area })
}

function IconUndo() {
  return h(
    'svg',
    { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('path', { d: 'M9 14 4 9l5-5' }),
    h('path', { d: 'M4 9h10a6 6 0 0 1 0 12h-3' }),
  )
}

function IconRedo() {
  return h(
    'svg',
    { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('path', { d: 'm15 14 5-5-5-5' }),
    h('path', { d: 'M20 9H10a6 6 0 0 0 0 12h3' }),
  )
}

function IconSearch() {
  return h(
    'svg',
    { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('circle', { cx: 11, cy: 11, r: 7 }),
    h('path', { d: 'm20 20-3.6-3.6' }),
  )
}

function IconPin() {
  return h(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('path', { d: 'M9 4h6l-1 7 4 3v2H6v-2l4-3-1-7Z' }),
    h('path', { d: 'M12 16v4' }),
  )
}

function IconSettings() {
  return h(
    'svg',
    { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('circle', { cx: 12, cy: 12, r: 3 }),
    h('path', {
      d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z',
    }),
  )
}

function IconHistory() {
  return h(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('path', { d: 'M3.5 12a8.5 8.5 0 1 0 2.8-6.3' }),
    h('path', { d: 'M3.5 4.5V9H8' }),
    h('path', { d: 'M12 8.5V12l2.6 1.6' }),
  )
}

function IconExternal() {
  return h(
    'svg',
    { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
    h('path', { d: 'M14 5h5v5' }),
    h('path', { d: 'M19 5l-7 7' }),
    h('path', { d: 'M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10' }),
  )
}

function PdfPageView(props) {
  const { doc, page, zoom, annotations, concepts, contentRef } = props
  const canvasRef = React.useRef(null)
  const layerRef = React.useRef(null)
  const pageRef = React.useRef(null)
  const [error, setError] = React.useState('')
  const conceptsRef = React.useRef(concepts)
  conceptsRef.current = concepts

  React.useEffect(() => {
    let alive = true
    let task = null
    setError('')
    ;(async () => {
      try {
        await pdfRenderPage(doc.pdf, page, canvasRef.current, layerRef.current, zoom, (t) => {
          task = t
        })
        if (alive && pageRef.current) markTerms(pageRef.current, conceptsRef.current)
      } catch (e) {
        if (alive) setError(String(e.message || e))
      }
    })()
    return () => {
      alive = false
      try {
        if (task) task.cancel()
      } catch {
        /* already settled */
      }
    }
  }, [doc, page, zoom])

  React.useEffect(() => {
    if (pageRef.current) markTerms(pageRef.current, concepts)
  }, [concepts])

  const marks = annotations.filter((annotation) => annotation.kind === 'pdf' && annotation.page === page)

  return h(
    'div',
    {
      className: 'rd-pdf-page',
      'data-page': page,
      ref: (node) => {
        pageRef.current = node
        if (contentRef) contentRef.current = node
      },
    },
    h('canvas', { ref: canvasRef }),
    h('div', { className: 'rd-text-layer', ref: layerRef }),
    marks.map((annotation) =>
      (annotation.rects || []).map((rect, index) =>
        h('div', {
          key: annotation.id + '-' + index,
          className: 'rd-pdf-hl',
          'data-anno': annotation.id,
          style: {
            left: rect.x * 100 + '%',
            top: rect.y * 100 + '%',
            width: rect.w * 100 + '%',
            height: rect.h * 100 + '%',
            '--hl': annotation.color,
          },
        }),
      ),
    ),
    error ? h('div', { className: 'rd-error' }, error) : null,
  )
}

function PdfPane(props) {
  const { doc, page, zoom, annotations, concepts, contentRef, spread } = props
  const pages = spread ? [page, page + 1].filter((number) => number <= doc.pdf.numPages) : [page]

  React.useEffect(() => {
    pdfPrefetch(doc.pdf, [page - 1, page + 1, page + 2, page + 3]).catch(() => {})
  }, [doc, page])
  return h(
    'div',
    { className: 'rd-main' },
    h(
      'div',
      { className: 'rd-pdf' + (pages.length > 1 ? ' rd-pdf-spread' : '') },
      pages.map((number, index) =>
        h(PdfPageView, {
          key: number,
          doc,
          page: number,
          zoom,
          annotations,
          concepts,
          contentRef: index === 0 ? contentRef : null,
        }),
      ),
    ),
  )
}

const READER_VERSION = '__READER_VERSION__'

class ReaderBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return h(
        'div',
        { className: 'rd-root' },
        h(
          'div',
          { className: 'rd-empty' },
          t('label.readerError'),
          h(
            'div',
            { style: { marginTop: '6px', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' } },
            String(this.state.error?.message || this.state.error),
          ),
          h(
            'button',
            {
              className: 'rd-btn',
              style: { marginTop: '10px' },
              onClick: () => {
                const text = diagnosticsText({
                  version: READER_VERSION,
                  message: this.state.error?.message,
                  stack: this.state.error?.stack,
                })
                if (navigator.clipboard) navigator.clipboard.writeText(text)
              },
            },
            t('action.copyDiagnostics'),
          ),
        ),
      )
    }
    return this.props.children
  }
}

function ReaderRoot(props) {
  return h(ReaderBoundary, null, h(ReaderView, props))
}

export function ReaderView(props) {
  const sessionId = props.sessionId || null
  const [entries, setEntries] = React.useState([])
  const [dir, setDir] = React.useState('.')
  const [doc, setDoc] = React.useState(null)
  const restoredViewRef = React.useRef(false)
  const pendingScrollRef = React.useRef(null)
  const latestViewRef = React.useRef({})
  const latestScrollRef = React.useRef(0)
  const [store, setStore] = React.useState({ version: 1, concepts: {}, annotations: {}, positions: {} })
  const [chapter, setChapter] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [zoom, setZoom] = React.useState(1.2)
  const [fontSize, setFontSize] = React.useState(18)
  const [drawer, setDrawer] = React.useState(null)
  const [menu, setMenu] = React.useState(null)
  const [menuError, setMenuError] = React.useState('')
  const [childMenu, setChildMenu] = React.useState(null)
  const [cards, setCards] = React.useState([])
  const [cardOffsets, setCardOffsets] = React.useState({})
  const [cardSizes, setCardSizes] = React.useState({})
  const cardDragRef = React.useRef(null)
  const [noteDraft, setNoteDraft] = React.useState(null)
  const [editing, setEditing] = React.useState(null)
  const [toast, setToast] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState('')
  const [query, setQuery] = React.useState('')
  const [lostMarks, setLostMarks] = React.useState([])
  const [scrollTarget, setScrollTarget] = React.useState(null)
  const [occurrencesOpen, setOccurrencesOpen] = React.useState(null)
  const [deleteConceptId, setDeleteConceptId] = React.useState(null)
  const [conceptEdit, setConceptEdit] = React.useState(null)
  const [focusConcept, setFocusConcept] = React.useState(null)
  const [showHelp, setShowHelp] = React.useState(false)
  const [pendingAnchor, setPendingAnchor] = React.useState(null)
  const [relink, setRelink] = React.useState(null)
  const [mergeTarget, setMergeTarget] = React.useState('')
  const [conceptSort, setConceptSort] = React.useState('recent')
  const [conceptScope, setConceptScope] = React.useState(null)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [searchResults, setSearchResults] = React.useState([])
  const [searchBusy, setSearchBusy] = React.useState(false)
  const [searchDone, setSearchDone] = React.useState(false)
  const [modelCatalog, setModelCatalog] = React.useState(null)
  const [modelBusy, setModelBusy] = React.useState(false)
  const [guideBusy, setGuideBusy] = React.useState(false)
  const [guideError, setGuideError] = React.useState('')
  const [guideProgress, setGuideProgress] = React.useState(null)
  const [guideView, setGuideView] = React.useState('list')
  const [collapsedIds, setCollapsedIds] = React.useState(() => new Set())
  const [mapScale, setMapScale] = React.useState(1)
  const [selectedNodeId, setSelectedNodeId] = React.useState(null)
  const [mapFullscreen, setMapFullscreen] = React.useState(false)
  const [chatShowAll, setChatShowAll] = React.useState(false)
  const [mapPan, setMapPan] = React.useState({ x: 0, y: 0 })
  const mapScrollRef = React.useRef(null)
  const mapCanvasRef = React.useRef(null)
  const mapPanRef = React.useRef({ x: 0, y: 0 })
  const mapDragRef = React.useRef(null)
  const suppressMapClick = React.useRef(false)
  const cardSlotRef = React.useRef(0)
  const mapMotionRef = React.useRef({
    key: null, seen: new Set(), entered: new Set(), enteredEdges: new Set(),
    nodeDelays: new Map(), edgeDelays: new Map(), faded: false, enterAt: 0, fading: new Set(),
  })
  const [askText, setAskText] = React.useState('')
  const [askBusy, setAskBusy] = React.useState(false)
  const [askWeb, setAskWeb] = React.useState(false)
  const [upgradingId, setUpgradingId] = React.useState(null)
  const [translationMode, setTranslationMode] = React.useState('off')
  const [translationCache, setTranslationCache] = React.useState({})
  const [translationBusy, setTranslationBusy] = React.useState(false)
  const [pdfBlocks, setPdfBlocks] = React.useState([])
  const [pdfTranslating, setPdfTranslating] = React.useState(false)
  const [selectionTranslation, setSelectionTranslation] = React.useState(null)
  const card = topCard(cards)
  const prefs = store.prefs || {}
  const motionOn = motionEnabled(prefs)

  const contentRef = React.useRef(null)
  const rootRef = React.useRef(null)
  const pageInputRef = React.useRef(null)
  const chapterScrollHint = React.useRef(null)
  const drawerBodyRef = React.useRef(null)
  const drawerResizeRef = React.useRef(null)
  const [drawerDraft, setDrawerDraft] = React.useState(null)
  const drawerScroll = React.useRef({})
  const lastDrawer = React.useRef(null)
  const [layoutTick, setLayoutTick] = React.useState(0)
  const [readingProgress, setReadingProgress] = React.useState(0)
  const [historyTick, setHistoryTick] = React.useState(0)
  const marksState = React.useRef({ root: null, view: '', concepts: '', annotations: '' })
  const hoverTimer = React.useRef(null)
  const hideTimer = React.useRef(null)
  const toastTimer = React.useRef(null)
  const svgRef = React.useRef(null)
  const importInputRef = React.useRef(null)
  const guideAbortRef = React.useRef(null)
  const historyRef = React.useRef(null)
  const reporterRef = React.useRef(null)

  const pulseOptions = () => ({ enabled: motionOn, root: rootRef.current })

  // Durable message images are resolved through the client Session object
  // layer the platform passes into the view (native conversation does the same).
  const attachmentResolver = React.useMemo(
    () => (props.sessions && sessionId ? createAttachmentResolver(props.sessions, sessionId) : null),
    [props.sessions, sessionId],
  )
  React.useEffect(() => () => {
    if (attachmentResolver) attachmentResolver.dispose()
  }, [attachmentResolver])

  const docKey = doc ? doc.fingerprint || doc.path : null
  const concepts = React.useMemo(() => Object.values(store.concepts || {}), [store.concepts])
  const sentLog = (store.debug && Array.isArray(store.debug.lastSent) ? store.debug.lastSent : []).slice(-10).reverse()
  const rawGuide = docKey ? store.docs?.[docKey]?.guide : null
  // Store merges clone the guide object on every position/annotation write.
  // Rebuild only when its actual content changes, otherwise selecting a node
  // (which may save a page position) would reset the detail card a moment later.
  const guideSignature = React.useMemo(() => (rawGuide ? JSON.stringify(rawGuide) : ''), [rawGuide])
  // Sanitized once per content change: summaries occasionally carry a raw
  // JSON envelope from the model, and every view (map/detail/list/export)
  // should show clean prose.
  const guide = React.useMemo(() => (rawGuide ? sanitizeGuide(rawGuide) : null), [guideSignature])
  const guideTree = React.useMemo(
    () => (guide ? buildGuideTree(doc ? documentTitle(doc.name) : '', guide) : null),
    // Only a new guide (or opening another book) may rebuild the map; page,
    // selection and structure-probe updates must not reset its expansion.
    [guideSignature, doc ? doc.name : ''],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  )
  const guideLayout = React.useMemo(
    () => (guideTree ? layoutTree(guideTree, collapsedIds) : null),
    [guideTree, collapsedIds],
  )

  React.useEffect(() => {
    if (!guideTree) {
      setCollapsedIds(new Set())
      setSelectedNodeId(null)
      return
    }
    // The map opens as a chapter outline; expanding a chapter is explicit.
    setCollapsedIds(new Set((guideTree.children || []).filter((node) => (node.children || []).length > 0).map((node) => node.id)))
    setSelectedNodeId(null)
  }, [guideTree])

  React.useEffect(() => {
    if (drawer !== 'guide' || guideView !== 'map' || !guideLayout) return
    const state = mapMotionRef.current
    if (state.key !== guideSignature) {
      Object.assign(state, {
        key: guideSignature, seen: new Set(), entered: new Set(), enteredEdges: new Set(),
        nodeDelays: new Map(), edgeDelays: new Map(), faded: true, enterAt: Date.now(), fading: new Set(),
      })
      guideLayout.nodes.forEach((node, index) => { state.entered.add(node.id); state.nodeDelays.set(node.id, index) })
      guideLayout.edges.forEach((edge, index) => {
        const key = `${edge.from}-${edge.to}`
        state.enteredEdges.add(key)
        state.edgeDelays.set(key, index)
      })
    }
    const fresh = []
    for (const node of guideLayout.nodes) {
      if (!state.seen.has(node.id)) fresh.push(node.id)
      state.seen.add(node.id)
    }
    // Keep the fade class across the re-render that recentring triggers, then
    // let it go so a later remount starts clean.
    if (fresh.length > 0) {
      for (const id of fresh) state.fading.add(id)
      setTimeout(() => { for (const id of fresh) state.fading.delete(id) }, 400)
    }
  }, [drawer, guideView, guideLayout, guideSignature])

  React.useEffect(() => {
    if (drawer !== 'guide' || guideView !== 'map') setMapFullscreen(false)
  }, [drawer, guideView])

  React.useEffect(() => {
    if (!mapFullscreen) return
    const onEscape = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setMapFullscreen(false)
    }
    window.addEventListener('keydown', onEscape, true)
    return () => window.removeEventListener('keydown', onEscape, true)
  }, [mapFullscreen])

  React.useEffect(() => {
    if (guideView !== 'map') return
    setMapScale(1)
    setSelectedNodeId(null)
    // The list and the map share the drawer body; entering the map starts at
    // the top instead of inheriting the list's scroll offset.
    const body = drawerBodyRef.current
    if (body) {
      body.scrollTop = 0
      drawerScroll.current['guide:map'] = 0
    }
  }, [guideView])

  React.useEffect(() => {
    if (guideView !== 'map' || !guideLayout) return
    const node = mapScrollRef.current
    if (!node) return
    const available = Math.max(240, node.clientWidth - 16)
    const fit = Math.min(1, Math.max(0.55, available / (guideLayout.width + 60)))
    setMapScale((current) => (Math.abs(current - 1) < 0.001 ? Number(fit.toFixed(2)) : current))
  }, [guideView, guideLayout])

  React.useEffect(() => {
    // The stage moves between the drawer and the root when fullscreen toggles,
    // so the fitted scale must be recomputed for the new viewport.
    if (guideView !== 'map' || !guideLayout) return
    const node = mapScrollRef.current
    if (!node) return
    const available = Math.max(240, node.clientWidth - 16)
    setMapScale(Number(Math.min(1, Math.max(0.55, available / (guideLayout.width + 60))).toFixed(2)))
  }, [mapFullscreen])

  // The map is a canvas rather than a scroll box: panning moves the drawing
  // itself, so a map that happens to fit in the viewport can still be dragged.
  const mapGeometry = () => {
    const node = mapScrollRef.current
    if (!node || !guideLayout) return null
    return {
      viewportWidth: node.clientWidth,
      viewportHeight: node.clientHeight,
      canvasWidth: Math.round((guideLayout.width + 60) * mapScale),
      canvasHeight: Math.round((guideLayout.height + 60) * mapScale),
    }
  }
  const clampMapPan = (pan, geometry = mapGeometry()) => {
    if (!geometry) return pan
    const edge = 72
    const minX = edge - geometry.canvasWidth
    const maxX = geometry.viewportWidth - edge
    const minY = edge - geometry.canvasHeight
    const maxY = geometry.viewportHeight - edge
    return {
      x: Math.round(maxX >= minX ? Math.min(maxX, Math.max(minX, pan.x)) : (geometry.viewportWidth - geometry.canvasWidth) / 2),
      y: Math.round(maxY >= minY ? Math.min(maxY, Math.max(minY, pan.y)) : (geometry.viewportHeight - geometry.canvasHeight) / 2),
    }
  }
  const centerMapPan = () => {
    const geometry = mapGeometry()
    if (!geometry) return
    const next = clampMapPan({
      x: (geometry.viewportWidth - geometry.canvasWidth) / 2,
      y: (geometry.viewportHeight - geometry.canvasHeight) / 2,
    }, geometry)
    mapPanRef.current = next
    setMapPan(next)
  }

  React.useEffect(() => {
    if (drawer !== 'guide' || guideView !== 'map' || !guideLayout) return
    let frame = requestAnimationFrame(centerMapPan)
    const node = mapScrollRef.current
    if (!node || typeof ResizeObserver !== 'function') return () => cancelAnimationFrame(frame)
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(centerMapPan)
    })
    observer.observe(node)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawer, guideView, guideLayout, mapScale, mapFullscreen])
  const docAnnotations = React.useMemo(
    () => (docKey ? store.docs?.[docKey]?.annotations || [] : []),
    [store.docs, docKey],
  )

  const reportError = (error) => flash(t('label.error') + ': ' + errorText(error?.message || error))

  const flash = (message, action) => {
    setToast({ message: String(message), action: action || null })
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  const mergeStore = (next) => {
    if (!next) return
    setStore((current) => (Number(next.revision || 0) >= Number(current.revision || 0) ? next : current))
  }

  const applyMutation = async (op) => {
    const result = await api.mutate(sessionId, op)
    if (result && result.store) mergeStore(result.store)
    return result
  }

  React.useEffect(() => {
    if (Number.isFinite(store.prefs?.fontSize)) setFontSize(store.prefs.fontSize)
  }, [store.prefs?.fontSize])

  React.useEffect(() => {
    // A pending row confirmation belongs to the open drawer; closing it or
    // switching tabs must not leave a confirmation behind.
    setDeleteConceptId(null)
  }, [drawer])

  React.useEffect(() => {
    restoredViewRef.current = false
    pendingScrollRef.current = null
    setDoc(null)
    setEntries([])
    setDrawer(null)
    setCards([])
    setMenu(null)
    setEditing(null)
    setConceptEdit(null)
    setError('')
  }, [sessionId])

  React.useEffect(() => {
    if (!sessionId) return
    api
      .getStore(sessionId)
      .then((result) => setStore(result.store))
      .catch(() => {})
    api
      .list(sessionId, '.')
      .then((result) => setEntries(result.entries))
      .catch((e) => setError(String(e.message || e)))
  }, [sessionId])

  React.useEffect(
    () => () => {
      clearTimeout(hoverTimer.current)
      clearTimeout(hideTimer.current)
      clearTimeout(toastTimer.current)
    },
    [],
  )

  React.useEffect(() => {
    if (!childMenu) return
    const timer = setTimeout(() => setChildMenu(null), 4000)
    const onDown = (event) => {
      if (event.target && event.target.closest && event.target.closest('.rd-mini')) return
      setChildMenu(null)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [childMenu])

  const cardSignature = cards.map((entry) => entry.id).join('|')
  React.useEffect(() => {
    setChildMenu(null)
    setCardOffsets((current) => {
      const ids = new Set(cards.map((entry) => entry.id))
      const next = {}
      let changed = false
      for (const [id, offset] of Object.entries(current)) {
        if (ids.has(id)) next[id] = offset
        else changed = true
      }
      return changed ? next : current
    })
  }, [cardSignature])

  React.useEffect(() => {
    if (cards.length === 0) return
    const measure = () => {
      const nodes = [...document.querySelectorAll('.rd-card')]
      const next = {}
      cards.forEach((entry, index) => {
        // offsetWidth/Height exclude the entrance transform; getBoundingClientRect
        // would report a ~4% smaller card while the 0.96 scale is still running.
        const node = nodes[index]
        if (node && node.offsetWidth > 0) next[entry.id] = { width: node.offsetWidth, height: node.offsetHeight }
      })
      setCardSizes(next)
    }
    measure()
    if (typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(measure)
    for (const node of document.querySelectorAll('.rd-card')) observer.observe(node)
    return () => observer.disconnect()
  }, [cardSignature, cards.length])

  React.useEffect(() => {
    const end = () => {
      cardDragRef.current = null
    }
    window.addEventListener('pointerup', end, true)
    window.addEventListener('pointercancel', end, true)
    return () => {
      window.removeEventListener('pointerup', end, true)
      window.removeEventListener('pointercancel', end, true)
    }
  }, [])

  React.useEffect(() => {
    const root = contentRef.current
    if (!root || !doc || doc.ext === '.pdf') return
    if (translationMode === 'only') {
      setLostMarks([])
      marksState.current = { root, view: '', concepts: '', annotations: '' }
      return
    }
    const view = `${doc.path}:${doc.fingerprint || ''}:${chapter}`
    const conceptSig = conceptSignature(concepts)
    const annotationSig = annotationSignature(docAnnotations, chapter)
    const previous = marksState.current
    const force = previous.root !== root || previous.view !== view
    if (force || previous.annotations !== annotationSig) {
      setLostMarks(applyHighlights(root, docAnnotations, chapter))
    }
    if (force || previous.concepts !== conceptSig) {
      markTerms(root, concepts)
    }
    marksState.current = { root, view, concepts: conceptSig, annotations: annotationSig }
  }, [doc, chapter, docAnnotations, concepts, translationMode])

  React.useEffect(() => {
    if (!doc) return
    const timer = setTimeout(() => {
      if (!docKey) return
      const previous = store.docs?.[docKey]?.positions
      if (previous && previous.chapter === chapter && previous.page === page) return
      applyMutation({ op: 'position/set', docKey, position: { chapter, page } }).catch(() => {})
    }, 600)
    return () => clearTimeout(timer)
  }, [doc, chapter, page])

  React.useEffect(() => {
    const onResize = () => setLayoutTick((tick) => tick + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Percentage heights only resolve inside a definite-height host, which the
  // conversation view does not provide; pin the root to the visible box instead.
  React.useEffect(() => {
    const fit = () => {
      const node = rootRef.current
      if (node) fitHostHeight(node)
    }
    fit()
    const frame = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fit) : 0
    let observer = null
    if (typeof ResizeObserver === 'function') {
      observer = new ResizeObserver(fit)
      observer.observe(document.documentElement)
      const parent = rootRef.current ? rootRef.current.parentElement : null
      if (parent) observer.observe(parent)
    }
    window.addEventListener('resize', fit)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (observer) observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [])

  const rootBounds = () => {
    void layoutTick
    const node = rootRef.current
    if (!node) {
      return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth, height: window.innerHeight }
    }
    const rect = node.getBoundingClientRect()
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
  }
  const placePanel = (rect, estimatedHeight) => positionCard(rect, estimatedHeight, rootBounds())

  const drawerWidthKey =
    drawer === 'chat' ? 'chatWidth' : drawer === 'guide' && guideView === 'map' ? 'mapWidth' : 'drawerWidth'
  const drawerWidthDefault = drawerWidthKey === 'mapWidth' ? 760 : drawerWidthKey === 'chatWidth' ? 420 : 320
  const drawerWidthMin = drawerWidthKey === 'chatWidth' ? 320 : 240
  const drawerDraftWidth = drawerDraft && drawerDraft.key === drawerWidthKey ? drawerDraft.width : null
  const drawerMaxWidth = () =>
    Math.min(
      drawerWidthKey === 'mapWidth' ? 1200 : drawerWidthKey === 'chatWidth' ? 720 : 1000,
      Math.max(320, rootBounds().width - 180),
    )
  const drawerWidth = Math.min(drawerDraftWidth ?? (Number(prefs[drawerWidthKey]) || drawerWidthDefault), drawerMaxWidth())
  const clampDrawerWidth = (width) => Math.min(drawerMaxWidth(), Math.max(drawerWidthMin, width))
  const commitDrawerWidth = (width) => {
    const next = Math.round(clampDrawerWidth(width))
    setDrawerDraft({ key: drawerWidthKey, width: next })
    changePrefs({ [drawerWidthKey]: next })
    return next
  }
  const startDrawerResize = (event) => {
    if (event.button !== 0) return
    event.stopPropagation()
    drawerResizeRef.current = {
      key: drawerWidthKey,
      startX: event.clientX,
      startWidth: drawerWidth,
    }
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      /* pointer capture is best-effort */
    }
  }
  const moveDrawerResize = (event) => {
    const resize = drawerResizeRef.current
    if (!resize) return
    event.preventDefault()
    const next = Math.round(clampDrawerWidth(resize.startWidth + resize.startX - event.clientX))
    resize.currentWidth = next
    setDrawerDraft({ key: resize.key, width: next })
  }
  const endDrawerResize = () => {
    const resize = drawerResizeRef.current
    if (!resize) return
    drawerResizeRef.current = null
    const next = Math.round(clampDrawerWidth(resize.currentWidth ?? drawerWidth))
    setDrawerDraft({ key: resize.key, width: next })
    changePrefs({ [resize.key]: next })
  }
  const resetDrawerWidth = () => {
    setDrawerDraft(null)
    changePrefs({ [drawerWidthKey]: drawerWidthDefault })
  }

  const readingScroller = () => {
    const root = contentRef.current
    return root ? root.closest('.rd-main') || root.parentElement : null
  }

  // Ctrl+wheel is the Windows pinch/zoom gesture. Keep it inside the reader
  // instead of letting Chromium scale the whole DSH window.
  React.useEffect(() => {
    if (!doc) return undefined
    const main = readingScroller()
    if (!main) return undefined
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const direction = event.deltaY < 0 ? 1 : -1
      if (doc.ext === '.pdf') {
        setZoom((current) => Math.min(2.5, Math.max(0.6, +(current + direction * 0.15).toFixed(2))))
      } else {
        const current = Number(prefs.fontSize) || 18
        changePrefs({ fontSize: Math.min(26, Math.max(14, current + direction)) })
      }
    }
    main.addEventListener('wheel', onWheel, { passive: false })
    return () => main.removeEventListener('wheel', onWheel)
  }, [doc && doc.path, doc && doc.ext, prefs.fontSize])

  // Title of the chapter/section currently on screen, used for quote locations.
  const docChapterTitle = () => {
    if (!doc) return ''
    if (doc.ext === '.epub' && doc.epub && doc.epub.chapters[chapter]) {
      return String(doc.epub.chapters[chapter].label || '')
    }
    if (doc.ext === '.pdf') return ''
    const root = contentRef.current
    const main = readingScroller()
    if (!root || !main) return ''
    const top = main.getBoundingClientRect().top + 24
    let title = ''
    for (const heading of root.querySelectorAll('h1,h2,h3')) {
      if (heading.getBoundingClientRect().top <= top) title = String(heading.textContent || '').trim()
      else break
    }
    return title
  }

  // Percentage through the whole document, measured from the live scroller.
  const currentReadingPercent = () => {
    if (!doc) return 0
    const main = readingScroller()
    if (!main) return Math.round((readingProgress || 0) * 100)
    const local = scrollProgress({
      scrollTop: main.scrollTop,
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
    })
    if (doc.ext === '.epub' && doc.epub) return Math.round(chapterProgress(chapter, local, doc.epub.chapters.length) * 100)
    return Math.round(local * 100)
  }

  latestViewRef.current = {
    sessionId: doc ? doc.sessionId || sessionId : sessionId,
    path: doc ? doc.path : '',
    name: doc ? doc.name : '',
    chapter,
    page,
    drawer,
    guideView,
  }

  const persistCurrentView = () => {
    const latest = latestViewRef.current
    if (!latest.sessionId || !latest.path) return
    const main = readingScroller()
    if (main) latestScrollRef.current = main.scrollTop
    writeSavedViewState(latest.sessionId, {
      path: latest.path,
      name: latest.name,
      chapter: latest.chapter,
      page: latest.page,
      drawer: latest.drawer,
      guideView: latest.guideView,
      scrollTop: latestScrollRef.current,
      updatedAt: Date.now(),
    })
  }

  const updateReadingProgress = () => {
    if (!doc) {
      setReadingProgress(0)
      return
    }
    if (doc.ext === '.pdf') {
      setReadingProgress(doc.pdf.numPages > 1 ? (page - 1) / (doc.pdf.numPages - 1) : 0)
      return
    }
    const main = readingScroller()
    if (!main) return
    const local = scrollProgress({
      scrollTop: main.scrollTop,
      scrollHeight: main.scrollHeight,
      clientHeight: main.clientHeight,
    })
    if (doc.ext === '.epub' && doc.epub) {
      setReadingProgress(chapterProgress(chapter, local, doc.epub.chapters.length))
    } else {
      setReadingProgress(local)
    }
  }

  const goChapter = (next, position = 'top') => {
    chapterScrollHint.current = position
    setChapter(next)
  }

  // The destination only exists after React commits the jump; pulse it then.
  const pulseSoon = (selector) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const node = document.querySelector(selector)
      if (node) pulseElement(node, pulseOptions())
    }))
  }

  const jumpToChapter = (next) => {
    goChapter(next, 'top')
    pulseSoon('.rd-prose h1,.rd-prose h2,.rd-prose h3,.rd-prose > *')
  }

  const jumpToPdfPage = (pageNumber) => {
    if (!Number.isFinite(pageNumber)) return
    setPage(pageNumber)
    pulseSoon(`.rd-pdf-page[data-page="${pageNumber}"]`)
  }

  const scrollReading = (direction) => {
    const main = readingScroller()
    if (!main || !doc) return
    const target = scrollStepTarget(
      { scrollTop: main.scrollTop, scrollHeight: main.scrollHeight, clientHeight: main.clientHeight },
      direction,
    )
    if (target.kind === 'scroll') {
      main.scrollTo({ top: target.top, behavior: 'instant' })
      return
    }
    if (doc.ext !== '.epub' || !doc.epub) return
    if (target.kind === 'end' && chapter < doc.epub.chapters.length - 1) goChapter(chapter + 1, 'top')
    if (target.kind === 'start' && chapter > 0) goChapter(chapter - 1, 'bottom')
  }

  React.useEffect(() => {
    updateReadingProgress()
  }, [doc, page, chapter, layoutTick, translationMode])

  React.useEffect(() => {
    if (!doc || doc.ext === '.pdf') return
    const main = readingScroller()
    if (!main) return
    const onScroll = () => updateReadingProgress()
    main.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => main.removeEventListener('scroll', onScroll)
  }, [doc, chapter, layoutTick, translationMode])

  React.useEffect(() => {
    const hint = chapterScrollHint.current
    chapterScrollHint.current = null
    if (!hint || !doc || doc.ext !== '.epub') return
    const main = readingScroller()
    if (!main) return
    requestAnimationFrame(() => {
      main.scrollTop = hint === 'bottom' ? main.scrollHeight : 0
      updateReadingProgress()
    })
  }, [chapter, doc])

  React.useEffect(() => {
    if (pageInputRef.current && document.activeElement !== pageInputRef.current) {
      pageInputRef.current.value = String(page)
    }
  }, [page])

  const drawerViewKey = drawer === 'guide' ? `guide:${guideView}` : drawer

  React.useEffect(() => {
    lastDrawer.current = drawerViewKey
    const body = drawerBodyRef.current
    if (!body || !drawer) return
    requestAnimationFrame(() => {
      body.scrollTop = drawerScroll.current[drawerViewKey] || 0
    })
  }, [drawer, guideView])

  React.useEffect(() => {
    const onKey = (event) => {
      const action = shortcutFor(event, { editable: isEditableTarget(event.target), pageKeys: prefs.pageKeys })
      if (action === 'undo' || action === 'redo') {
        event.preventDefault()
        runHistory(action)
        return
      }
      if (action === 'help') {
        event.preventDefault()
        setShowHelp((current) => !current)
        return
      }
      if (action === 'search') {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      if (event.key === 'Escape') {
        if (mapFullscreen) {
          setMapFullscreen(false)
          return
        }
        if (selectionTranslation) {
          setSelectionTranslation(null)
          return
        }
        if (searchOpen) {
          setSearchOpen(false)
          return
        }
        setShowHelp(false)
        setCards([])
        setMenu(null)
        setChildMenu(null)
        setNoteDraft(null)
        setEditing(null)
        setConceptEdit(null)
        return
      }
      if (mapFullscreen) return
      if (!doc) return
      const typingTarget = event.target && event.target.closest
        ? event.target.closest('input, textarea, select, [contenteditable="true"]')
        : null
      const buttonTarget = event.target && event.target.closest
        ? event.target.closest('button, a, [role="button"]')
        : null
      const drawerBody = event.target && event.target.closest
        ? event.target.closest('.rd-drawer-body')
        : null
      if (drawerBody) {
        if (typingTarget) return
        if ((event.key === ' ' || event.key === 'Spacebar') && buttonTarget) return
        event.preventDefault()
        if (action === 'start' || action === 'end') {
          drawerBody.scrollTo({ top: action === 'start' ? 0 : drawerBody.scrollHeight, behavior: 'instant' })
          return
        }
        const target = scrollStepTarget(
          { scrollTop: drawerBody.scrollTop, scrollHeight: drawerBody.scrollHeight, clientHeight: drawerBody.clientHeight },
          action === 'next' ? 'next' : 'prev',
        )
        if (target.kind === 'scroll') drawerBody.scrollTo({ top: target.top, behavior: 'instant' })
        return
      }
      if (action === 'start' || action === 'end') {
        if (typingTarget) return
        if ((event.key === ' ' || event.key === 'Spacebar') && buttonTarget) return
        event.preventDefault()
        if (doc.ext === '.pdf') {
          setPage(action === 'start' ? 1 : doc.pdf.numPages)
        } else {
          const main = readingScroller()
          if (main) main.scrollTo({ top: action === 'start' ? 0 : main.scrollHeight, behavior: 'instant' })
        }
        return
      }
      if (action === 'next' || action === 'prev') {
        if (typingTarget) return
        if ((event.key === ' ' || event.key === 'Spacebar') && buttonTarget) return
        event.preventDefault()
        if (doc.ext === '.pdf') {
          const delta = action === 'next' ? 1 : -1
          const step = prefs.pdfSpread ? 2 : 1
          setPage((current) => Math.min(doc.pdf.numPages, Math.max(1, current + delta * step)))
        } else {
          scrollReading(action)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc, searchOpen, prefs.pageKeys, mapFullscreen])

  React.useEffect(() => {
    const onPointerDown = (event) => {
      if (!shouldDismissOnPointerDown(event.target)) return
      setMenu(null)
      setChildMenu(null)
      setEditing(null)
      setConceptEdit(null)
      setCards((current) => (current.some((entry) => entry.pinned) ? [] : current))
      dismissSelection(window)
    }
    // The listener sits on window in the capture phase, so it also receives
    // scroll events from the annotation editor's own textarea and from any
    // scrolling panel. Those must not close the panel the user is typing in.
    const onScroll = (event) => {
      if (!shouldDismissOnScroll(event.target)) return
      setMenu(null)
      setChildMenu(null)
      setEditing(null)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [])

  const revokeAssets = (target) => {
    for (const url of (target && target.epub && target.epub.assetUrls) || []) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* already revoked */
      }
    }
  }

  const openDoc = async (entry, options = {}) => {
    revokeAssets(doc)
    setBusy(true)
    setError('')
    try {
      const opened = await api.fetchBytes(sessionId, entry.path)
      const ext = entry.ext || extOf(entry.name)
      const next = { path: entry.path, name: entry.name, ext, size: opened.bytes.byteLength, bytes: opened.bytes, fingerprint: opened.fingerprint || '', sessionId }
      if (ext === '.epub') {
        next.epub = await epubOpen(opened.bytes)
        if (next.epub.fixedLayout) throw new Error(t('label.fxlUnsupported'))
      }
      if (ext === '.pdf') {
        next.pdf = await pdfOpen(opened.bytes)
        next.pdf.structure = null
        next.pdf.structureReady = false
        next.pdf.toc = []
        next.pdf.tocReliable = false
      }
      const key = next.fingerprint || entry.path
      setRelink(staleDocFor(store.docs, entry.path, key))
      if (next.fingerprint) {
        api
          .mutate(sessionId, {
            op: 'doc/upsert',
            docKey: next.fingerprint,
            path: entry.path,
            size: opened.bytes.byteLength,
            mtime: 0,
          })
          .catch(() => {})
      }
      const position = options.position || store.docs?.[key]?.positions || {}
      historyRef.current = createHistory(30)
      setHistoryTick((tick) => tick + 1)
      setDoc(next)
      setChapter(Number.isFinite(position.chapter) ? Math.max(0, position.chapter) : 0)
      setPage(Number.isFinite(position.page) ? Math.max(1, position.page) : 1)
      pendingScrollRef.current = Number.isFinite(options.scrollTop) && options.scrollTop > 0 ? options.scrollTop : null
      latestScrollRef.current = Number.isFinite(options.scrollTop) && options.scrollTop > 0 ? options.scrollTop : 0
      setDrawer(options.drawer || null)
      if (options.guideView === 'map' || options.guideView === 'list') setGuideView(options.guideView)
      setCards([])
      setMenu(null)
      setEditing(null)
      setConceptEdit(null)
      if (ext === '.pdf') {
        const targetPath = next.path
        next.pdf.structurePromise = new Promise((resolve) => setTimeout(resolve, 150))
          .then(() => pdfGuideStructure(next.pdf))
          .then((structure) => {
            next.pdf.structure = structure
            next.pdf.toc = structure.toc
            next.pdf.tocReliable = structure.tocReliable
            next.pdf.structureReady = true
            setDoc((current) =>
              current && current.path === targetPath
                ? {
                    ...current,
                    pdf: {
                      ...current.pdf,
                      structure,
                      toc: structure.toc,
                      tocReliable: structure.tocReliable,
                      structureReady: true,
                    },
                  }
                : current,
            )
            return structure
          })
          .catch(() => {
            next.pdf.structureReady = true
            setDoc((current) =>
              current && current.path === targetPath
                ? { ...current, pdf: { ...current.pdf, structureReady: true } }
                : current,
            )
            return null
          })
      }
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setBusy(false)
    }
  }

  const back = () => {
    revokeAssets(doc)
    writeSavedViewState(sessionId, null)
    latestViewRef.current = {}
    pendingScrollRef.current = null
    restoredViewRef.current = true
    historyRef.current = null
    setRelink(null)
    setDoc(null)
    setDrawer(null)
    setCards([])
    setEditing(null)
    setConceptEdit(null)
    setError('')
    api
      .list(sessionId, dir)
      .then((result) => setEntries(result.entries))
      .catch(() => {})
  }

  const navigate = (nextDir) => {
    api
      .list(sessionId, nextDir)
      .then((result) => {
        setDir(nextDir)
        setEntries(result.entries)
      })
      .catch((e) => setError(String(e.message || e)))
  }

  // Restore the book, reading position and drawer when returning to this
  // session after DSH unmounts the reader view.
  React.useEffect(() => {
    if (restoredViewRef.current || !sessionId) return
    if (doc) {
      restoredViewRef.current = true
      return
    }
    if (entries.length === 0) return
    const saved = readSavedViewState(sessionId)
    restoredViewRef.current = true
    if (!saved || !saved.path) return
    const extension = extOf(saved.path)
    if (!READABLE.has(extension)) return
    openDoc(
      { name: saved.name || basename(saved.path), path: saved.path, ext: extension },
      {
        position: { chapter: saved.chapter, page: saved.page },
        drawer: saved.drawer || null,
        guideView: saved.guideView,
        scrollTop: saved.scrollTop,
      },
    )
  }, [sessionId, entries, doc])

  // Reading-position reporting (spec §6.1): one throttled POST per document /
  // page / chapter change, with the context window the host caches for tools.
  React.useEffect(() => {
    if (!sessionId || !docKey) {
      if (reporterRef.current) {
        reporterRef.current.dispose()
        reporterRef.current = null
      }
      return undefined
    }
    const reporter = createPositionReporter({ api, sessionId })
    reporterRef.current = reporter
    return () => {
      if (reporterRef.current === reporter) reporterRef.current = null
      reporter.dispose()
    }
  }, [sessionId, docKey])

  const reportCurrentPosition = () => {
    const reporter = reporterRef.current
    if (!reporter || !doc) return undefined
    const position = currentPosition(doc, {
      chapter,
      chapterTitle: docChapterTitle(),
      page,
      percent: currentReadingPercent(),
    })
    if (!position) return undefined
    let cancelled = false
    Promise.resolve()
      .then(() => buildContextWindow(doc, position))
      .then((contextWindow) => {
        if (!cancelled) reporter.report(position, contextWindow || undefined)
      })
      .catch(() => {
        if (!cancelled) reporter.report(position)
      })
    return () => {
      cancelled = true
    }
  }

  React.useEffect(() => {
    const cancel = reportCurrentPosition()
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, docKey, chapter, page])

  React.useEffect(() => {
    if (!doc || pendingScrollRef.current == null) return
    const target = pendingScrollRef.current
    let first = null
    let second = null
    first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        const main = readingScroller()
        if (main) {
          // Restore immediately; the reading pane uses smooth scrolling for
          // user navigation, but a restored position should not animate.
          const previous = main.style.scrollBehavior
          main.style.scrollBehavior = 'auto'
          main.scrollTop = target
          main.style.scrollBehavior = previous
          pendingScrollRef.current = null
        }
      })
    })
    return () => {
      if (first) cancelAnimationFrame(first)
      if (second) cancelAnimationFrame(second)
    }
  }, [doc, chapter, page])

  React.useEffect(() => {
    if (!doc) return
    const timer = setTimeout(persistCurrentView, 200)
    return () => clearTimeout(timer)
  }, [sessionId, doc ? doc.path : '', chapter, page, drawer, guideView])

  React.useEffect(() => {
    if (!doc) return
    const root = rootRef.current
    const main = readingScroller()
    if (!root && !main) return
    let timer = null
    let reportTimer = null
    const onScroll = (event) => {
      const target = event.target
      const inReader = target && target.closest && target.closest('.rd-main')
      if (!inReader && target !== main) return
      clearTimeout(timer)
      timer = setTimeout(persistCurrentView, 250)
      // Text books have no page turns: scrolling is the only position change.
      if (doc.ext !== '.pdf') {
        clearTimeout(reportTimer)
        reportTimer = setTimeout(() => reportCurrentPosition(), 600)
      }
    }
    // Scroll does not bubble; capture it at the reader root so the position is
    // still recorded when the inner prose node was replaced by a re-render.
    root?.addEventListener('scroll', onScroll, true)
    main?.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(timer)
      clearTimeout(reportTimer)
      root?.removeEventListener('scroll', onScroll, true)
      main?.removeEventListener('scroll', onScroll)
      persistCurrentView()
    }
  }, [doc, chapter, page])

  React.useEffect(() => () => persistCurrentView(), [])

  const addAnnotation = (annotation) => {
    if (!doc) return Promise.resolve()
    return applyMutation({ op: 'annotation/add', docKey, annotation })
      .then(() => {
        historyRef.current?.push({
          label: t('label.addedMark'),
          undo: { op: 'annotation/remove', docKey, id: annotation.id },
          redo: { op: 'annotation/add', docKey, annotation },
        })
        setHistoryTick((tick) => tick + 1)
        flash(t('label.addedMark'), { label: t('action.undo'), run: () => runHistory('undo') })
      })
      .catch((e) => reportError(e))
  }

  const runHistory = async (direction) => {
    const history = historyRef.current
    if (!history) return
    const entry = direction === 'undo' ? history.undo() : history.redo()
    if (!entry) {
      flash(t('label.nothingToUndo'))
      return
    }
    try {
      await applyMutation(direction === 'undo' ? entry.undo : entry.redo)
      setHistoryTick((tick) => tick + 1)
      flash(direction === 'undo' ? t('label.undo') : t('label.redo'), {
        label: direction === 'undo' ? t('action.redo') : t('action.undo'),
        run: () => runHistory(direction === 'undo' ? 'redo' : 'undo'),
      })
    } catch (e) {
      reportError(e)
    }
  }

  const contextFor = (range) => {
    if (!range) return { sentence: '', paragraph: '' }
    const node = range.startContainer
    const element = node.nodeType === 3 ? node.parentElement : node
    const block = element && element.closest ? element.closest('p,li,blockquote,pre,h1,h2,h3,h4,h5,h6,div') : null
    const paragraph = (block ? block.textContent : '') || ''
    const term = range.toString().trim()
    const at = paragraph.indexOf(term)
    const sentence =
      at >= 0 ? paragraph.slice(Math.max(0, at - 80), at + term.length + 80) : paragraph.slice(0, 200)
    return { sentence: sentence.trim(), paragraph: paragraph.slice(0, 600).trim() }
  }

  const createConcept = async (term, range, parentId) => {
    setMenu(null)
    setChildMenu(null)
    if (!term) return
    if (term.length > 1200) {
      flash(t('label.selectionTooLongExplain'))
      return
    }
    const parent = parentId ? store.concepts[parentId] : null
    if (parent && conceptChain(store.concepts, parentId).length >= 3) {
      flash(t('label.nestLimit'))
      return
    }
    const rect = range ? range.getBoundingClientRect() : { left: 220, top: 220, right: 220, bottom: 220 }
    const pendingId = 'pending-' + uid()
    // Keep one slot per card: the pending card and its settled concept share it,
    // so loading the answer never replays the entrance animation (M-02).
    cardSlotRef.current += 1
    const slot = `card-slot-${cardSlotRef.current}`
    setCards((current) =>
      parentId
        ? pushCard(current, { id: pendingId, slot, term, pending: true, pinned: true, rect })
        : [{ id: pendingId, slot, term, pending: true, pinned: true, rect }],
    )
    const { sentence, paragraph } = contextFor(range)
    const inContent = Boolean(
      range && contentRef.current && contentRef.current.contains(range.commonAncestorContainer),
    )
    let occurrence = 0
    let pageNumber
    if (inContent && doc?.ext === '.pdf') pageNumber = pdfPageFromRange(range)
    else if (inContent && range) {
      occurrence = occurrenceBefore(contentRef.current, range).split(term).length - 1
    }
    try {
      const result = await api.explain(sessionId, {
        term,
        sentence,
        paragraph,
        docTitle: doc ? doc.name : '',
        parentId: parentId || null,
        depth: 'quick',
        ...(inContent ? { docKey, chapter, page: pageNumber, quote: term, occurrence } : {}),
      })
      const concept = result.concept
      if (result.store) mergeStore(result.store)
      if (result.ancestor) {
        // The reader walked down the chain and asked about a term that raised it:
        // show that card with the reason instead of pretending it is new.
        setCards((current) => replaceTop(current, { id: concept.id, slot: (topCard(current) || {}).slot, pinned: true, rect, hint: t('label.ancestorRevisit') }))
        flash(t('label.ancestorRevisit'))
        return
      }
      setCards((current) => replaceTop(current, { id: concept.id, slot: (topCard(current) || {}).slot, pinned: true, rect }))
      flash(`${t('label.conceptSaved')}：${concept.term}`)
    } catch (e) {
      setCards((current) =>
        replaceTop(current, { id: pendingId, slot: (topCard(current) || {}).slot, term, pending: false, error: String(e.message || e), pinned: true, rect }),
      )
    }
  }

  const addHighlight = (color) => {
    if (!menu || !doc) return
    const quote = menu.range.toString()
    if (!quote) return
    if (doc.ext === '.pdf') {
      const pageElement = menu.range.startContainer.parentElement?.closest('.rd-pdf-page')
      if (!pageElement) return
      const base = pageElement.getBoundingClientRect()
      const rects = Array.from(menu.range.getClientRects()).map((rect) => ({
        x: (rect.left - base.left) / base.width,
        y: (rect.top - base.top) / base.height,
        w: rect.width / base.width,
        h: rect.height / base.height,
      }))
      const pageNumber = Number(pageElement.dataset.page) || page
      addAnnotation({ id: uid(), kind: 'pdf', page: pageNumber, quote, rects, color, createdAt: Date.now() })
    } else {
      const root = contentRef.current
      if (!root) return
      const occurrence = occurrenceBefore(root, menu.range).split(quote).length - 1
      addAnnotation({ id: uid(), kind: 'text', chapter, quote, occurrence, color, createdAt: Date.now() })
    }
    setMenu(null)
  }

  const startNote = () => {
    if (!menu || !doc) return
    const quote = menu.range.toString()
    if (!quote) return
    if (doc.ext === '.pdf') {
      setNoteDraft({ quote, page: pdfPageFromRange(menu.range), pdf: true, text: '', color: '#f2c94c' })
      setMenu(null)
      return
    }
    const root = contentRef.current
    if (!root) return
    const occurrence = occurrenceBefore(root, menu.range).split(quote).length - 1
    setNoteDraft({ quote, occurrence, text: '', color: '#f2c94c' })
    setMenu(null)
  }

  const saveNote = () => {
    if (!noteDraft || !doc) return
    const text = String(noteDraft.text || '').trim()
    if (!text) return
    const base = noteDraft.pdf
      ? { id: uid(), kind: 'pdf', page: noteDraft.page || page, quote: noteDraft.quote, rects: [], note: text, color: noteDraft.color, createdAt: Date.now() }
      : {
          id: uid(),
          kind: 'text',
          chapter,
          quote: noteDraft.quote,
          occurrence: noteDraft.occurrence,
          note: text,
          color: noteDraft.color,
          createdAt: Date.now(),
        }
    addAnnotation(base)
    setNoteDraft(null)
  }

  const removeAnnotation = (id) => applyMutation({ op: 'annotation/remove', docKey, id }).catch(() => {})

  const removeConcept = (id) => {
    setDeleteConceptId(null)
    setOccurrencesOpen(null)
    setConceptEdit(null)
    setCards((current) => current.filter((entry) => entry.id !== id))
    applyMutation({ op: 'concept/delete', id })
      .then(() => flash(t('label.conceptDeleted')))
      .catch((e) => reportError(e))
  }

  const changePrefs = (patch) => {
    if (Number.isFinite(patch.fontSize)) setFontSize(patch.fontSize)
    applyMutation({ op: 'prefs/set', prefs: patch }).catch((e) =>
      reportError(e),
    )
  }

  const saveConceptEdit = async () => {
    if (!conceptEdit) return
    const result = conceptPatch(conceptEdit.form)
    if (!result.ok) {
      flash(t('label.termRequired'))
      return
    }
    try {
      await applyMutation({
        op: 'concept/upsert',
        concept: { id: conceptEdit.id, ...result.patch, source: 'user', updatedAt: Date.now() },
      })
      setConceptEdit(null)
      flash(t('label.updatedConcept'))
    } catch (e) {
      reportError(e)
    }
  }

  const onContentClick = (event) => {
    const anchor = event.target.closest ? event.target.closest('a[href]') : null
    if (!anchor) return
    const href = anchor.getAttribute('href') || ''
    if (!href) return
    event.preventDefault()
    if (href.startsWith('#')) {
      const target = contentRef.current && contentRef.current.querySelector(href)
      if (target) target.scrollIntoView({ block: 'start' })
      return
    }
    if (/^(https?:|mailto:)/i.test(href)) {
      window.open(href, '_blank', 'noopener')
      return
    }
    if (doc && doc.ext === '.epub') {
      const [pathPart, fragment] = href.split('#')
      const clean = pathPart.replace(/^\.\//, '')
      if (!clean && fragment) {
        const local = document.getElementById(decodeURIComponent(fragment))
        if (local && local.scrollIntoView) local.scrollIntoView({ block: 'start' })
        return
      }
      const index = doc.epub.chapters.findIndex((item) => item.path.endsWith(clean))
      if (index >= 0) {
        goChapter(index, 'top')
        if (fragment) setPendingAnchor(fragment)
      }
    }
  }

  const updateAnnotation = async (id, patch) => {
    if (!doc) return
    const previous = docAnnotations.find((item) => item.id === id)
    const next = { ...(previous || { id }), ...patch }
    try {
      await applyMutation({ op: 'annotation/update', docKey, annotation: next })
      if (previous) {
        historyRef.current?.push({
          label: t('label.updatedMark'),
          undo: { op: 'annotation/update', docKey, annotation: previous },
          redo: { op: 'annotation/update', docKey, annotation: next },
        })
        setHistoryTick((tick) => tick + 1)
      }
      flash(t('label.updatedMark'), { label: t('action.undo'), run: () => runHistory('undo') })
    } catch (e) {
      reportError(e)
    }
  }

  const saveEditing = () => {
    if (!editing) return
    updateAnnotation(editing.id, { note: String(editing.note || '').trim() })
    setEditing(null)
  }

  const deleteEditing = async () => {
    if (!editing || !doc) return
    const annotation = editing.annotation
    setEditing(null)
    try {
      await applyMutation({ op: 'annotation/remove', docKey, id: annotation.id })
      historyRef.current?.push({
        label: t('label.deletedMark'),
        undo: { op: 'annotation/add', docKey, annotation },
        redo: { op: 'annotation/remove', docKey, id: annotation.id },
      })
      setHistoryTick((tick) => tick + 1)
      flash(t('label.deletedMark'), { label: t('action.undo'), run: () => runHistory('undo') })
    } catch (e) {
      reportError(e)
    }
  }

  const onRootClick = (event) => {
    if (selectionTranslation && event.target && event.target.closest && !event.target.closest('.rd-trans-card')) {
      setSelectionTranslation(null)
    }
    const root = contentRef.current
    if (!root) return
    const selection = window.getSelection()
    const collapsed = !selection || selection.isCollapsed
    const id = shouldOpenEditor(event.target, root, collapsed)
    if (id) {
      const annotation = docAnnotations.find((item) => item.id === id)
      if (!annotation) return
      const element = event.target.closest('[data-anno]')
      const rect = element ? element.getBoundingClientRect() : { left: 200, top: 200, right: 200, bottom: 200 }
      setMenu(null)
      setCards([])
      setEditing({ id, annotation, rect, note: annotation.note || '' })
      return
    }
    if (doc?.ext === '.pdf' && docAnnotations.length > 0) {
      const pageElement = event.target.closest ? event.target.closest('.rd-pdf-page') : null
      const box = pageElement ? pageElement.getBoundingClientRect() : null
      if (box && box.width > 0 && box.height > 0) {
        const pageNumber = Number(pageElement.dataset.page) || page
        const hit = hitAnnotationAtPoint(
          docAnnotations,
          pageNumber,
          (event.clientX - box.left) / box.width,
          (event.clientY - box.top) / box.height,
        )
        if (hit) {
          const point = { left: event.clientX, top: event.clientY, right: event.clientX, bottom: event.clientY }
          setMenu(null)
          setCards([])
          setEditing({ id: hit.id, annotation: hit, rect: point, note: hit.note || '' })
          return
        }
      }
    }
    if (prefs.cardTrigger === 'click') {
      const term = event.target.closest ? event.target.closest('.rd-term') : null
      if (term && term.dataset.id && store.concepts[term.dataset.id]) {
        setMenu(null)
        setCards([{ id: term.dataset.id, rect: term.getBoundingClientRect(), pinned: false }])
      }
    }
  }

  const onRootKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (!target || !target.classList) return
    if (target.dataset && target.dataset.activate === '1') {
      event.preventDefault()
      target.click()
      return
    }
    if (event.key !== 'Enter') return
    if (target.classList.contains('rd-term') && target.dataset.id) {
      event.preventDefault()
      setCards([{ id: target.dataset.id, rect: target.getBoundingClientRect(), pinned: false }])
      return
    }
    if (target.classList.contains('rd-hl') && target.dataset.anno) {
      event.preventDefault()
      const annotation = docAnnotations.find((item) => item.id === target.dataset.anno)
      if (annotation) {
        setEditing({
          id: annotation.id,
          annotation,
          rect: target.getBoundingClientRect(),
          note: annotation.note || '',
        })
      }
    }
  }

  const onPointerUp = (event) => {
    if (isToolbarTarget(event && event.target)) return
    if (translationMode === 'only' && doc && doc.ext !== '.pdf') {
      flash(t('label.translateOnlyNoAnnotate'))
      return
    }
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    const text = selection.toString().trim()
    if (!text) {
      // A figure selected on its own has no text, but it is still a passage the
      // reader may want explained: keep the menu when it carries rich assets.
      const probeRoot = contentRef.current
      if (!probeRoot || collectSelectionAssets(range, probeRoot).length === 0) return
    }
    const node = range.commonAncestorContainer
    const element = node.nodeType === 3 ? node.parentElement : node
    if (element && element.closest && element.closest('.rd-card')) {
      if (text.length <= 80 && card) {
        const rect = range.getBoundingClientRect()
        setCards((current) =>
          current.map((entry, index) => (index === current.length - 1 ? { ...entry, pinned: true } : entry)),
        )
        setChildMenu({
          text,
          range: range.cloneRange(),
          x: rect.left + rect.width / 2,
          y: rect.top,
          rect,
        })
      }
      return
    }
    const root = contentRef.current
    const chatRoot = rootRef.current ? rootRef.current.querySelector('.rd-chat') : null
    const inChat = Boolean(chatRoot && chatRoot.contains(range.commonAncestorContainer))
    if (!inChat && (!root || !root.contains(range.commonAncestorContainer))) {
      setMenu(null)
      return
    }
    const rect = range.getBoundingClientRect()
    // Figures/formulas inside the selection travel with the question: describe
    // them in the quote now, attach their bytes once the composer accepts them.
    const assets = !inChat && root ? collectSelectionAssets(range, root) : []
    setMenuError('')
    setMenu({
      text,
      range: range.cloneRange(),
      x: rect.left + rect.width / 2,
      y: rect.top,
      rect,
      inChat,
      assets,
    })
  }

  const closeCardsSoon = (delay = 600) => {
    clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      const hovering = document.querySelector(
        '.rd-term:hover, .rd-hover-zone:hover, .rd-card:hover, .rd-mini:hover',
      )
      if (hovering) return
      setCards([])
    }, delay)
  }

  const onTermOver = (event) => {
    if (prefs.cardTrigger === 'click' || prefs.cardTrigger === 'off') return
    const element = event.target.closest ? event.target.closest('.rd-term') : null
    if (!element || !element.dataset.id) return
    if (cards.some((entry) => entry.pinned)) return
    if (cards.some((entry) => entry.id === element.dataset.id)) {
      clearTimeout(hideTimer.current)
      return
    }
    clearTimeout(hideTimer.current)
    clearTimeout(hoverTimer.current)
    hoverTimer.current = setTimeout(() => {
      const rect = element.getBoundingClientRect()
      setCards([{ id: element.dataset.id, rect, pinned: false }])
    }, prefs.hoverDelay || 150)
  }

  const onTermOut = (event) => {
    if (cards.some((entry) => entry.pinned)) return
    const inside = (node) =>
      node && node.closest && node.closest('.rd-card, .rd-hover-zone, .rd-mini')
    // Moving inside or out of the card, its hover halo, or the child menu is
    // not leaving the concept; the zone's own mouseleave decides that.
    if (inside(event.target) || inside(event.relatedTarget)) return
    clearTimeout(hoverTimer.current)
    closeCardsSoon()
  }

  const focusAnnotation = (annotation) => {
    if (annotation.kind === 'pdf') {
      jumpToPdfPage(annotation.page)
      return
    }
    const root = contentRef.current
    const element = root && root.querySelector(`[data-anno="${annotation.id}"]`)
    if (!element) return
    element.scrollIntoView({ block: 'center' })
    pulseElement(element, pulseOptions())
  }

  const upgradeConcept = async (concept) => {
    if (!concept || upgradingId) return
    setUpgradingId(concept.id)
    try {
      const sentence = (concept.evidence && concept.evidence.sentence) || ''
      const result = await api.explain(sessionId, {
        term: concept.term,
        sentence,
        paragraph: sentence,
        docTitle: doc ? doc.name : '',
        depth: 'full',
      })
      if (result.store) mergeStore(result.store)
      flash(t('label.deepenDone'))
    } catch (e) {
      reportError(e)
    } finally {
      setUpgradingId(null)
    }
  }

  const askConcept = async (concept) => {
    const question = askText.trim()
    if (!question || askBusy || !concept) return
    setAskBusy(true)
    try {
      const result = await api.ask(sessionId, { conceptId: concept.id, question, web: askWeb })
      if (result.store) mergeStore(result.store)
      setAskText('')
    } catch (e) {
      reportError(e)
    } finally {
      setAskBusy(false)
    }
  }

  const exportStore = async () => {
    try {
      const blob = await api.exportStore(sessionId)
      downloadBlob(blob, 'dsh-reader-export.json')
    } catch (e) {
      reportError(e)
    }
  }

  const restoreLatest = async () => {
    if (!window.confirm(t('label.restoreConfirm'))) return
    try {
      const result = await api.restore(sessionId)
      if (result.store) mergeStore(result.store)
      flash(t('label.restored'))
    } catch (e) {
      reportError(e)
    }
  }

  const onImportFile = async (event) => {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      const incoming = parsed.store || parsed
      const incomingCount = Object.keys((incoming && incoming.concepts) || {}).length
      const currentCount = Object.keys(store.concepts || {}).length
      if (!window.confirm(`${t('label.importConfirm')} (${incomingCount} → ${currentCount})`)) return
      const result = await api.importStore(sessionId, incoming)
      if (result.store) mergeStore(result.store)
      flash(t('label.imported'))
    } catch (e) {
      reportError(e)
    }
  }

  const mergeConcept = async (fromId, toId) => {
    if (!fromId || !toId || !window.confirm(t('label.mergeConfirm'))) return
    try {
      await applyMutation({ op: 'concept/merge', fromId, toId })
      setConceptEdit(null)
      setMergeTarget('')
      flash(t('label.merged'))
    } catch (e) {
      reportError(e)
    }
  }

  const exportMarks = () => {
    downloadBlob(new Blob([annotationsMarkdown(store)], { type: 'text/markdown' }), 'dsh-reader-annotations.md')
  }

  const runSearch = async () => {
    const query = searchQuery.trim()
    if (!query || !doc) {
      setSearchResults([])
      setSearchDone(true)
      return
    }
    setSearchBusy(true)
    setSearchDone(false)
    try {
      if (doc.ext === '.pdf' && doc.pdf) {
        const results = []
        for (let pageNumber = 1; pageNumber <= doc.pdf.numPages && results.length < 50; pageNumber += 1) {
          const page = await doc.pdf.doc.getPage(pageNumber)
          const content = await page.getTextContent()
          const text = content.items.map((item) => item.str).join(' ')
          for (const hit of searchText(text, query, 50 - results.length)) {
            results.push({ ...hit, page: pageNumber })
          }
        }
        setSearchResults(results)
      } else {
        const root = contentRef.current
        const text = root ? root.textContent : ''
        const lowerQuery = query.toLowerCase()
        setSearchResults(
          searchText(text, query).map((hit) => ({
            ...hit,
            occurrence: text.slice(0, hit.index).toLowerCase().split(lowerQuery).length - 1,
          })),
        )
      }
    } catch (e) {
      reportError(e)
    } finally {
      setSearchBusy(false)
      setSearchDone(true)
    }
  }

  const jumpToSearchResult = (result) => {
    if (doc?.ext === '.pdf') {
      jumpToPdfPage(result.page)
      return
    }
    const root = contentRef.current
    if (!root) return
    const found = findQuoteRange(root, searchQuery.trim(), result.occurrence || 0)
    if (found) {
      const node = found.range.startContainer
      const element = node.nodeType === 3 ? node.parentElement : node
      if (element && element.scrollIntoView) element.scrollIntoView({ block: 'center' })
      pulseRange(found.range, pulseOptions())
    }
  }

  const renderSelectionTranslation = () => {
    if (!selectionTranslation) return null
    const style = placePanel(selectionTranslation.rect, 220)
    return h(
      'div',
      {
        className: 'rd-trans-card',
        style: { left: style.left, top: style.top, width: style.width, maxHeight: style.maxHeight },
        onClick: (event) => event.stopPropagation(),
      },
      h(
        'div',
        { className: 'rd-muted', style: { fontSize: '11px' } },
        `${t('label.translateTo')}：${t(`lang.${translationLang}`)}`,
      ),
      h(
        'div',
        { className: 'rd-muted', style: { fontSize: '11.5px', marginTop: '4px', lineHeight: 1.5 } },
        '“' + selectionTranslation.text.slice(0, 90) + '”',
      ),
      h(
        'div',
        { style: { marginTop: '6px', fontSize: '13.5px', lineHeight: 1.6 } },
        selectionTranslation.loading
          ? t('label.translating')
          : selectionTranslation.translation || t('label.noTranslation'),
      ),
      h(
        'div',
        { className: 'rd-actions' },
        h('button', { className: 'rd-btn ghost', onClick: () => setSelectionTranslation(null) }, t('action.close')),
      ),
    )
  }

  const renderSearch = () => {
    if (!searchOpen) return null
    return h(
      'div',
      { className: 'rd-search' },
      h(
        'div',
        { className: 'rd-search-head' },
        h('input', {
          autoFocus: true,
          className: 'rd-input',
          style: { flex: 1 },
          placeholder: t('label.searchInDoc'),
          value: searchQuery,
          onChange: (event) => setSearchQuery(event.target.value),
          onKeyDown: (event) => {
            if (event.key === 'Enter') runSearch()
          },
        }),
        h('button', { className: 'rd-btn', onClick: runSearch }, t('action.search')),
        h('button', { className: 'rd-btn ghost', onClick: () => setSearchOpen(false) }, '×'),
      ),
      searchBusy
        ? h('div', { className: 'rd-empty' }, t('label.searching'))
        : !searchDone
          ? h('div', { className: 'rd-empty' }, t('label.searchHint'))
          : searchResults.length === 0
            ? h('div', { className: 'rd-empty' }, t('label.noMatches'))
            : searchResults.map((result, index) =>
                h(
                  'div',
                  { key: index, className: 'rd-drawer-item', 'data-activate': '1', tabIndex: 0, role: 'button', onClick: () => jumpToSearchResult(result) },
                  h(
                    'div',
                    { className: 'rd-muted', style: { fontSize: '11px' } },
                    result.page ? `${t('label.page')} ${result.page}` : `${t('label.match')} ${index + 1}`,
                  ),
                  h('div', null, result.snippet),
                ),
              ),
    )
  }

  const translationLang = prefs.translateTo || 'zh'
  const translationFrom = prefs.translateFrom || 'en'
  const storeTranslations = React.useMemo(
    () => (docKey ? store.docs?.[docKey]?.translations?.[translationLang] || {} : {}),
    [store.docs, docKey, translationLang],
  )
  const translationMap = React.useMemo(
    () => ({ ...storeTranslations, ...(translationCache[translationLang] || {}) }),
    [storeTranslations, translationCache, translationLang],
  )
  const translationCacheRef = React.useRef(translationCache)
  const translationMapRef = React.useRef(translationMap)
  const translationLangRef = React.useRef(translationLang)
  const translationFromRef = React.useRef(translationFrom)
  const translationQueueRef = React.useRef(new Map())
  const translationQueuedRef = React.useRef(new Set())
  const translationRunningRef = React.useRef(false)
  const [translationPending, setTranslationPending] = React.useState(0)
  const [translationTick, setTranslationTick] = React.useState(0)
  const translationPendingRef = React.useRef(0)

  React.useEffect(() => {
    translationCacheRef.current = translationCache
  }, [translationCache])
  React.useEffect(() => {
    translationMapRef.current = translationMap
  }, [translationMap])
  React.useEffect(() => {
    translationLangRef.current = translationLang
    translationFromRef.current = translationFrom
  }, [translationLang, translationFrom])

  React.useEffect(() => {
    translationQueueRef.current.clear()
    translationQueuedRef.current.clear()
    translationPendingRef.current = 0
    setTranslationPending(0)
  }, [docKey, translationLang, translationFrom, translationMode])

  const collectTranslationBlocks = (limit = 1000) => {
    const root = contentRef.current
    if (!root) return []
    const nodes = root.querySelectorAll('p, li, blockquote, h2, h3, h4, td')
    const blocks = []
    const seen = new Set()
    for (const node of nodes) {
      if (node.closest('.rd-trans, .rd-card')) continue
      const text = normalizeBlockText(node.textContent)
      if (text.length < 2) continue
      const hash = blockHash(text)
      if (seen.has(hash)) continue
      seen.add(hash)
      blocks.push({ node, text, hash })
      if (blocks.length >= limit) break
    }
    return blocks
  }

  const mergeTranslations = (lang, result) => {
    const merged = { ...(translationCacheRef.current[lang] || {}) }
    for (const [id, text] of Object.entries(result.translations || {})) merged[id] = text
    translationCacheRef.current = { ...translationCacheRef.current, [lang]: merged }
    setTranslationCache(translationCacheRef.current)
    if (result.store) mergeStore(result.store)
  }

  const enqueueTranslationSegments = (segments) => {
    let added = 0
    for (const segment of segments) {
      if (!segment || !segment.id || !segment.text) continue
      if (translationFor(translationMapRef.current, segment.id)) continue
      if (translationQueuedRef.current.has(segment.id)) continue
      translationQueuedRef.current.add(segment.id)
      translationQueueRef.current.set(segment.id, segment.text)
      added += 1
    }
    if (added === 0) return
    translationPendingRef.current = translationQueueRef.current.size
    setTranslationPending(translationPendingRef.current)
    void runTranslationQueue()
  }

  const runTranslationQueue = async () => {
    if (translationRunningRef.current) return
    translationRunningRef.current = true
    setTranslationBusy(true)
    try {
      while (translationQueueRef.current.size > 0) {
        const lang = translationLangRef.current
        const from = translationFromRef.current
        for (const [id] of translationQueueRef.current) {
          if (translationFor(translationMapRef.current, id)) {
            translationQueueRef.current.delete(id)
            translationQueuedRef.current.delete(id)
          }
        }
        const segments = takeTranslationBatch(translationQueueRef.current)
        if (segments.length === 0) {
          translationQueueRef.current.clear()
          translationQueuedRef.current.clear()
          break
        }
        const result = await api.translate(sessionId, {
          docKey,
          target: lang,
          from,
          segments,
        })
        mergeTranslations(lang, result)
        for (const segment of segments) {
          translationQueueRef.current.delete(segment.id)
          translationQueuedRef.current.delete(segment.id)
        }
        translationPendingRef.current = translationQueueRef.current.size
        setTranslationPending(translationPendingRef.current)
        setTranslationTick((tick) => tick + 1)
      }
    } catch (error) {
      translationQueueRef.current.clear()
      translationQueuedRef.current.clear()
      translationPendingRef.current = 0
      setTranslationPending(0)
      reportError(error)
    } finally {
      translationRunningRef.current = false
      setTranslationBusy(false)
    }
  }

  const translateVisibleNow = () => {
    const blocks = collectTranslationBlocks(120)
    const root = contentRef.current
    if (!root) return
    const scroller = root.closest('.rd-main')
    const viewport = scroller ? scroller.getBoundingClientRect() : null
    const visible = blocks.filter((block) => {
      if (!viewport) return true
      return isNearViewport(block.node.getBoundingClientRect(), viewport, 200)
    })
    enqueueTranslationSegments(visible.map((block) => ({ id: block.hash, text: block.text })))
  }

  const toggleTranslation = () => {
    if (!doc) return
    if (doc.ext === '.pdf') {
      const next = drawer === 'translate' ? null : 'translate'
      setDrawer(next)
      if (next) void translatePdfPage()
      return
    }
    const next = translationMode === 'off' ? 'dual' : translationMode === 'dual' ? 'only' : 'off'
    setTranslationMode(next)
    if (next !== 'off') {
      // The IntersectionObserver effect will translate the visible blocks;
      // this immediate pass makes the first screen respond without waiting.
      setTimeout(translateVisibleNow, 0)
    }
  }

  const translatePdfPage = async () => {
    if (!doc || !doc.pdf || pdfTranslating) return
    setPdfTranslating(true)
    try {
      const blocks = await pdfPageBlocks(doc.pdf, page)
      setPdfBlocks(blocks)
      const missing = blocks.filter(
        (block) => !translationFor(translationMapRef.current, blockHash(block.text)),
      )
      for (let index = 0; index < missing.length; index += 8) {
        const group = missing.slice(index, index + 8)
        const segments = group.map((block) => ({ id: blockHash(block.text), text: block.text }))
        const result = await api.translate(sessionId, {
          docKey,
          target: translationLangRef.current,
          from: translationFromRef.current,
          segments,
        })
        mergeTranslations(translationLangRef.current, result)
      }
    } catch (error) {
      reportError(error)
    } finally {
      setPdfTranslating(false)
    }
  }

  React.useEffect(() => {
    if (drawer !== 'translate' || !doc || doc.ext !== '.pdf') return
    void translatePdfPage()
  }, [drawer, page, translationLang, translationFrom])

  const translateSelection = async () => {
    if (!menu) return
    const text = normalizeBlockText(menu.text)
    if (!text) return
    if (text.length > 4000) {
      flash(t('label.selectionTooLongTranslate'))
      return
    }
    const rect = menu.range.getBoundingClientRect()
    setMenu(null)
    setSelectionTranslation({ text, loading: true, translation: '', rect })
    try {
      const hash = blockHash(text)
      const result = await api.translate(sessionId, {
        target: translationLang,
        from: translationFrom,
        segments: [{ id: hash, text }],
      })
      setSelectionTranslation({
        text,
        loading: false,
        translation: (result.translations || {})[hash] || '',
        rect,
      })
    } catch (error) {
      reportError(error)
      setSelectionTranslation({ text, loading: false, translation: '', rect })
    }
  }

  const renderLanguageControls = (className = '') =>
    h(
      'div',
      { className: `rd-lang-controls ${className}`.trim() },
      h(
        'label',
        { className: 'rd-lang-field' },
        h('span', null, t('label.translateFrom')),
        h(
          'select',
          {
            className: 'rd-select',
            value: translationFrom,
            onChange: (event) => changePrefs({ translateFrom: event.target.value }),
          },
          TRANSLATE_SOURCES.map((value) => h('option', { key: value, value }, t(`lang.${value}`))),
        ),
      ),
      h('span', { className: 'rd-lang-arrow' }, '→'),
      h(
        'label',
        { className: 'rd-lang-field' },
        h('span', null, t('label.translateTo')),
        h(
          'select',
          {
            className: 'rd-select',
            value: translationLang,
            onChange: (event) => changePrefs({ translateTo: event.target.value }),
          },
          TRANSLATE_TARGETS.map((value) => h('option', { key: value, value }, t(`lang.${value}`))),
        ),
      ),
    )

  const renderTranslateBar = () =>
    h(
      'div',
      { className: 'rd-translate-bar' },
      renderLanguageControls(),
      h('span', { className: 'rd-spacer' }),
      translationBusy || translationPending > 0
        ? h('span', { className: 'rd-muted rd-translate-status' }, t('label.translatingVisible'))
        : null,
      h('button', { className: 'rd-btn ghost', onClick: translateVisibleNow }, t('label.translateVisible')),
      h(
        'button',
        { className: 'rd-btn ghost', onClick: () => setTranslationMode('off') },
        '×',
      ),
    )

  React.useEffect(() => {
    const root = contentRef.current
    if (!root || !doc || doc.ext === '.pdf') return
    for (const node of Array.from(root.querySelectorAll('.rd-trans, .rd-trans-pending'))) node.remove()
    if (translationMode === 'off') return
    if (translationMode === 'only') return
    for (const block of collectTranslationBlocks()) {
      const text = translationFor(translationMap, block.hash)
      if (!text) continue
      const div = document.createElement('div')
      div.className = 'rd-trans'
      div.textContent = text
      block.node.appendChild(div)
    }
  }, [doc, chapter, translationMode, translationLang, translationMap, layoutTick])

  React.useEffect(() => {
    if (!doc || doc.ext === '.pdf' || translationMode === 'off') return
    const root = contentRef.current
    if (!root) return
    const scroller = root.closest('.rd-main') || root.parentElement
    if (typeof IntersectionObserver !== 'function') {
      const blocks = collectTranslationBlocks(12)
      enqueueTranslationSegments(blocks.map((block) => ({ id: block.hash, text: block.text })))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const segments = []
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const text = normalizeBlockText(entry.target.textContent)
          if (text.length < 2) continue
          segments.push({ id: blockHash(text), text })
        }
        enqueueTranslationSegments(segments)
      },
      { root: scroller, rootMargin: '240px 0px', threshold: 0.01 },
    )
    for (const node of root.querySelectorAll('p, li, blockquote, h2, h3, h4, td')) {
      if (node.closest('.rd-trans, .rd-trans-pending, .rd-card')) continue
      observer.observe(node)
    }
    return () => observer.disconnect()
  }, [doc, chapter, translationMode, translationLang, translationFrom, layoutTick, translationTick])

  const generateGuide = async () => {
    if (!doc || !docKey) return
    setGuideBusy(true)
    setGuideError('')
    setGuideProgress(null)
    const controller = new AbortController()
    guideAbortRef.current = controller
    try {
      setGuideProgress({ phase: 'structure', done: 0, total: 1, title: t('label.guideAnalyzing') })
      const quickGuide = prefs.guideDepth === 'quick'
      const structureOptions = quickGuide ? { maxSections: 32, maxParts: 24, oneSectionPerPart: true } : {}
      let structure = null
      if (doc.ext === '.epub' && doc.epub) structure = epubGuideStructure(doc.epub, structureOptions)
      else if (doc.ext === '.pdf' && doc.pdf) {
        if (quickGuide) structure = await pdfGuideStructure(doc.pdf, structureOptions)
        else if (doc.pdf.structure) structure = doc.pdf.structure
        else if (doc.pdf.structurePromise) structure = (await doc.pdf.structurePromise) || (await pdfGuideStructure(doc.pdf, structureOptions))
        else structure = await pdfGuideStructure(doc.pdf, structureOptions)
      } else structure = markdownGuideStructure(decodeText(doc.bytes), structureOptions)
      const sections = (structure && structure.sections) || []
      const parts = (structure && structure.parts) || []
      if (sections.length === 0) throw new Error(t('label.noTextLayer'))
      const chars = sections.reduce((sum, section) => sum + String(section.text || '').length, 0)
      const tokens = Math.ceil(chars / 4)
      const steps = sections.length + parts.filter((part) => (part.sectionIds || []).length > 1).length + 1
      if (
        steps >= 5 &&
        !window.confirm(`${t('label.guideEstimate')} ${sections.length} 段 · ${parts.length} 篇 · ~${tokens} tokens`)
      ) {
        return
      }
      setGuideProgress({ phase: 'section', done: 0, total: sections.length, title: '' })
      const result = await api.guideStream(
        sessionId,
        { docKey, title: doc.name, sections, parts },
        { signal: controller.signal, onProgress: (event) => setGuideProgress(event) },
      )
      if (result.store) mergeStore(result.store)
      flash(`${t('label.guideDone')} · ${t('label.guideReused')} ${result.reused}`)
    } catch (e) {
      if (e && e.name === 'AbortError') flash(t('label.guideCancelled'))
      else setGuideError(String(e.message || e))
    } finally {
      setGuideBusy(false)
      setGuideProgress(null)
      guideAbortRef.current = null
    }
  }

  const jumpToSection = (section) => {
    if (!section) return
    // The fullscreen overlay hides the book; jumping to the source must reveal it.
    if (mapFullscreen) setMapFullscreen(false)
    if (doc?.ext === '.epub') {
      const match = String(section.id || '').match(/^(?:e|c)(\d+)/i)
      const index = Number.isFinite(section.chapter) ? section.chapter : match ? Number(match[1]) : NaN
      if (Number.isFinite(index) && doc.epub.chapters[index]) jumpToChapter(index)
      return
    }
    if (doc?.ext === '.pdf') {
      let page = Number.isFinite(section.page) ? section.page : null
      if (!page) {
        const match = String(section.id || '').match(/^(?:p|d)(\d+)/i)
        if (match) page = Number(match[1])
      }
      if (Number.isFinite(page) && page >= 1) jumpToPdfPage(page)
      return
    }
    const root = contentRef.current
    if (!root) return
    const base = String(section.title || '')
      .replace(/[（(]\d+[）)]\s*$/, '')
      .trim()
    if (!base) return
    const headings = Array.from(root.querySelectorAll('h1,h2,h3'))
    const target = headings.find((element) => {
      const text = (element.textContent || '').trim()
      return text === base || text.startsWith(base.slice(0, 12))
    })
    if (target) {
      target.scrollIntoView({ block: 'start' })
      pulseElement(target, pulseOptions())
    }
  }

  const downloadBlob = (blob, name) => {
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = name
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const guideBaseName = () => (doc?.name || 'guide').replace(/\.[^.]+$/, '')

  const exportGuideMd = () => {
    if (!guide) return
    downloadBlob(
      new Blob([guideMarkdown({ title: doc ? documentTitle(doc.name) : t('tab.guide'), guide })], { type: 'text/markdown' }),
      `${guideBaseName()}.guide.md`,
    )
  }

  const exportGuideSvg = () => {
    if (!svgRef.current) return
    const xml = new XMLSerializer().serializeToString(svgRef.current)
    downloadBlob(new Blob([xml], { type: 'image/svg+xml' }), `${guideBaseName()}.mindmap.svg`)
  }

  const exportGuidePng = () => {
    const svg = svgRef.current
    if (!svg) return
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = Number(svg.getAttribute('width')) || 800
      canvas.height = Number(svg.getAttribute('height')) || 600
      const context = canvas.getContext('2d')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)
      URL.revokeObjectURL(url)
      canvas.toBlob((png) => png && downloadBlob(png, `${guideBaseName()}.mindmap.png`), 'image/png')
    }
    image.src = url
  }

  const toggleCollapse = (id) => {
    setCollapsedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const renderMindmap = () => {
    if (!guideLayout || !guide) return null
    const byId = new Map(guideLayout.nodes.map((node) => [node.id, node]))
    const width = guideLayout.width + 60
    const height = guideLayout.height + 60
    const canvasWidth = Math.round(width * mapScale)
    const canvasHeight = Math.round(height * mapScale)
    const selected = guideLayout.nodes.find((node) => node.id === selectedNodeId) || null
    const motionState = mapMotionRef.current
    const enterAll = motionState.key !== guideSignature
    // The enter class only survives the entrance window: keeping it forever
    // would replay the full stagger whenever a collapsed branch remounts.
    const enterWindow = enterAll || Date.now() - motionState.enterAt < 400
    const bigMap = guideLayout.edges.length > 60
    const delayOf = (map, key, index, max) => staggerDelay(map.get(key) ?? index, 6, max)
    const nodeLines = (node) => (node.chunkIndex ? chunkNodeLines(node) : splitNodeTitle(node.title))

    const activateNode = (node) => {
      if (suppressMapClick.current) return
      // Selecting is stable: the detail stays above the map and the reader
      // only moves through the explicit jump button below it.
      setSelectedNodeId(node.id)
      if (node.hasChildren) toggleCollapse(node.id)
    }
    const onMapPointerDown = (event) => {
      if (event.button !== 0) return
      mapDragRef.current = {
        x: event.clientX,
        y: event.clientY,
        panX: mapPanRef.current.x,
        panY: mapPanRef.current.y,
        moved: false,
        captured: false,
      }
    }
    const onMapPointerMove = (event) => {
      const drag = mapDragRef.current
      if (!drag) return
      const dx = event.clientX - drag.x
      const dy = event.clientY - drag.y
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) <= 4) return
      if (!drag.moved) {
        // Capture only after the pointer actually moves: capturing on
        // pointerdown retargets the click and makes node clicks do nothing.
        drag.moved = true
      }
      if (!drag.captured) {
        drag.captured = true
        event.currentTarget.setPointerCapture?.(event.pointerId)
      }
      const next = clampMapPan({ x: drag.panX + dx, y: drag.panY + dy })
      mapPanRef.current = next
      setMapPan(next)
    }
    const onMapPointerUp = () => {
      const drag = mapDragRef.current
      mapDragRef.current = null
      if (drag && drag.moved) {
        suppressMapClick.current = true
        setTimeout(() => {
          suppressMapClick.current = false
        }, 0)
      }
    }

    return h(
      'div',
      { className: `rd-map-stage${mapFullscreen ? ' rd-map-stage-fullscreen' : ''}` },
      h(
        'div',
        { className: 'rd-map-toolbar' },
        h(
          'div',
          { className: 'rd-map-group' },
          h('button', { className: 'rd-map-btn', title: t('label.zoomOut'), onClick: () => setMapScale((value) => Math.max(0.6, Number((value - 0.1).toFixed(2)))) }, '−'),
          h('span', { className: 'rd-map-zoom' }, `${Math.round(mapScale * 100)}%`),
          h('button', { className: 'rd-map-btn', title: t('label.zoomIn'), onClick: () => setMapScale((value) => Math.min(1.8, Number((value + 0.1).toFixed(2)))) }, '+'),
          h('button', { className: 'rd-map-btn', onClick: () => setMapScale(1) }, '1:1'),
          h('button', { className: 'rd-map-btn', title: t('label.mapCenter'), onClick: centerMapPan }, '⌖'),
        ),
        h(
          'div',
          { className: 'rd-map-group' },
          h('button', { className: 'rd-map-btn', onClick: () => setCollapsedIds(new Set()) }, t('label.expandAll')),
          h(
            'button',
            {
              className: 'rd-map-btn',
              onClick: () =>
                setCollapsedIds(new Set(guideLayout.nodes.filter((node) => node.hasChildren && node.depth > 0).map((node) => node.id))),
            },
            t('label.collapseAll'),
          ),
        ),
        h('span', { className: 'rd-map-spacer' }),
        h(
          'div',
          { className: 'rd-map-group' },
          h('button', { className: 'rd-map-btn', onClick: exportGuideSvg }, 'SVG'),
          h('button', { className: 'rd-map-btn', onClick: exportGuidePng }, 'PNG'),
          h('button', { className: 'rd-map-btn', onClick: exportGuideMd }, 'MD'),
        ),
        h(
          'button',
          {
            className: 'rd-map-btn rd-map-fullscreen',
            title: mapFullscreen ? t('label.exitFullscreen') : t('label.fullscreen'),
            'aria-label': mapFullscreen ? t('label.exitFullscreen') : t('label.fullscreen'),
            onClick: () => setMapFullscreen((value) => !value),
          },
          mapFullscreen ? `× ${t('label.exitFullscreen')}` : t('label.fullscreen'),
        ),
      ),
      selected
        ? h(
            'div',
            { className: 'rd-map-detail' },
            h('div', { className: 'rd-map-detail-title' }, selected.title),
            selected.summary ? h('div', { className: 'rd-map-detail-summary' }, selected.summary) : null,
            (selected.keyPoints || []).length
              ? h('ul', { className: 'rd-map-detail-points' }, selected.keyPoints.map((point, index) => h('li', { key: index }, point)))
              : null,
            h(
              'button',
              { className: 'rd-btn', onClick: () => jumpToSection(selected) },
              t('label.jumpOriginal'),
            ),
          )
        : null,
      h(
        'div',
        {
          className: 'rd-map-scroll',
          ref: mapScrollRef,
          tabIndex: 0,
          'data-pan-x': mapPan.x,
          'data-pan-y': mapPan.y,
          style: mapGridVars({ pan: mapPan, scale: mapScale }),
          onKeyDown: (event) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
            event.preventDefault()
            event.stopPropagation()
            const step = event.key === 'ArrowLeft' ? 48 : event.key === 'ArrowRight' ? -48 : event.key === 'ArrowUp' ? 48 : -48
            const next = clampMapPan({
              x: mapPanRef.current.x + (event.key === 'ArrowLeft' || event.key === 'ArrowRight' ? step : 0),
              y: mapPanRef.current.y + (event.key === 'ArrowUp' || event.key === 'ArrowDown' ? step : 0),
            })
            mapPanRef.current = next
            setMapPan(next)
          },
          onPointerDown: onMapPointerDown,
          onPointerMove: onMapPointerMove,
          onPointerUp: onMapPointerUp,
          onPointerCancel: onMapPointerUp,
          onDoubleClick: (event) => {
            if (event.target && event.target.closest && event.target.closest('.rdm-node')) return
            centerMapPan()
          },
          title: t('label.mapHint'),
        },
        h(
          'div',
          {
            className: 'rd-map-canvas',
            ref: mapCanvasRef,
            style: { width: canvasWidth, height: canvasHeight, transform: `translate3d(${mapPan.x}px, ${mapPan.y}px, 0)` },
          },
        h(
          'svg',
          {
            ref: svgRef,
            width: canvasWidth,
            height: canvasHeight,
            viewBox: `0 0 ${canvasWidth} ${canvasHeight}`,
            xmlns: 'http://www.w3.org/2000/svg',
          },
          h(
            'style',
            null,
            '.rdm-label{font-size:11.5px;fill:var(--dsw-alias-label-primary,#1f2937);font-family:system-ui,sans-serif}.rdm-sub{font-size:11px;fill:var(--dsw-alias-label-secondary,#6b7280)}.rdm-node{fill:var(--dsw-alias-bg-layer-1,#f8fafc);stroke:var(--dsw-alias-border-l1,#d1d5db)}.rdm-root{fill:var(--dsw-alias-bg-layer-2,#eef2f7)}.rdm-node-selected{stroke:var(--dsw-alias-brand-primary,#3b82f6);stroke-width:2}.rdm-edge{stroke:var(--dsw-alias-border-l2,#9ca3af);stroke-width:1.4;fill:none}',
          ),
          h('g', {
            transform: `translate(30,30) scale(${mapScale})`,
            className: bigMap && enterWindow && (enterAll || motionState.faded) ? 'rdm-node-fade' : undefined,
          },
            guideLayout.edges.map((edge, edgeIndex) => {
              const from = byId.get(edge.from)
              const to = byId.get(edge.to)
              if (!from || !to) return null
              const x1 = from.x + MAP_NODE_WIDTH
              const y1 = from.y + MAP_NODE_HEIGHT / 2
              const x2 = to.x
              const y2 = to.y + MAP_NODE_HEIGHT / 2
              const mid = (x1 + x2) / 2
              const edgeKey = `${edge.from}-${edge.to}`
              const edgeMotion = !bigMap && enterWindow && (enterAll || motionState.enteredEdges.has(edgeKey))
              return h('path', {
                key: edgeKey,
                className: edgeMotion ? 'rdm-edge rdm-edge-enter' : 'rdm-edge',
                d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
                ...(edgeMotion
                  ? {
                      pathLength: 1,
                      strokeDasharray: '1',
                      strokeDashoffset: '1',
                      style: { animationDelay: `${delayOf(motionState.edgeDelays, edgeKey, edgeIndex, 80)}ms` },
                    }
                  : null),
              })
            }),
            guideLayout.nodes.map((node, nodeIndex) => {
              const lines = nodeLines(node)
              const isSelected = node.id === selectedNodeId
              const isNewNode = !motionState.seen.has(node.id)
              const nodeEnterClass = bigMap
                ? undefined
                : enterWindow && (enterAll || motionState.entered.has(node.id))
                  ? 'rdm-node-enter'
                  : isNewNode || motionState.fading.has(node.id)
                    ? 'rdm-node-fade'
                    : undefined
              const nodeEnterStyle =
                nodeEnterClass === 'rdm-node-enter'
                  ? { animationDelay: `${delayOf(motionState.nodeDelays, node.id, nodeIndex, 140)}ms` }
                  : undefined
              return h(
                'g',
                {
                  key: node.id,
                  transform: `translate(${node.x},${node.y})`,
                  'data-node-id': node.id,
                  style: { cursor: 'pointer' },
                },
                h('g', { className: nodeEnterClass, style: nodeEnterStyle },
                h('title', null, node.title || ''),
                h('rect', {
                  width: MAP_NODE_WIDTH,
                  height: MAP_NODE_HEIGHT,
                  rx: 10,
                  className: `rdm-node${node.depth === 0 ? ' rdm-root' : ''}${isSelected ? ' rdm-node-selected' : ''}`,
                  onClick: () => activateNode(node),
                }),
                h('text', {
                  x: 12,
                  y: lines.length > 1 ? 17 : 25,
                  className: 'rdm-label',
                  style: { pointerEvents: 'none' },
                }, lines[0]),
                lines[1]
                  ? h('text', {
                      x: 12,
                      y: 32,
                      className: 'rdm-label',
                      style: { pointerEvents: 'none' },
                    }, lines[1])
                  : null,
                node.hasChildren
                  ? h(
                      'g',
                      {
                        style: { cursor: 'pointer' },
                        onClick: (event) => {
                          event.stopPropagation()
                          setSelectedNodeId(node.id)
                          toggleCollapse(node.id)
                        },
                      },
                      h('rect', {
                        x: MAP_NODE_WIDTH - 30,
                        y: 0,
                        width: 30,
                        height: MAP_NODE_HEIGHT,
                        fill: 'transparent',
                      }),
                      h(
                        'text',
                        {
                          x: MAP_NODE_WIDTH - 18,
                          y: MAP_NODE_HEIGHT / 2 + 4,
                          className: 'rdm-sub',
                          style: { pointerEvents: 'none' },
                        },
                        node.collapsed ? '▸' : '▾',
                      ),
                    )
                  : null,
                ),
              )
            }),
          ),
        ),
        ),
      ),
    )
  }

  const jumpToOccurrence = async (occurrence) => {
    if (!occurrence) return
    if (occurrence.docKey !== docKey) {
      const target = store.docs?.[occurrence.docKey]
      const extension = target && target.path ? extOf(target.path) : ''
      if (!target || !target.path || !READABLE.has(extension)) {
        flash(t('label.occurrenceMissing'))
        return
      }
      await openDoc(
        { name: basename(target.path), path: target.path, ext: extension },
        { position: { chapter: occurrence.chapter, page: occurrence.page } },
      )
      setScrollTarget({ quote: occurrence.quote, occurrence: occurrence.occurrence || 0 })
      return
    }
    if (doc?.ext === '.pdf') {
      jumpToPdfPage(occurrence.page)
      return
    }
    setChapter(occurrence.chapter || 0)
    setScrollTarget({ quote: occurrence.quote, occurrence: occurrence.occurrence || 0 })
  }

  React.useEffect(() => {
    if (!pendingAnchor) return
    const target = document.getElementById(decodeURIComponent(pendingAnchor))
    if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start' })
    setPendingAnchor(null)
  }, [pendingAnchor, chapter, doc])

  React.useEffect(() => {
    if (!scrollTarget) return
    if (!doc || doc.ext === '.pdf') {
      setScrollTarget(null)
      return
    }
    const root = contentRef.current
    if (!root) return
    const found = findQuoteRange(root, scrollTarget.quote, scrollTarget.occurrence)
    if (found) {
      const node = found.range.startContainer
      const element = node.nodeType === 3 ? node.parentElement : node
      if (element && element.scrollIntoView) element.scrollIntoView({ block: 'center' })
      pulseRange(found.range, pulseOptions())
    }
    setScrollTarget(null)
  }, [scrollTarget, doc, chapter])

  React.useEffect(() => {
    if (drawer !== 'settings' || modelCatalog || !sessionId) return
    setModelBusy(true)
    api
      .models(sessionId)
      .then((catalog) => setModelCatalog(catalog))
      .catch(() => {})
      .finally(() => setModelBusy(false))
  }, [drawer, modelCatalog, sessionId])

  React.useEffect(() => {
    if (drawer !== 'concepts' || !focusConcept) return
    const row = document.querySelector(`[data-concept-id="${focusConcept}"]`)
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center' })
  }, [drawer, focusConcept])

  const renderToolbar = () => {
    const buttons = []
    if (doc) {
      buttons.push(
        h('button', { key: 'back', className: 'rd-btn ghost', onClick: back, title: t('action.back') }, '←'),
        h('span', { key: 'title', className: 'rd-title' }, doc.name),
        h(
          'button',
          {
            key: 'undo',
            className: 'rd-btn ghost rd-icon-btn',
            title: t('action.undo'),
            'aria-label': t('action.undo'),
            disabled: !historyRef.current || !historyRef.current.canUndo(),
            onClick: () => runHistory('undo'),
          },
          h(IconUndo),
        ),
        h(
          'button',
          {
            key: 'redo',
            className: 'rd-btn ghost rd-icon-btn',
            title: t('action.redo'),
            'aria-label': t('action.redo'),
            disabled: !historyRef.current || !historyRef.current.canRedo(),
            onClick: () => runHistory('redo'),
          },
          h(IconRedo),
        ),
      )
      if (doc.ext === '.pdf') {
        const step = prefs.pdfSpread ? 2 : 1
        const shown = prefs.pdfSpread && page + 1 <= doc.pdf.numPages ? `${page}-${page + 1}` : `${page}`
        buttons.push(
          h('button', { key: 'prev', className: 'rd-btn ghost', onClick: () => setPage((p) => Math.max(1, p - step)) }, '‹'),
          h('input', {
            key: 'page-input',
            ref: pageInputRef,
            className: 'rd-page-input',
            type: 'text',
            inputMode: 'numeric',
            'aria-label': t('label.page'),
            defaultValue: String(page),
            onFocus: (event) => event.target.select(),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                const next = parsePageInput(event.target.value, doc.pdf.numPages)
                if (next !== null) setPage(next)
                event.target.blur()
              } else if (event.key === 'Escape') {
                event.target.value = String(page)
                event.target.blur()
              }
            },
          }),
          h(
            'span',
            { key: 'page', className: 'rd-muted', style: { fontSize: '12px' } },
            `${shown} / ${doc.pdf.numPages}`,
          ),
          h('button', { key: 'next', className: 'rd-btn ghost', onClick: () => setPage((p) => Math.min(doc.pdf.numPages, p + step)) }, '›'),
        )
      }
      if (doc.ext === '.epub') {
        buttons.push(
          h('button', { key: 'prev', className: 'rd-btn ghost', onClick: () => { if (chapter > 0) goChapter(chapter - 1, 'bottom') } }, '‹'),
          h('span', { key: 'chapter', className: 'rd-muted', style: { fontSize: '12px' } }, `${chapter + 1} / ${doc.epub.chapters.length}`),
          h('button', { key: 'next', className: 'rd-btn ghost', onClick: () => { if (chapter < doc.epub.chapters.length - 1) goChapter(chapter + 1, 'top') } }, '›'),
        )
      }
      buttons.push(h('span', { key: 'spacer', className: 'rd-spacer' }))
      if (doc.ext !== '.pdf') {
        buttons.push(
          h(
            'button',
            {
              key: 'font-',
              className: 'rd-btn ghost',
              onClick: () => changePrefs({ fontSize: Math.max(14, (prefs.fontSize || fontSize) - 1) }),
            },
            'A−',
          ),
          h(
            'button',
            {
              key: 'font+',
              className: 'rd-btn ghost',
              onClick: () => changePrefs({ fontSize: Math.min(26, (prefs.fontSize || fontSize) + 1) }),
            },
            'A+',
          ),
        )
      } else {
        buttons.push(
          h('button', { key: 'zoom-', className: 'rd-btn ghost', onClick: () => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2))) }, '−'),
          h('button', { key: 'zoom+', className: 'rd-btn ghost', onClick: () => setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2))) }, '+'),
        )
      }
      buttons.push(
        h('button', { key: 'toc', className: 'rd-btn', 'aria-pressed': drawer === 'toc', onClick: () => setDrawer(drawer === 'toc' ? null : 'toc') }, t('tab.toc')),
        h('button', { key: 'anno', className: 'rd-btn', 'aria-pressed': drawer === 'anno', onClick: () => setDrawer(drawer === 'anno' ? null : 'anno') }, t('tab.anno')),
        h(
          'button',
          {
            key: 'concepts',
            className: 'rd-btn',
            'aria-pressed': drawer === 'concepts',
            onClick: () => {
              setDrawer(drawer === 'concepts' ? null : 'concepts')
              setQuery('')
              setFocusConcept(null)
            },
          },
          t('tab.concepts'),
        ),
        h(ChatToolbarButton, {
          key: 'chat',
          t,
          open: drawer === 'chat',
          onToggle: () => setDrawer(drawer === 'chat' ? null : 'chat'),
          useChat: props.useChat,
        }),
        h(
          'button',
          {
            key: 'translate',
            className: 'rd-btn ghost',
            title: `${t('action.translate')} · ${t(`translation.mode.${translationMode}`)}`,
            'aria-label': t('action.translate'),
            'aria-pressed': doc && doc.ext === '.pdf' ? drawer === 'translate' : translationMode !== 'off',
            onClick: toggleTranslation,
          },
          translationBusy ? '…' : t('action.translateShort'),
        ),
        h(
          'button',
          {
            key: 'search',
            className: 'rd-btn ghost',
            title: t('action.search'),
            'aria-label': t('action.search'),
            onClick: () => setSearchOpen(true),
            className: 'rd-btn ghost rd-icon-btn',
          },
          h(IconSearch),
        ),
        h(
          'button',
          {
            key: 'guide',
            className: 'rd-btn',
            'aria-pressed': drawer === 'guide',
            onClick: () => setDrawer(drawer === 'guide' ? null : 'guide'),
          },
          t('tab.guide'),
        ),
        h(
          'button',
          {
            key: 'settings',
            className: 'rd-btn ghost rd-icon-btn',
            title: t('label.settings'),
            'aria-label': t('label.settings'),
            'aria-pressed': drawer === 'settings',
            onClick: () => setDrawer(drawer === 'settings' ? null : 'settings'),
          },
          h(IconSettings),
        ),
      )
    } else {
      buttons.push(h('span', { key: 'title', className: 'rd-title' }, t('library.title')))
      buttons.push(h('span', { key: 'spacer', className: 'rd-spacer' }))
    }
    return h('div', { className: 'rd-toolbar' }, buttons)
  }

  const renderLibrary = () => {
    const parts = dir === '.' ? [] : normalizeRelPath(dir).split('/')
    const trail = [{ label: '…', path: '.' }]
    let acc = ''
    for (const part of parts) {
      acc = acc ? acc + '/' + part : part
      trail.push({ label: part, path: acc })
    }
    const readable = entries.filter((entry) => entry.type === 'dir' || READABLE.has(extOf(entry.name)))
    return h(
      'div',
      { className: 'rd-main' },
      h(
        'div',
        { className: 'rd-library' },
        h('h2', null, t('library.title')),
        h('div', { className: 'rd-muted', style: { fontSize: '12.5px' } }, t('library.hint')),
        h(
          'div',
          { className: 'rd-crumb' },
          trail.map((item, i) =>
            h(
              'span',
              { key: item.path + i },
              i > 0 ? h('span', { className: 'rd-muted' }, ' / ') : null,
              h('button', { onClick: () => navigate(item.path) }, item.label),
            ),
          ),
        ),
        readable.length === 0
          ? h('div', { className: 'rd-empty' }, t('library.empty'))
          : h(
              'div',
              { className: 'rd-list' },
              readable.map((entry) =>
                h(
                  'div',
                  {
                    key: entry.path,
                    className: 'rd-entry',
                    'data-activate': '1',
                    tabIndex: 0,
                    role: 'button',
                    onClick: () => (entry.type === 'dir' ? navigate(entry.path) : openDoc(entry)),
                  },
                  h('span', { className: 'rd-ext' }, entry.type === 'dir' ? 'DIR' : extOf(entry.name).slice(1)),
                  h('span', { className: 'rd-name' }, entry.name),
                ),
              ),
            ),
      ),
    )
  }

  const renderedHtml = React.useMemo(() => {
    if (!doc || doc.ext === '.pdf') return ''
    if (doc.ext === '.epub') return (doc.epub.chapters[chapter] || {}).html || ''
    return markdownRender(decodeText(doc.bytes), { resolveImage: markdownImageResolver(sessionId, doc) })
  }, [doc, chapter])

  const translatedOnlyHtml = React.useMemo(() => {
    if (!doc || doc.ext === '.pdf' || translationMode !== 'only') return ''
    return buildTranslatedHtml(renderedHtml, (text) => translationFor(translationMap, blockHash(text)))
  }, [doc, chapter, renderedHtml, translationMode, translationMap])

  const renderContent = () => {
    if (!doc) return renderLibrary()
    if (doc.ext === '.pdf') {
      return h(PdfPane, {
        doc,
        page,
        zoom,
        annotations: docAnnotations,
        concepts,
        contentRef,
        spread: Boolean(prefs.pdfSpread),
      })
    }
    const html = translationMode === 'only' ? translatedOnlyHtml : renderedHtml
    return h(
      'div',
      { className: 'rd-reader-wrap' },
      translationMode !== 'off' ? renderTranslateBar() : null,
      h(
        'div',
        { className: 'rd-main' },
        h('div', {
          className: 'rd-page rd-prose',
          ref: contentRef,
          onClick: onContentClick,
          dangerouslySetInnerHTML: { __html: html },
        }),
      ),
    )
  }

  // One shell for every drawer tab: resizer + title bar + scrolling body.
  // Mirrors the original per-branch markup so existing tabs keep their output.
  const renderDrawerShell = (title, body, options = {}) => {
    const drawerMotion = motionOn ? (drawerWidthMotion(doc) ? 'open' : 'content') : undefined
    return h(
      'div',
      {
        className: `rd-drawer${options.wide ? ' rd-drawer-wide' : ''}`,
        'data-motion': drawerMotion,
        style: { flexBasis: `${drawerWidth}px`, width: `${drawerWidth}px`, maxWidth: `${drawerWidth}px` },
      },
      h('div', {
        className: 'rd-drawer-resizer',
        role: 'separator',
        tabIndex: 0,
        'aria-orientation': 'vertical',
        'aria-label': t('label.resizeSidebar'),
        'aria-valuemin': drawerWidthMin,
        'aria-valuemax': drawerMaxWidth(),
        'aria-valuenow': Math.round(drawerWidth),
        title: t('label.resizeSidebar'),
        onPointerDown: startDrawerResize,
        onPointerMove: moveDrawerResize,
        onPointerUp: endDrawerResize,
        onPointerCancel: endDrawerResize,
        onDoubleClick: resetDrawerWidth,
        onKeyDown: (event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          commitDrawerWidth(drawerWidth + (event.key === 'ArrowLeft' ? 24 : -24))
        },
      }),
      h(
        'div',
        { className: 'rd-drawer-head' },
        h('span', { style: { fontSize: '12.5px', fontWeight: 600 } }, title),
        options.subtitle ? h('span', { className: 'rd-drawer-sub' }, options.subtitle) : null,
        h('span', { className: 'rd-spacer' }),
        options.actions ? h('div', { className: 'rd-drawer-head-actions' }, options.actions) : null,
        h('button', { className: 'rd-btn ghost', onClick: () => setDrawer(null) }, '×'),
      ),
      h(
        'div',
        {
          className: `rd-drawer-body${options.bodyClassName ? ` ${options.bodyClassName}` : ''}`,
          ref: drawerBodyRef,
          onScroll: (event) => {
            if (drawer) drawerScroll.current[drawerViewKey] = event.currentTarget.scrollTop
          },
        },
        h('div', { key: drawerViewKey || 'pane', className: 'rd-drawer-pane' }, body),
      ),
    )
  }

  const renderDrawer = () => {
    if (!drawer || !doc) return null
    let body = null
    if (drawer === 'toc') {
      if (doc.ext === '.epub') {
        body = doc.epub.chapters.map((item, index) =>
          h(
            'div',
            {
              key: index,
              className: 'rd-drawer-item',
              'data-activate': '1',
              tabIndex: 0,
              role: 'button',
              style: index === chapter ? { borderColor: 'var(--dsw-alias-brand-primary)' } : undefined,
              onClick: () => jumpToChapter(index),
            },
            item.label || `${t('label.chapter')} ${index + 1}`,
          ),
        )
      } else if (doc.ext === '.pdf') {
        if (doc.pdf.structureReady === false) {
          return renderDrawerShell(t('tab.toc'), h('div', { className: 'rd-empty' }, t('label.analyzingOutline')))
        }
        const outline = doc.pdf.tocReliable ? doc.pdf.toc || [] : []
        const fallbackChapters = !doc.pdf.tocReliable && doc.pdf.structure ? doc.pdf.structure.chapters || [] : []
        if (outline.length > 0) {
          body = outline.map((entry, index) =>
            h(
              'div',
              {
                key: index,
                className: 'rd-drawer-item',
                'data-activate': '1',
                tabIndex: 0,
                role: 'button',
                style: {
                  paddingLeft: 10 + (Math.max(1, entry.level) - 1) * 12,
                  ...(entry.page === page ? { borderColor: 'var(--dsw-alias-brand-primary)' } : {}),
                },
                onClick: () => entry.page && jumpToPdfPage(entry.page),
              },
              h('span', null, entry.title),
              entry.page ? h('span', { className: 'rd-muted', style: { marginLeft: '8px', fontSize: '11px' } }, entry.page) : null,
            ),
          )
        } else if (fallbackChapters.length > 0) {
          body = fallbackChapters.map((chapter, index) =>
            h(
              'div',
              {
                key: index,
                className: 'rd-drawer-item',
                'data-activate': '1',
                tabIndex: 0,
                role: 'button',
                style:
                  page >= chapter.page && page <= (chapter.end || chapter.page)
                    ? { borderColor: 'var(--dsw-alias-brand-primary)' }
                    : undefined,
                onClick: () => jumpToPdfPage(chapter.page),
              },
              h('span', null, chapter.title),
              chapter.page
                ? h('span', { className: 'rd-muted', style: { marginLeft: '8px', fontSize: '11px' } }, chapter.page)
                : null,
            ),
          )
        } else {
          const groups = []
          for (let start = 1; start <= doc.pdf.numPages; start += 20) {
            groups.push({ start, end: Math.min(doc.pdf.numPages, start + 19) })
          }
          body = groups.map((group, index) =>
            h(
              'div',
              {
                key: index,
                className: 'rd-drawer-item',
                'data-activate': '1',
                tabIndex: 0,
                role: 'button',
                style: page >= group.start && page <= group.end ? { borderColor: 'var(--dsw-alias-brand-primary)' } : undefined,
                onClick: () => jumpToPdfPage(group.start),
              },
              `${group.start}-${group.end}`,
            ),
          )
        }
      } else {
        const heads = headingsOf(decodeText(doc.bytes))
        body = heads.length
          ? heads.map((head, index) =>
              h(
                'div',
                {
                  key: index,
                  className: 'rd-drawer-item',
                  'data-activate': '1',
                  tabIndex: 0,
                  role: 'button',
                  style: { paddingLeft: 10 + (head.level - 1) * 10 },
                  onClick: () => {
                    const root = contentRef.current
                    const elements = root ? root.querySelectorAll('h1,h2,h3') : []
                    if (elements[index]) {
                      elements[index].scrollIntoView({ block: 'start' })
                      pulseElement(elements[index], pulseOptions())
                    }
                  },
                },
                head.label,
              ),
            )
          : h('div', { className: 'rd-empty' }, '—')
      }
    }
    if (drawer === 'translate') {
      if (doc.ext !== '.pdf') {
        body = h(
          'div',
          { className: 'rd-empty' },
          t('label.translateMarkdownHint'),
        )
      } else {
        body = h(
          'div',
          null,
          renderLanguageControls('rd-lang-controls-drawer'),
          h(
            'div',
            { className: 'rd-actions', style: { marginTop: '8px', marginBottom: '8px' } },
            h('span', { className: 'rd-muted', style: { fontSize: '12px' } }, `${t('label.page')} ${page}`),
            h('span', { className: 'rd-spacer' }),
            translationPending > 0
              ? h('span', { className: 'rd-muted', style: { fontSize: '11px' } }, `${t('label.translatePending')} ${translationPending}`)
              : null,
            h(
              'button',
              { className: 'rd-btn', disabled: pdfTranslating, onClick: translatePdfPage },
              pdfTranslating ? t('label.translating') : t('action.translatePage'),
            ),
          ),
          pdfBlocks.length === 0
            ? h('div', { className: 'rd-empty' }, t('label.translating'))
            : pdfBlocks.map((block) => {
                const translated = translationFor(translationMap, blockHash(block.text))
                return h(
                  'div',
                  { key: block.id, className: 'rd-drawer-item' },
                  h(
                    'div',
                    { className: 'rd-muted', style: { fontSize: '11.5px', lineHeight: 1.55 } },
                    block.text.slice(0, 260),
                  ),
                  h(
                    'div',
                    { style: { marginTop: '5px', fontSize: '13px', lineHeight: 1.6 } },
                    translated || t('label.untranslated'),
                  ),
                )
              }),
        )
      }
    }
    if (drawer === 'anno') {
      body = docAnnotations.length
        ? docAnnotations.map((annotation) =>
            h(
              'div',
              { key: annotation.id, className: 'rd-drawer-item', 'data-activate': '1', tabIndex: 0, role: 'button', onClick: () => focusAnnotation(annotation) },
              h('div', { className: 'rd-muted' }, '“' + String(annotation.quote || '').slice(0, 70) + '”'),
              annotation.note ? h('div', { style: { marginTop: '4px' } }, annotation.note) : null,
              lostMarks.includes(annotation.id)
                ? h('div', { className: 'rd-error', style: { marginTop: '4px', fontSize: '11.5px' } }, t('label.anchorLost'))
                : null,
              h(
                'div',
                { style: { marginTop: '6px' } },
                h(
                  'button',
                  {
                    className: 'rd-btn ghost',
                    onClick: (event) => {
                      event.stopPropagation()
                      removeAnnotation(annotation.id)
                    },
                  },
                  t('action.delete'),
                ),
              ),
            ),
          )
        : h('div', { className: 'rd-empty' }, t('label.noAnnotations'))
    }
    if (drawer === 'concepts') {
      const docConcepts = conceptsForDoc(concepts, docKey)
      const effectiveScope = conceptScope || (docConcepts.length > 0 ? 'doc' : 'all')
      const source = effectiveScope === 'doc' ? docConcepts : concepts
      const list = source
        .filter((concept) => !query || (concept.term + ' ' + (concept.definition || '')).toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) =>
          conceptSort === 'alpha'
            ? String(a.term || '').localeCompare(String(b.term || ''), 'zh')
            : (b.createdAt || 0) - (a.createdAt || 0),
        )
      body = h(
        'div',
        null,
        h(
          'div',
          { className: 'rd-actions', style: { marginTop: 0, marginBottom: '8px' } },
          h(
            'button',
            {
              className: 'rd-btn',
              'data-scope': 'doc',
              'aria-pressed': effectiveScope === 'doc',
              onClick: () => setConceptScope('doc'),
            },
            `${t('label.scopeDoc')} (${docConcepts.length})`,
          ),
          h(
            'button',
            {
              className: 'rd-btn',
              'data-scope': 'all',
              'aria-pressed': effectiveScope === 'all',
              onClick: () => setConceptScope('all'),
            },
            `${t('label.scopeAll')} (${concepts.length})`,
          ),
        ),
        h(
          'select',
          {
            className: 'rd-select',
            style: { marginBottom: '8px' },
            value: conceptSort,
            onChange: (event) => setConceptSort(event.target.value),
          },
          h('option', { value: 'recent' }, t('label.sortRecent')),
          h('option', { value: 'alpha' }, t('label.sortAlpha')),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '6px', marginBottom: '10px' } },
          h('input', {
            className: 'rd-input',
            style: { flex: 1 },
            placeholder: t('label.search'),
            value: query,
            onChange: (event) => setQuery(event.target.value),
          }),
          query
            ? h('button', { className: 'rd-btn', 'data-action': 'clear-filter', onClick: () => setQuery('') }, '×')
            : null,
        ),
        list.length === 0 && effectiveScope === 'doc'
          ? h('div', { className: 'rd-empty' }, t('label.scopeEmpty'))
          : list.length
          ? list.map((concept) =>
              h(
                'div',
                {
                  key: concept.id,
                  'data-concept-id': concept.id,
                  className: 'rd-drawer-item',
                  'data-activate': '1',
                  tabIndex: 0,
                  role: 'button',
                  style:
                    concept.id === focusConcept
                      ? { borderColor: 'var(--dsw-alias-brand-primary)' }
                      : undefined,
                  onClick: () => {
                    setDeleteConceptId(null)
                    setCards([
                      { id: concept.id, pinned: true, rect: { left: 260, top: 140, right: 260, bottom: 140 } },
                    ])
                  },
                },
                h(
                  'div',
                  { className: 'rd-drawer-row-head' },
                  h('div', { style: { fontWeight: 600 } }, concept.term),
                  h(
                    'button',
                    {
                      className: 'rd-btn ghost rd-row-delete',
                      title: t('label.deleteConcept'),
                      'aria-label': t('label.deleteConcept'),
                      onClick: (event) => {
                        event.stopPropagation()
                        setDeleteConceptId(deleteConceptId === concept.id ? null : concept.id)
                      },
                    },
                    '×',
                  ),
                ),
                h('div', { className: 'rd-muted', style: { marginTop: '3px' } }, String(concept.definition || '').slice(0, 90)),
                deleteConceptId === concept.id
                  ? h(
                      'div',
                      { className: 'rd-drawer-confirm', onClick: (event) => event.stopPropagation() },
                      h('div', { className: 'rd-muted', style: { marginTop: '6px' } }, t('label.deleteConceptConfirm')),
                      h('div', { className: 'rd-muted', style: { fontSize: '11px', marginTop: '2px' } }, t('label.deleteConceptChildren')),
                      h(
                        'div',
                        { style: { display: 'flex', gap: '6px', marginTop: '6px' } },
                        h(
                          'button',
                          {
                            className: 'rd-btn rd-danger',
                            'data-action': 'confirm-delete-concept',
                            onClick: (event) => {
                              event.stopPropagation()
                              removeConcept(concept.id)
                            },
                          },
                          t('action.delete'),
                        ),
                        h(
                          'button',
                          {
                            className: 'rd-btn ghost',
                            'data-action': 'cancel-delete-concept',
                            onClick: (event) => {
                              event.stopPropagation()
                              setDeleteConceptId(null)
                            },
                          },
                          t('action.cancel'),
                        ),
                      ),
                    )
                  : null,
                h(
                  'button',
                  {
                    className: 'rd-btn ghost',
                    style: { marginTop: '6px', paddingLeft: 0 },
                    onClick: (event) => {
                      event.stopPropagation()
                      setOccurrencesOpen(occurrencesOpen === concept.id ? null : concept.id)
                    },
                  },
                  `${t('label.occurrences')} · ${(concept.occurrences || []).length}`,
                ),
                occurrencesOpen === concept.id
                  ? (concept.occurrences || []).map((occurrence, index) =>
                      h(
                        'div',
                        {
                          key: index,
                          className: 'rd-muted',
                          style: { fontSize: '11.5px', marginTop: '4px', cursor: 'pointer' },
                          onClick: (event) => {
                            event.stopPropagation()
                            jumpToOccurrence(occurrence)
                          },
                        },
                        `${store.docs?.[occurrence.docKey]?.path || occurrence.docKey} · ${t('label.chapter')} ${(occurrence.chapter || 0) + 1}`,
                      ),
                    )
                  : null,
              ),
            )
          : h(
              'div',
              { className: 'rd-empty' },
              h('div', null, query ? t('label.noMatch') : t('label.noConcepts')),
              query
                ? h(
                    'button',
                    { className: 'rd-btn', 'data-action': 'clear-filter', onClick: () => setQuery('') },
                    t('action.clearFilter'),
                  )
                : null,
            ),
      )
    }
    if (drawer === 'guide') {
      if (guideBusy) {
        body = h(
          'div',
          { className: 'rd-empty' },
          guideProgress
            ? `${
                guideProgress.phase === 'structure'
                  ? t('label.guideAnalyzing')
                  : guideProgress.phase === 'part'
                    ? t('label.guidePart')
                    : t('label.guideSection')
              } ${guideProgress.done}/${guideProgress.total}${
                guideProgress.title ? ` · ${guideProgress.title}` : ''
              }`
            : t('label.guideBusy'),
          h(
            'button',
            {
              className: 'rd-btn',
              style: { marginTop: '10px' },
              onClick: () => guideAbortRef.current && guideAbortRef.current.abort(),
            },
            t('action.stop'),
          ),
        )
      } else if (guideError) {
        body = h(
          'div',
          { className: 'rd-empty' },
          h('div', { className: 'rd-error' }, guideError),
          h('button', { className: 'rd-btn', onClick: generateGuide }, t('action.retry')),
        )
      } else if (!guide) {
        body = h(
          'div',
          { className: 'rd-empty' },
          h('div', null, t('label.guideEmpty')),
          h('button', { className: 'rd-btn', onClick: generateGuide, style: { marginTop: '10px' } }, t('action.generateGuide')),
        )
      } else {
        const list = h(
          'div',
          null,
          h('div', { className: 'rd-guide-synopsis' }, guide.synopsis),
          (guide.questions || []).length
            ? h(
                'ul',
                { className: 'rd-guide-questions' },
                guide.questions.map((question) => h('li', { key: question }, question)),
              )
            : null,
          (() => {
            const sectionRow = (section) =>
              h(
                'div',
                { key: section.id, className: 'rd-drawer-item', 'data-activate': '1', tabIndex: 0, role: 'button', onClick: () => jumpToSection(section) },
                h('div', { style: { fontWeight: 600 } }, section.title),
                h('div', { className: 'rd-muted', style: { marginTop: '3px' } }, section.summary),
                (section.keyPoints || []).length
                  ? h(
                      'div',
                      { className: 'rd-muted', style: { fontSize: '11px', marginTop: '4px' } },
                      section.keyPoints.join(' · '),
                    )
                  : null,
              )
            const parts = guide.parts || []
            if (parts.length === 0) return (guide.sections || []).map(sectionRow)
            const byId = new Map((guide.sections || []).map((section) => [section.id, section]))
            return parts.map((part) => {
              const sections = (part.sectionIds || []).map((id) => byId.get(id)).filter(Boolean)
              if (sections.length === 1) {
                const only = sections[0]
                return h(
                  'div',
                  {
                    key: part.id,
                    className: 'rd-drawer-item',
                    'data-activate': '1',
                    tabIndex: 0,
                    role: 'button',
                    onClick: () => jumpToSection(only),
                  },
                  h('div', { style: { fontWeight: 600 } }, part.title || only.title),
                  part.summary || only.summary
                    ? h('div', { className: 'rd-muted', style: { marginTop: '3px' } }, part.summary || only.summary)
                    : null,
                  (only.keyPoints || []).length
                    ? h('div', { className: 'rd-muted', style: { fontSize: '11px', marginTop: '4px' } }, only.keyPoints.join(' · '))
                    : null,
                )
              }
              return h(
                'div',
                { key: part.id, className: 'rd-part' },
                h(
                  'div',
                  {
                    className: 'rd-part-title',
                    'data-activate': '1',
                    tabIndex: 0,
                    role: 'button',
                    style: { cursor: 'pointer' },
                    onClick: () => sections[0] && jumpToSection(sections[0]),
                  },
                  part.title,
                ),
                part.summary ? h('div', { className: 'rd-part-summary' }, part.summary) : null,
                sections.map((section) => sectionRow(section)),
              )
            })
          })(),
        )
        body = h(
          'div',
          null,
          h(
            'div',
            { className: 'rd-actions', style: { marginTop: 0, marginBottom: '8px' } },
            h(
              'button',
              { className: 'rd-btn', 'aria-pressed': guideView === 'list', onClick: () => setGuideView('list') },
              t('label.listView'),
            ),
            h(
              'button',
              { className: 'rd-btn', 'aria-pressed': guideView === 'map', onClick: () => setGuideView('map') },
              t('label.mapView'),
            ),
            h('span', { className: 'rd-spacer' }),
            h('button', { className: 'rd-btn', onClick: generateGuide }, t('action.regenerateGuide')),
          ),
          guideView === 'map' ? (mapFullscreen ? null : renderMindmap()) : list,
        )
      }
    }
    if (drawer === 'settings') {
      const row = (label, control) =>
        h('div', { className: 'rd-setting-row' }, h('span', null, label), control)
      body = h(
        'div',
        null,
        row(
          t('label.fontSize'),
          h(
            'div',
            { className: 'rd-actions', style: { margin: 0 } },
            h('button', { className: 'rd-btn', onClick: () => changePrefs({ fontSize: Math.max(14, (prefs.fontSize || 18) - 1) }) }, 'A−'),
            h('span', { className: 'rd-muted' }, String(prefs.fontSize || 18)),
            h('button', { className: 'rd-btn', onClick: () => changePrefs({ fontSize: Math.min(26, (prefs.fontSize || 18) + 1) }) }, 'A+'),
          ),
        ),
        row(
          t('label.lineHeight'),
          h(
            'div',
            { className: 'rd-actions', style: { margin: 0 } },
            h('button', { className: 'rd-btn', onClick: () => changePrefs({ lineHeight: Math.max(1.2, Number(((prefs.lineHeight || 1.85) - 0.05).toFixed(2))) }) }, '−'),
            h('span', { className: 'rd-muted' }, String(prefs.lineHeight || 1.85)),
            h('button', { className: 'rd-btn', onClick: () => changePrefs({ lineHeight: Math.min(2.4, Number(((prefs.lineHeight || 1.85) + 0.05).toFixed(2))) }) }, '+'),
          ),
        ),
        row(
          t('label.hoverDelay'),
          h(
            'div',
            { className: 'rd-actions', style: { margin: 0 } },
            h('button', { className: 'rd-btn', onClick: () => changePrefs({ hoverDelay: Math.max(80, (prefs.hoverDelay || 150) - 40) }) }, '−'),
            h('span', { className: 'rd-muted' }, `${prefs.hoverDelay || 150}ms`),
            h('button', { className: 'rd-btn', onClick: () => changePrefs({ hoverDelay: Math.min(600, (prefs.hoverDelay || 150) + 40) }) }, '+'),
          ),
        ),
        row(
          t('label.guideDepth'),
          h(
            'select',
            {
              className: 'rd-select',
              value: prefs.guideDepth || 'standard',
              onChange: (event) => changePrefs({ guideDepth: event.target.value }),
            },
            ['quick', 'standard'].map((value) => h('option', { key: value, value }, t(`guideDepth.${value}`))),
          ),
        ),
        row(
          t('label.translateFrom'),
          h(
            'select',
            {
              className: 'rd-select',
              value: translationFrom,
              onChange: (event) => changePrefs({ translateFrom: event.target.value }),
            },
            TRANSLATE_SOURCES.map((value) => h('option', { key: value, value }, t(`lang.${value}`))),
          ),
        ),
        row(
          t('label.translateTo'),
          h(
            'select',
            {
              className: 'rd-select',
              value: translationLang,
              onChange: (event) => changePrefs({ translateTo: event.target.value }),
            },
            TRANSLATE_TARGETS.map((value) => h('option', { key: value, value }, t(`lang.${value}`))),
          ),
        ),
        row(
          t('label.explainModel'),
          modelBusy
            ? h('span', { className: 'rd-muted' }, '…')
            : h(
                'select',
                {
                  className: 'rd-select',
                  value: prefs.model ? `${prefs.model.provider}\u0000${prefs.model.model}` : '',
                  onChange: (event) => {
                    const value = event.target.value
                    if (!value) {
                      changePrefs({ model: null })
                      return
                    }
                    const [provider, model] = value.split('\u0000')
                    changePrefs({ model: { provider, model } })
                  },
                },
                h('option', { value: '' }, t('label.defaultModel')),
                (modelCatalog?.providers || []).flatMap((provider) =>
                  (provider.models || []).map((model) =>
                    h(
                      'option',
                      { key: `${provider.id}-${model.id}`, value: `${provider.id}\u0000${model.id}` },
                      `${provider.name} · ${model.name}`,
                    ),
                  ),
                ),
              ),
        ),
        row(
          t('label.theme'),
          h(
            'select',
            {
              className: 'rd-select',
              value: prefs.theme || 'system',
              onChange: (event) => changePrefs({ theme: event.target.value }),
            },
            ['system', 'light', 'dark', 'sepia'].map((value) =>
              h('option', { key: value, value }, t(`theme.${value}`)),
            ),
          ),
        ),
        row(
          t('label.pageKeys'),
          h(
            'select',
            {
              className: 'rd-select',
              value: prefs.pageKeys || 'arrows',
              onChange: (event) => changePrefs({ pageKeys: event.target.value }),
            },
            ['arrows', 'jk'].map((value) => h('option', { key: value, value }, t(`keys.${value}`))),
          ),
        ),
        row(
          t('label.pdfSpread'),
          h('input', {
            type: 'checkbox',
            checked: Boolean(prefs.pdfSpread),
            onChange: (event) => changePrefs({ pdfSpread: event.target.checked }),
          }),
        ),
        row(
          t('label.recentSent'),
          sentLog.length === 0
            ? h('span', { className: 'rd-muted' }, t('label.noSent'))
            : h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px' } },
                sentLog.map((entry, index) =>
                  h(
                    'div',
                    { key: index, className: 'rd-muted' },
                    `${new Date(entry.at).toLocaleTimeString()} · ${entry.kind} · ${entry.preview}`,
                  ),
                ),
              ),
        ),
        row(
          t('label.data'),
          h(
            'div',
            { className: 'rd-actions', style: { margin: 0 } },
            h('button', { className: 'rd-btn', onClick: exportStore }, t('action.exportJson')),
            h('button', { className: 'rd-btn', onClick: () => importInputRef.current && importInputRef.current.click() }, t('action.importJson')),
            h('button', { className: 'rd-btn', onClick: exportMarks }, t('action.exportMarks')),
            h('button', { className: 'rd-btn', onClick: restoreLatest }, t('action.restore')),
            h('input', {
              type: 'file',
              accept: 'application/json',
              ref: importInputRef,
              style: { display: 'none' },
              onChange: onImportFile,
            }),
          ),
        ),
        row(
          t('label.cardTrigger'),
          h(
            'select',
            {
              className: 'rd-select',
              value: prefs.cardTrigger || 'hover',
              onChange: (event) => changePrefs({ cardTrigger: event.target.value }),
            },
            ['hover', 'click', 'off'].map((value) =>
              h('option', { key: value, value }, t(`trigger.${value}`)),
            ),
          ),
        ),
      )
    }
    if (drawer === 'chat') {
      body = h(ReaderChatPanel, {
        t,
        doc,
        showAll: chatShowAll,
        attachments: attachmentResolver,
        useChat: props.useChat,
        useInput: props.useInput,
        useSession: props.useSession,
        openView: props.openView,
      })
    }
    const titles = {
      toc: t('tab.toc'),
      anno: t('tab.anno'),
      concepts: `${t('tab.concepts')} · ${concepts.length}`,
      guide: t('tab.guide'),
      translate: t('tab.translate'),
      chat: t('tab.chat'),
      settings: t('label.settings'),
    }
    const chatActions =
      drawer === 'chat'
        ? [
            h(
              'button',
              {
                key: 'chat-history',
                className: `rd-btn ghost rd-icon-btn rd-drawer-head-btn${chatShowAll ? ' is-on' : ''}`,
                'data-chat-action': 'toggle-all',
                'aria-pressed': chatShowAll ? 'true' : 'false',
                'aria-label': t(chatShowAll ? 'label.chatCollapse' : 'label.chatShowAll'),
                title: t(chatShowAll ? 'label.chatCollapse' : 'label.chatShowAll'),
                onClick: () => setChatShowAll((current) => !current),
              },
              h(IconHistory),
            ),
            typeof props.openView === 'function'
              ? h(
                  'button',
                  {
                    key: 'chat-open-view',
                    className: 'rd-btn ghost rd-icon-btn rd-drawer-head-btn',
                    'data-chat-action': 'open-view',
                    'aria-label': t('label.chatJump'),
                    title: t('label.chatJump'),
                    onClick: () => props.openView('chat', ''),
                  },
                  h(IconExternal),
                )
              : null,
          ].filter(Boolean)
        : null
    return renderDrawerShell(titles[drawer], body, {
      wide: drawer === 'guide' && guideView === 'map',
      bodyClassName: drawer === 'chat' ? 'rd-drawer-chat' : '',
      subtitle: drawer === 'chat' ? t('label.chatSubtitle') : '',
      actions: chatActions,
    })
  }

  const renderEditor = () => {
    if (!editing) return null
    const style = placePanel(editing.rect, 540)
    return h(
      'div',
      {
        className: 'rd-card rd-editor rd-annotation-editor',
        style: { ...style, width: style.width, maxHeight: style.maxHeight },
        onMouseEnter: () => clearTimeout(hideTimer.current),
        onClick: (event) => event.stopPropagation(),
      },
      h('h3', null, t('label.editAnnotation')),
      h('div', { className: 'rd-quote' }, '“' + String(editing.annotation.quote || '').slice(0, 160) + '”'),
      h(
        'div',
        { className: 'rd-actions', style: { marginTop: 0 } },
        COLORS.map((color) =>
          h('button', {
            key: color,
            type: 'button',
            'aria-label': t('action.highlight'),
            className: 'rd-swatch',
            style: {
              background: color,
              outline: color === editing.annotation.color ? '2px solid var(--dsw-alias-brand-primary)' : 'none',
              outlineOffset: '2px',
            },
            onClick: () => updateAnnotation(editing.id, { color }),
          }),
        ),
      ),
      h('textarea', {
        autoFocus: true,
        value: editing.note,
        placeholder: t('label.notePlaceholder'),
        onChange: (event) => setEditing({ ...editing, note: event.target.value }),
      }),
      h(
        'div',
        { className: 'rd-actions rd-sticky-actions' },
        h('button', { className: 'rd-btn', onClick: saveEditing }, t('action.save')),
        h('button', { className: 'rd-btn', onClick: deleteEditing }, t('action.delete')),
        h('button', { className: 'rd-btn ghost', onClick: () => setEditing(null) }, t('action.close')),
      ),
    )
  }

  const renderCardBody = (card) => {
    const concept = card.id ? store.concepts[card.id] : null
    const chain = concept ? conceptChain(store.concepts, concept.id).slice(0, -1) : []
    const editingThis = conceptEdit && conceptEdit.id === card.id
    let body = null
    if (editingThis) {
      const form = conceptEdit.form
      const setField = (key, value) => setConceptEdit({ ...conceptEdit, form: { ...form, [key]: value } })
      body = h(
        'div',
        { className: 'rd-editor' },
        h('h3', null, t('label.editConcept')),
        h('input', {
          autoFocus: true,
          className: 'rd-input',
          placeholder: t('label.term'),
          value: form.term,
          onChange: (event) => setField('term', event.target.value),
        }),
        h('textarea', {
          placeholder: t('label.definition'),
          value: form.definition,
          onChange: (event) => setField('definition', event.target.value),
        }),
        h('textarea', {
          placeholder: t('label.intuition'),
          value: form.intuition,
          onChange: (event) => setField('intuition', event.target.value),
        }),
        h('textarea', {
          placeholder: t('label.context'),
          value: form.context,
          onChange: (event) => setField('context', event.target.value),
        }),
        h('textarea', {
          placeholder: t('label.examples'),
          value: form.examples,
          onChange: (event) => setField('examples', event.target.value),
        }),
        h('input', {
          className: 'rd-input',
          placeholder: t('label.aliases'),
          value: form.aliases,
          onChange: (event) => setField('aliases', event.target.value),
        }),
        h('input', {
          className: 'rd-input',
          placeholder: t('label.related'),
          value: form.related,
          onChange: (event) => setField('related', event.target.value),
        }),
        h(
          'div',
          { className: 'rd-actions rd-sticky-actions' },
          h('button', { className: 'rd-btn', onClick: saveConceptEdit }, t('action.save')),
          h('button', { className: 'rd-btn ghost', onClick: () => setConceptEdit(null) }, t('action.cancel')),
        ),
        h(
          'div',
          { className: 'rd-actions' },
          h(
            'select',
            { className: 'rd-select', value: mergeTarget, onChange: (event) => setMergeTarget(event.target.value) },
            h('option', { value: '' }, t('label.mergeTarget')),
            concepts
              .filter((item) => item.id !== concept.id)
              .map((item) => h('option', { key: item.id, value: item.id }, item.term)),
          ),
          h(
            'button',
            { className: 'rd-btn', disabled: !mergeTarget, onClick: () => mergeConcept(concept.id, mergeTarget) },
            t('action.merge'),
          ),
        ),
      )
    } else if (card.pending) {
      body = h(
        'div',
        null,
        h('h3', null, card.term, h('span', { className: 'rd-badge' }, t('label.thinking'))),
        h('div', { className: 'rd-skeleton', style: { width: '86%' } }),
        h('div', { className: 'rd-skeleton', style: { width: '64%' } }),
        h('div', { className: 'rd-skeleton', style: { width: '74%' } }),
      )
    } else if (card.error) {
      body = h(
        'div',
        null,
        h('h3', null, card.term),
        h('div', { className: 'rd-error' }, errorText(card.error)),
        h(
          'div',
          { className: 'rd-actions' },
          h('button', { className: 'rd-btn', onClick: () => createConcept(card.term, null, null) }, t('action.retry')),
        ),
      )
    } else if (concept) {
      body = h(
        'div',
        null,
        h(
          'h3',
          null,
          concept.term,
          concept.depth !== 'full' && concept.source !== 'user'
            ? h('span', { className: 'rd-badge' }, t('label.quick'))
            : null,
          h('span', { className: 'rd-spacer' }),
          h(
            'button',
            {
              className: 'rd-btn ghost rd-icon-btn rd-card-pin',
              'aria-pressed': Boolean(card.pinned),
              'aria-label': card.pinned ? t('action.unpin') : t('action.pin'),
              title: card.pinned ? t('action.unpin') : t('action.pin'),
              onClick: () =>
                setCards((current) =>
                  current.map((entry) => (entry.id === card.id ? { ...entry, pinned: !entry.pinned } : entry)),
                ),
            },
            h(IconPin),
          ),
          h('button', { className: 'rd-btn ghost rd-icon-btn', 'aria-label': t('action.dismiss'), onClick: () => setCards(popCard) }, '×'),
        ),
        chain.length
          ? h('div', { className: 'rd-muted', style: { fontSize: '11px', marginBottom: '7px' } }, chain.map((item) => item.term).join(' › '))
          : null,
        card.hint ? h('div', { className: 'rd-muted', style: { fontSize: '11px', marginBottom: '7px' } }, card.hint) : null,
        h('div', { className: 'rd-def' }, concept.definition || ''),
        concept.intuition
          ? h('div', { className: 'rd-sec' }, h('b', null, t('label.intuition') + '  '), concept.intuition)
          : null,
        concept.context ? h('div', { className: 'rd-sec' }, h('b', null, t('label.context') + '  '), concept.context) : null,
        (concept.contexts || []).length
          ? h(
              'div',
              { className: 'rd-sec' },
              h('b', null, t('label.bookUsage') + '  '),
              concept.contexts.map((entry, index) =>
                h(
                  'div',
                  { key: index, style: { marginTop: '3px' } },
                  (store.docs?.[entry.docKey]?.path ? basename(store.docs[entry.docKey].path) + '：' : '') + entry.note,
                ),
              ),
            )
          : null,
        concept.examples && concept.examples.length
          ? h('div', { className: 'rd-sec' }, h('b', null, t('label.examplesTitle') + '  '), concept.examples.join('；'))
          : null,
        concept.related && concept.related.length
          ? h('div', { className: 'rd-sec' }, h('b', null, t('label.related') + '  '), concept.related.join(' · '))
          : null,
        concept.evidence && (concept.evidence.sentence || concept.evidence.quote)
          ? h(
              'details',
              { className: 'rd-sec' },
              h('summary', { style: { cursor: 'pointer' } }, t('label.evidence')),
              h('div', { style: { marginTop: '4px' } }, concept.evidence.sentence || concept.evidence.quote),
            )
          : null,
        (concept.qa || []).length
          ? h(
              'div',
              { className: 'rd-sec' },
              h('b', null, t('label.qa') + '  '),
              concept.qa.slice(-3).map((item, index) =>
                h(
                  'div',
                  { key: index, className: 'rd-qa' },
                  h('div', null, t('label.questionShort') + '：' + item.q),
                  h('div', { className: 'rd-muted' }, t('label.answerShort') + '：' + item.a),
                  item.web && item.web.used && item.web.sources && item.web.sources.length
                    ? h(
                        'div',
                        { className: 'rd-qa-src' },
                        h('span', null, t('label.webSources') + '：'),
                        item.web.sources.map((source, sourceIndex) =>
                          h(
                            'a',
                            {
                              key: sourceIndex,
                              href: source.url,
                              target: '_blank',
                              rel: 'noreferrer',
                              onClick: (event) => event.stopPropagation(),
                            },
                            `[${sourceIndex + 1}] ${source.title}`,
                          ),
                        ),
                      )
                    : item.web && item.web.error
                      ? h('div', { className: 'rd-muted', style: { fontSize: '11px' } }, t('label.webFailed'))
                      : null,
                ),
              ),
            )
          : null,
        h(
          'div',
          { className: 'rd-actions', style: { marginTop: '8px' } },
          h(
            'label',
            { className: 'rd-web-toggle', title: t('label.webAskHint') },
            h('input', {
              type: 'checkbox',
              checked: askWeb,
              onChange: (event) => setAskWeb(event.target.checked),
            }),
            t('label.webAsk'),
          ),
          h('input', {
            className: 'rd-input',
            style: { flex: 1 },
            placeholder: t('label.askPlaceholder'),
            value: askText,
            onChange: (event) => setAskText(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') askConcept(concept)
            },
          }),
          h(
            'button',
            { className: 'rd-btn', disabled: askBusy, onClick: () => askConcept(concept) },
            askBusy ? t('label.asking') : t('action.ask'),
          ),
        ),
        h(
          'div',
          { className: 'rd-actions' },
          h(
            'button',
            {
              className: 'rd-btn',
              title: t('label.conceptListHint'),
              onClick: () => {
                setCards([])
                setDrawer('concepts')
                setQuery('')
                setFocusConcept(concept.id)
              },
            },
            t('label.conceptList'),
          ),
          concept.depth !== 'full' && concept.source !== 'user'
            ? h(
                'button',
                {
                  className: 'rd-btn',
                  disabled: upgradingId === concept.id,
                  onClick: () => upgradeConcept(concept),
                },
                upgradingId === concept.id ? t('label.upgrading') : t('action.deepen'),
              )
            : null,
          h(
            'button',
            {
              className: 'rd-btn',
              onClick: () => {
                setMergeTarget('')
                setConceptEdit({ id: concept.id, form: conceptFormOf(concept) })
              },
            },
            t('action.edit'),
          ),
          h('button', { className: 'rd-btn', onClick: () => removeConcept(concept.id) }, t('action.delete')),
        ),
      )
    }
    return body
  }

  const renderCards = () => {
    if (cards.length === 0) return null
    const base = cards[0].rect
    const editingInCard = cards.some((entry) => conceptEdit && conceptEdit.id === entry.id)
    const style = placePanel(base, editingInCard ? 540 : 480)
    const bounds = rootBounds()
    const cardWidth = style.width
    const topIndex = cards.length - 1
    const offsets = []
    let inheritedOffset = { x: 0, y: 0 }
    for (const entry of cards) {
      const offset = cardOffsets[entry.id] || inheritedOffset
      offsets.push(offset)
      inheritedOffset = offset
    }

    const startDrag = (event, entry, baseLeft, baseTop, depth) => {
      if (event.button !== 0) return
      if (event.target && event.target.closest && event.target.closest('button, input, textarea, select, a')) return
      const rect = event.currentTarget.getBoundingClientRect()
      setChildMenu(null)
      cardDragRef.current = {
        id: entry.id,
        startX: event.clientX,
        startY: event.clientY,
        baseLeft,
        baseTop,
        offsetX: rect.left + 12 * depth - baseLeft,
        offsetY: rect.top + 12 * depth - baseTop,
        width: rect.width,
        height: rect.height,
      }
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId)
      } catch {
        /* pointer capture is best-effort */
      }
    }

    const moveDrag = (event) => {
      const drag = cardDragRef.current
      if (!drag) return
      const dx = event.clientX - drag.startX
      const dy = event.clientY - drag.startY
      if (Math.abs(dx) + Math.abs(dy) <= 3) return
      event.preventDefault()
      const clamped = clampCardPosition(
        {
          left: drag.baseLeft + drag.offsetX + dx,
          top: drag.baseTop + drag.offsetY + dy,
          width: drag.width,
          height: drag.height,
        },
        bounds,
      )
      setCardOffsets((current) => ({
        ...current,
        [drag.id]: { x: clamped.left - drag.baseLeft, y: clamped.top - drag.baseTop },
      }))
    }

    const endDrag = (event) => {
      const drag = cardDragRef.current
      if (!drag) return
      cardDragRef.current = null
      const entry = cards.find((item) => item.id === drag.id)
      if (!entry || entry.pinned || !event) return
      const rect = event.currentTarget.getBoundingClientRect()
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom
      if (!inside) closeCardsSoon(0)
    }

    return h(
      React.Fragment,
      null,
      cards.map((entry, index) => {
        const isTop = index === topIndex
        const offset = offsets[index]
        const baseLeft = style.left
        const baseTop = style.top
        const size = cardSizes[entry.id] || { width: cardWidth, height: style.maxHeight }
        const position = clampCardPosition(
          { left: baseLeft + offset.x, top: baseTop + offset.y, width: size.width, height: size.height },
          bounds,
        )
        const depth = topIndex - index
        const stackStyle = {
          transform: `translate(${-12 * depth}px, ${-12 * depth}px)`,
          opacity: depth > 0 ? 0.96 : 1,
        }
        const attachCardMotion = (node) => {
          if (!node || node.dataset.motion === 'in') return
          const anchor = entry.rect || { left: 0, top: 0, width: 0, height: 0 }
          const panel = node.getBoundingClientRect()
          const side = panel.top + panel.height / 2 >= anchor.top + anchor.height / 2 ? 'below' : 'above'
          markMotionIn(node, { origin: anchorOrigin(anchor, panel), side, enabled: motionOn })
        }
        return h(
          'div',
          {
            key: entry.slot || entry.id,
            className: 'rd-hover-zone',
            'data-dragging': cardDragRef.current ? '1' : undefined,
            style: {
              left: position.left - 16,
              top: position.top - 16,
              width: cardWidth + 32,
              maxWidth: cardWidth + 32,
              zIndex: 80 + index,
            },
            onMouseEnter: () => clearTimeout(hideTimer.current),
            onMouseLeave: () => {
              if (entry.pinned || cardDragRef.current) return
              closeCardsSoon()
            },
          },
          h(
            'div',
            { key: 'stack', className: 'rd-card-stack', style: stackStyle },
            h(
              'div',
              {
                key: 'card',
                ref: attachCardMotion,
                className: 'rd-card',
                role: 'dialog',
                'aria-label': String(entry.term || (store.concepts[entry.id] && store.concepts[entry.id].term) || ''),
                style: { width: cardWidth, maxHeight: style.maxHeight },
                onPointerDown: (event) => {
                  if (event.target && event.target.closest && event.target.closest('h3')) {
                    startDrag(event, entry, baseLeft, baseTop, depth)
                  }
                },
                onPointerMove: moveDrag,
                onPointerUp: endDrag,
                onPointerCancel: endDrag,
              },
              renderCardBody(entry),
            ),
          ),
          isTop && childMenu ? renderChildMenu() : null,
        )
      }),
    )
  }

  // Attach the figures/formulas of a selection through the client conversation
  // controller (the only owner of browser draft attachments). The quote text
  // already describes them, so a failed upload still leaves the model informed.
  const attachSelectionAssets = async (assets) => {
    if (!Array.isArray(assets) || assets.length === 0) return
    const conversation = props.conversation
    const actions = props.inputActions
    if (!conversation || typeof conversation.createDrafts !== 'function' || !actions || typeof actions.addAttachments !== 'function') {
      flash(t('label.selectionAssetsUnavailable'))
      return
    }
    let files = []
    try {
      files = await prepareSelectionFiles(assets)
    } catch {
      files = []
    }
    if (files.length === 0) return
    let drafts = []
    try {
      drafts = conversation.createDrafts(sessionId, files, true) || []
    } catch {
      flash(t('label.selectionAssetsFailed'))
      return
    }
    const ids = drafts.map((draft) => (draft && draft.id ? draft.id : '')).filter(Boolean)
    if (ids.length === 0) return
    let added = false
    try {
      added = actions.addAttachments(ids) !== false
    } catch {
      added = false
    }
    if (!added) {
      for (const id of ids) {
        try {
          conversation.releaseDraftAttachment(id)
        } catch {
          /* the draft may already be gone */
        }
      }
      flash(t('label.selectionAssetsBusy'))
    }
  }

  // Hand the selected passage to the native composer as an atomic quote block;
  // the optional question is inserted after it (spec §4.3: the span must be
  // captured again after the quote, because insertText is revision-guarded).
  const askChatSelection = (question) => {
    const actions = props.inputActions
    if (!actions || typeof actions.insertQuote !== 'function') {
      setMenuError(t('label.chatUnavailable'))
      return false
    }
    const text = menu && menu.text ? String(menu.text).trim() : ''
    const assets = Array.isArray(menu && menu.assets) ? menu.assets : []
    if (!text && assets.length === 0) return false
    const position = currentPosition(doc, {
      chapter,
      chapterTitle: docChapterTitle(),
      page,
      percent: currentReadingPercent(),
    })
    const quote = buildQuoteText(formatLocation(doc, position), text) + buildAssetQuoteSuffix(assets, t)
    let span = null
    if (question && typeof actions.captureInsertion === 'function') {
      try {
        span = actions.captureInsertion()
      } catch {
        span = null
      }
    }
    let inserted = false
    try {
      inserted = actions.insertQuote(quote) !== false
    } catch {
      inserted = false
    }
    if (!inserted) {
      setMenuError(t('label.composerBusy'))
      return false
    }
    if (question && typeof actions.insertText === 'function' && typeof actions.captureInsertion === 'function') {
      let after = null
      try {
        after = actions.captureInsertion()
      } catch {
        after = null
      }
      if (after || span) {
        try {
          actions.insertText(question, after || span)
        } catch {
          /* the quote already landed; a failed question is not fatal */
        }
      }
    }
    setMenuError('')
    setMenu(null)
    dismissSelection(window)
    setDrawer('chat')
    if (assets.length > 0) void attachSelectionAssets(assets)
    return true
  }

  const renderMenu = () => {
    if (!menu) return null
    const bounds = rootBounds()
    const left = Math.max(bounds.left + 8, Math.min(bounds.right - 320, menu.x - 150))
    const above = menu.y > bounds.top + 70
    const side = above ? 'above' : 'below'
    const rawTop = above ? menu.y - 46 : menu.y + 26
    const top = Math.max(bounds.top + 52, Math.min(bounds.bottom - 52, rawTop))
    const attachMenuMotion = (node) => {
      if (!node || node.dataset.motion === 'in') return
      const anchor = menu.rect || { left: menu.x, top: menu.y, width: 0, height: 0 }
      markMotionIn(node, { origin: edgeOrigin(anchor, node.getBoundingClientRect(), side), side, enabled: motionOn })
    }
    const composerReady = Boolean(props.inputActions && typeof props.inputActions.insertQuote === 'function')
    const selectedText = menu.text ? String(menu.text).trim() : ''
    const hasAssets = Array.isArray(menu.assets) && menu.assets.length > 0
    const canAsk = composerReady && Boolean(selectedText || hasAssets)
    // Chat text is a conversation, not the book: highlight and note annotate
    // book positions and would write annotations the book never renders.
    const inChat = menu.inChat === true
    return h(
      'div',
      { className: 'rd-mini', ref: attachMenuMotion, style: { left, top } },
      menuError ? h('div', { key: 'chat-error', className: 'rd-mini-error' }, menuError) : null,
      canAsk
        ? h('button', { key: 'ask-chat', className: 'rd-btn', onClick: () => askChatSelection() }, t('action.askChat'))
        : null,
      composerReady && selectedText
        ? h(
            'select',
            {
              key: 'quick-ask',
              className: 'rd-select rd-quick-ask',
              'data-action': 'quick-ask',
              'aria-label': t('action.quickAsk'),
              title: t('action.quickAsk'),
              defaultValue: '',
              onChange: (event) => {
                const id = event.target.value
                event.target.value = ''
                if (id) askChatSelection(t(`quick.${id}`))
              },
            },
            h('option', { value: '' }, t('action.quickAsk')),
            QUICK_ASKS.map((item) => h('option', { key: item.id, value: item.id }, t(`quick.${item.id}`))),
          )
        : null,
      inChat
        ? null
        : h('button', { className: 'rd-btn', onClick: () => createConcept(menu.text, menu.range, null) }, t('action.explain')),
      inChat
        ? null
        : h(
            'button',
            {
              className: 'rd-btn',
              onClick: (event) => {
                event.stopPropagation()
                void translateSelection()
              },
            },
            t('action.translateSelection'),
          ),
      inChat ? null : h('button', { className: 'rd-btn', onClick: startNote }, t('action.note')),
      inChat
        ? null
        : COLORS.map((color) =>
            h('button', {
              key: color,
              type: 'button',
              className: 'rd-swatch',
              'aria-label': t('action.highlight'),
              title: t('action.highlight'),
              style: { background: color },
              onClick: () => addHighlight(color),
            }),
          ),
      h(
        'button',
        {
          className: 'rd-btn',
          onClick: () => {
            navigator.clipboard.writeText(menu.text)
            setMenu(null)
          },
        },
        t('action.copy'),
      ),
      h(
        'button',
        {
          className: 'rd-btn rd-dismiss',
          'aria-label': t('action.dismiss'),
          onClick: () => {
            setMenu(null)
            dismissSelection(window)
          },
        },
        '×',
      ),
    )
  }

  const renderChildMenu = () => {
    if (!childMenu) return null
    const attachChildMotion = (node) => {
      if (!node || node.dataset.motion === 'in') return
      const anchor = childMenu.rect || { left: childMenu.x, top: childMenu.y, width: 0, height: 0 }
      markMotionIn(node, { origin: edgeOrigin(anchor, node.getBoundingClientRect(), 'above'), side: 'above', enabled: motionOn })
    }
    return h(
      'div',
      {
        className: 'rd-mini rd-child-menu',
        ref: attachChildMotion,
        style: (() => {
          const bounds = rootBounds()
          return {
            left: Math.max(bounds.left + 8, Math.min(bounds.right - 120, childMenu.x)),
            top: Math.max(bounds.top + 52, Math.min(bounds.bottom - 52, childMenu.y - 40)),
          }
        })(),
        onMouseEnter: () => clearTimeout(hideTimer.current),
        onMouseLeave: () => {
          if (card && !card.pinned) closeCardsSoon()
        },
      },
      h('button', { className: 'rd-btn', onClick: () => createConcept(childMenu.text, childMenu.range, card ? card.id : null) }, t('action.explainChild')),
    )
  }

  const renderNote = () => {
    if (!noteDraft) return null
    return h(
      'div',
      { className: 'rd-note-mask', onClick: () => setNoteDraft(null) },
      h(
        'div',
        { className: 'rd-note-box', onClick: (event) => event.stopPropagation() },
        h('div', { style: { fontSize: '13px', fontWeight: 600, marginBottom: '8px' } }, t('label.noteTitle')),
        h('div', { className: 'rd-muted', style: { fontSize: '12px', marginBottom: '8px' } }, '“' + String(noteDraft.quote).slice(0, 90) + '”'),
        h('textarea', {
          value: noteDraft.text,
          autoFocus: true,
          onChange: (event) => setNoteDraft({ ...noteDraft, text: event.target.value }),
        }),
        h(
          'div',
          { className: 'rd-actions' },
          h('button', { className: 'rd-btn', onClick: () => setNoteDraft(null) }, t('action.cancel')),
          h('button', { className: 'rd-btn', onClick: saveNote }, t('action.save')),
        ),
      ),
    )
  }

  if (!sessionId) {
    return h('div', { className: 'rd-root' }, h('div', { className: 'rd-empty' }, t('label.openFromSession')))
  }

  return h(
    'div',
    {
      className: `rd-root rd-theme-${prefs.theme || 'system'}${mapFullscreen ? ' rd-map-fullscreen-open' : ''}${
        prefs.motion === 'off' || (rootRef.current && rootRef.current.classList && rootRef.current.classList.contains('rd-motion-off'))
          ? ' rd-motion-off'
          : ''
      }`,
      ref: rootRef,
      style: { '--rd-fs': fontSize + 'px', '--rd-lh': String(prefs.lineHeight || 1.85) },
      onClick: onRootClick,
      onKeyDown: onRootKeyDown,
      onMouseUp: (event) => setTimeout(() => onPointerUp(event), 0),
      onMouseOver: onTermOver,
      onMouseOut: onTermOut,
    },
    h(ChatSubmitWatcher, { key: 'chat-submit-watcher', useInput: props.useInput, onSend: () => setDrawer('chat') }),
    renderToolbar(),
    doc
      ? h(
          'div',
          { className: 'rd-progress', 'aria-hidden': 'true' },
          h('div', {
            className: 'rd-progress-bar',
            style: { width: `${Math.max(0, Math.min(100, readingProgress * 100)).toFixed(1)}%` },
          }),
        )
      : null,
    busy ? h('div', { className: 'rd-toast' }, t('label.loading')) : null,
    error ? h('div', { className: 'rd-error', style: { padding: '8px 14px' } }, error) : null,
    relink
      ? h(
          'div',
          { className: 'rd-relink' },
          h('span', null, `${t('label.contentChanged')} (${relink.count})`),
          h(
            'button',
            {
              className: 'rd-btn',
              onClick: () =>
                applyMutation({ op: 'doc/relink', fromKey: relink.fromKey, toKey: docKey })
                  .then(() => {
                    setRelink(null)
                    flash(t('label.relinked'))
                  })
                  .catch((e) => reportError(e)),
            },
            t('action.relink'),
          ),
          h('button', { className: 'rd-btn ghost', onClick: () => setRelink(null) }, t('action.dismiss')),
        )
      : null,
    h('div', { className: 'rd-body' }, renderContent(), renderDrawer()),
    mapFullscreen ? renderMindmap() : null,
    renderEditor(),
    renderCards(),
    renderMenu(),
    renderNote(),
    renderSearch(),
    renderSelectionTranslation(),
    showHelp
      ? h(
          'div',
          { className: 'rd-help-mask', onClick: () => setShowHelp(false) },
          h(
            'div',
            { className: 'rd-help-box', onClick: (event) => event.stopPropagation() },
            h('h3', { style: { marginTop: 0 } }, t('label.shortcuts')),
            [['← / →', t('help.paging')], [undoLabel(), t('help.undo')], ['?', t('help.help')], ['Esc', t('help.close')]].map(
              ([keys, label]) => h('div', { key: keys, className: 'rd-help-row' }, h('span', null, label), h('b', null, keys)),
            ),
          ),
        )
      : null,
    toast
      ? h(
          'div',
          { className: 'rd-toast' },
          toast.message,
          toast.action
            ? h(
                'button',
                {
                  className: 'rd-btn',
                  onClick: () => {
                    const action = toast.action
                    setToast(null)
                    action.run()
                  },
                },
                toast.action.label,
              )
            : null,
        )
      : null,
  )
}
