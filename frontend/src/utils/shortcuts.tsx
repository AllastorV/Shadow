import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
} from 'react'

// ── Types ──────────────────────────────────────────────────────────────────────
export type ShortcutId =
  | 'goto_dashboard' | 'goto_search' | 'go_back' | 'focus_search'
  | 'show_shortcuts' | 'toggle_theme' | 'close_modal'
  | 'new_project' | 'upload' | 'view_grid' | 'view_list'
  | 'approve_asset' | 'reject_asset' | 'play_pause' | 'add_marker'
  | 'next_tab' | 'prev_tab'

export interface ShortcutDef {
  id: ShortcutId
  label: string
  description: string
  category: string
  defaultKey: string
}

// ── Default shortcut definitions ────────────────────────────────────────────────
export const DEFAULT_SHORTCUTS: ShortcutDef[] = [
  // Gezinme
  { id: 'goto_dashboard',  label: 'Dashboard',            description: 'Ana sayfaya git',               category: 'Gezinme',  defaultKey: 'Ctrl+1'       },
  { id: 'goto_search',     label: 'AI Arama',             description: 'Arama sayfasına git',           category: 'Gezinme',  defaultKey: 'Ctrl+2'       },
  { id: 'go_back',         label: 'Geri',                 description: 'Önceki sayfaya dön',            category: 'Gezinme',  defaultKey: 'Alt+ArrowLeft'},
  { id: 'focus_search',    label: 'Arama kutusuna odaklan', description: 'Sayfadaki arama kutusuna odaklan', category: 'Gezinme', defaultKey: 'Ctrl+F'  },
  // Uygulama
  { id: 'show_shortcuts',  label: 'Kısayollar paneli',    description: 'Klavye kısayollarını göster/gizle', category: 'Uygulama', defaultKey: 'Shift+?'  },
  { id: 'toggle_theme',    label: 'Tema değiştir',        description: 'Karanlık / aydınlık mod',       category: 'Uygulama', defaultKey: 'Ctrl+Shift+L' },
  { id: 'close_modal',     label: 'Kapat',                description: 'Açık modal veya paneli kapat', category: 'Uygulama', defaultKey: 'Escape'       },
  // Proje
  { id: 'new_project',     label: 'Yeni proje',           description: 'Yeni proje oluştur',            category: 'Proje',    defaultKey: 'Ctrl+Shift+N' },
  { id: 'upload',          label: 'Dosya yükle',          description: 'Dosya yükleme ekranını aç',     category: 'Proje',    defaultKey: 'Ctrl+U'       },
  { id: 'view_grid',       label: 'Izgara görünümü',      description: 'Varlıkları ızgara olarak göster', category: 'Proje',  defaultKey: 'G'            },
  { id: 'view_list',       label: 'Liste görünümü',       description: 'Varlıkları liste olarak göster', category: 'Proje',  defaultKey: 'L'            },
  // Varlık detayı
  { id: 'approve_asset',   label: 'Onayla',               description: 'Varlığı onayla (Approved)',     category: 'Varlık',   defaultKey: 'A'            },
  { id: 'reject_asset',    label: 'Reddet',               description: 'Varlığı reddet (Rejected)',     category: 'Varlık',   defaultKey: 'X'            },
  { id: 'play_pause',      label: 'Oynat / Duraklat',     description: 'Video veya ses oynat/duraklat', category: 'Varlık',   defaultKey: 'Space'        },
  { id: 'add_marker',      label: 'Marker ekle',          description: 'Geçerli konuma marker ekle',   category: 'Varlık',   defaultKey: 'M'            },
  { id: 'next_tab',        label: 'Sonraki sekme',        description: 'Detay sayfasında sonraki sekme', category: 'Varlık', defaultKey: 'Ctrl+ArrowRight'},
  { id: 'prev_tab',        label: 'Önceki sekme',         description: 'Detay sayfasında önceki sekme', category: 'Varlık', defaultKey: 'Ctrl+ArrowLeft' },
]

// ── Key parsing ─────────────────────────────────────────────────────────────────
interface ParsedKey { ctrl: boolean; shift: boolean; alt: boolean; key: string }

export function parseKey(keyStr: string): ParsedKey {
  const parts = keyStr.split('+')
  const key = parts[parts.length - 1]
  return {
    ctrl:  parts.includes('Ctrl'),
    shift: parts.includes('Shift'),
    alt:   parts.includes('Alt'),
    key:   key.toLowerCase(),
  }
}

export function matchEvent(parsed: ParsedKey, e: KeyboardEvent): boolean {
  if (parsed.ctrl  !== e.ctrlKey)  return false
  if (parsed.shift !== e.shiftKey) return false
  if (parsed.alt   !== e.altKey)   return false
  const evKey = e.key === ' ' ? 'space' : e.key.toLowerCase()
  return evKey === parsed.key
}

// ── Persistence ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'shadow-shortcuts'
function loadCustomKeys(): Partial<Record<ShortcutId, string>> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return {} }
}
function saveCustomKeys(keys: Partial<Record<ShortcutId, string>>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

// ── Context ─────────────────────────────────────────────────────────────────────
interface ShortcutCtxValue {
  shortcuts: ShortcutDef[]
  activeKeys: Record<ShortcutId, string>
  setCustomKey: (id: ShortcutId, key: string) => void
  resetKey: (id: ShortcutId) => void
  resetAll: () => void
  registerHandler: (id: ShortcutId, fn: () => void) => () => void
  panelOpen: boolean
  openPanel: () => void
  closePanel: () => void
}

const ShortcutCtx = createContext<ShortcutCtxValue | null>(null)

// ── Provider ─────────────────────────────────────────────────────────────────────
export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const [customKeys, setCustomKeys] = useState<Partial<Record<ShortcutId, string>>>(loadCustomKeys)
  const [panelOpen, setPanelOpen] = useState(false)
  // Registry: id → Set of handlers (last registered = active page)
  const registry = useRef(new Map<ShortcutId, Set<() => void>>())

  const activeKeys = useMemo<Record<ShortcutId, string>>(() => {
    const out = {} as Record<ShortcutId, string>
    for (const def of DEFAULT_SHORTCUTS) {
      out[def.id] = customKeys[def.id] ?? def.defaultKey
    }
    return out
  }, [customKeys])

  const setCustomKey = useCallback((id: ShortcutId, key: string) => {
    setCustomKeys(prev => { const n = { ...prev, [id]: key }; saveCustomKeys(n); return n })
  }, [])

  const resetKey = useCallback((id: ShortcutId) => {
    setCustomKeys(prev => { const n = { ...prev }; delete n[id]; saveCustomKeys(n); return n })
  }, [])

  const resetAll = useCallback(() => {
    setCustomKeys({}); saveCustomKeys({})
  }, [])

  const registerHandler = useCallback((id: ShortcutId, fn: () => void): (() => void) => {
    if (!registry.current.has(id)) registry.current.set(id, new Set())
    registry.current.get(id)!.add(fn)
    return () => registry.current.get(id)?.delete(fn)
  }, [])

  const openPanel  = useCallback(() => setPanelOpen(true), [])
  const closePanel = useCallback(() => setPanelOpen(false), [])

  // ── Global keydown listener ────────────────────────────────────────────────
  useEffect(() => {
    // Pre-parse all active keys for performance
    const parsed = new Map<ShortcutId, ParsedKey>()
    for (const def of DEFAULT_SHORTCUTS) {
      parsed.set(def.id, parseKey(activeKeys[def.id]))
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const tag = target.tagName.toLowerCase()
      const inInput = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable

      for (const def of DEFAULT_SHORTCUTS) {
        if (!matchEvent(parsed.get(def.id)!, e)) continue

        // These shortcuts fire even inside inputs
        const isGlobal = def.id === 'show_shortcuts' || def.id === 'close_modal' || def.id === 'toggle_theme'
        if (inInput && !isGlobal) continue

        if (def.id === 'show_shortcuts') {
          e.preventDefault()
          setPanelOpen(p => !p)
          return
        }

        const fns = registry.current.get(def.id)
        if (fns && fns.size > 0) {
          e.preventDefault()
          const arr = [...fns]
          arr[arr.length - 1]()   // call most-recently registered handler
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeKeys])

  return (
    <ShortcutCtx.Provider value={{
      shortcuts: DEFAULT_SHORTCUTS,
      activeKeys,
      setCustomKey,
      resetKey,
      resetAll,
      registerHandler,
      panelOpen,
      openPanel,
      closePanel,
    }}>
      {children}
    </ShortcutCtx.Provider>
  )
}

// ── Hooks ────────────────────────────────────────────────────────────────────────
export function useShortcuts() {
  const ctx = useContext(ShortcutCtx)
  if (!ctx) throw new Error('useShortcuts must be inside ShortcutProvider')
  return ctx
}

/** Register a page-level handler for a shortcut. Auto-cleans on unmount. */
export function useShortcutAction(
  id: ShortcutId,
  fn: () => void,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  deps: React.DependencyList = [],
) {
  const { registerHandler } = useShortcuts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cb = useCallback(fn, deps)
  useEffect(() => registerHandler(id, cb), [registerHandler, id, cb])
}

// ── KeyBadge component ───────────────────────────────────────────────────────────
export function KeyBadge({ shortcutId }: { shortcutId: ShortcutId }) {
  const { activeKeys } = useShortcuts()
  const key = activeKeys[shortcutId]
  return (
    <span className="inline-flex gap-0.5 items-center">
      {key.split('+').map((part, i) => (
        <kbd
          key={i}
          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--c-surface-2)',
            border: '1px solid var(--c-surface-3)',
            color: '#8b9ab8',
          }}
        >
          {part}
        </kbd>
      ))}
    </span>
  )
}
