/**
 * Gerçek zamanlı işbirliği hook'u.
 * WebSocket üzerinden proje odasına bağlanır, aktif kullanıcıları takip eder
 * ve uzak değişiklikler geldiğinde React Query cache'ini geçersiz kılar.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'

export interface CollabUser {
  id:         number
  username:   string
  full_name:  string
  avatar_url?: string
}

export type CollabStatus = 'connecting' | 'connected' | 'disconnected' | 'full'

interface Options {
  projectId: number | undefined
  assetId:   string   // useParams'tan gelen string
}

export function useCollaboration({ projectId, assetId }: Options) {
  const { token }      = useAuthStore()
  const queryClient    = useQueryClient()
  const wsRef          = useRef<WebSocket | null>(null)
  const retryRef       = useRef<ReturnType<typeof setTimeout>>()
  const pingRef        = useRef<ReturnType<typeof setInterval>>()
  const mountedRef     = useRef(true)

  const [activeUsers, setActiveUsers] = useState<CollabUser[]>([])
  const [status,      setStatus]      = useState<CollabStatus>('connecting')
  const [maxUsers]                    = useState(10)

  // ── Mesaj işleyici ─────────────────────────────────────────────────────────
  const handleMessage = useCallback((raw: string) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(raw) } catch { return }

    switch (msg.type) {

      case 'room_users':
        setActiveUsers((msg.users as CollabUser[]) ?? [])
        break

      case 'user_joined': {
        const u = msg.user as CollabUser
        setActiveUsers(prev =>
          prev.find(x => x.id === u.id) ? prev : [...prev, u],
        )
        break
      }

      case 'user_left':
        setActiveUsers(prev => prev.filter(x => x.id !== (msg.user_id as number)))
        break

      // ── Asset değişiklikleri: sadece bu asset ile ilgiliyse yenile ─────────
      case 'marker_created':
      case 'marker_deleted':
        if (String(msg.asset_id) === assetId) {
          queryClient.invalidateQueries({ queryKey: ['markers', assetId] })
        }
        break

      case 'comment_created':
        if (String(msg.asset_id) === assetId) {
          queryClient.invalidateQueries({ queryKey: ['comments', assetId] })
          queryClient.invalidateQueries({ queryKey: ['asset',   assetId] })
        }
        break

      case 'asset_status_changed':
        if (String(msg.asset_id) === assetId) {
          queryClient.invalidateQueries({ queryKey: ['asset', assetId] })
        }
        break
    }
  }, [assetId, queryClient])

  // ── Bağlantı kur ──────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (!token || !projectId || !mountedRef.current) return

    // ws:// / wss:// — aynı host, backend proxy üzerinden
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url   = `${proto}://${window.location.host}/ws/${projectId}?token=${token}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      setStatus('connected')
      // Bağlantıyı canlı tut — 30s ping
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 30_000)
    }

    ws.onmessage = e => handleMessage(e.data)

    ws.onclose = e => {
      clearInterval(pingRef.current)
      if (!mountedRef.current) return

      if (e.code === 1008) {
        // Oda dolu
        setStatus('full')
        setActiveUsers([])
        return
      }

      setStatus('disconnected')
      // 3s sonra yeniden bağlan
      retryRef.current = setTimeout(() => {
        if (mountedRef.current) connect()
      }, 3_000)
    }

    ws.onerror = () => {
      // onclose da tetiklenecek — burada sadece loglama
      setStatus('disconnected')
    }
  }, [token, projectId, handleMessage])

  // ── Mount / unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      clearTimeout(retryRef.current)
      clearInterval(pingRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { activeUsers, status, maxUsers }
}
