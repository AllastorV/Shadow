"""
Gerçek zamanlı işbirliği için WebSocket bağlantı yöneticisi.
Proje başına maksimum MAX_PER_ROOM bağlantıya izin verir.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

from fastapi import WebSocket

logger = logging.getLogger(__name__)

MAX_PER_ROOM = 10  # Oturum başına maksimum kullanıcı


class _Connection:
    __slots__ = ("ws", "user")

    def __init__(self, ws: WebSocket, user: dict):
        self.ws   = ws
        self.user = user  # {id, username, full_name, avatar_url}


class ConnectionManager:
    """Tüm proje odalarını yöneten in-memory bağlantı yöneticisi."""

    def __init__(self) -> None:
        # project_id → [_Connection, ...]
        self._rooms: dict[int, list[_Connection]] = {}

    # ── Sorgular ──────────────────────────────────────────────────────────────

    def room_count(self, project_id: int) -> int:
        return len(self._rooms.get(project_id, []))

    def room_users(self, project_id: int) -> list[dict]:
        return [c.user for c in self._rooms.get(project_id, [])]

    # ── Bağlantı yaşam döngüsü ────────────────────────────────────────────────

    async def connect(self, ws: WebSocket, project_id: int, user: dict) -> bool:
        """
        WebSocket'i kabul et ve odaya ekle.
        Oda doluysa bağlantıyı reddet ve False döndür.
        """
        room = self._rooms.setdefault(project_id, [])

        if len(room) >= MAX_PER_ROOM:
            await ws.accept()
            await ws.send_json({
                "type":    "error",
                "code":    "room_full",
                "message": f"Bu oturumda maksimum {MAX_PER_ROOM} kişi bulunabilir.",
            })
            await ws.close(code=1008)
            return False

        await ws.accept()
        conn = _Connection(ws, user)
        room.append(conn)

        # Yeni kullanıcıya mevcut oda üyelerini gönder
        await ws.send_json({
            "type":  "room_users",
            "users": self.room_users(project_id),
            "count": len(room),
            "max":   MAX_PER_ROOM,
        })

        # Diğerlerine "kullanıcı katıldı" bildir
        await self._broadcast(project_id, {
            "type":  "user_joined",
            "user":  user,
            "count": len(room),
            "max":   MAX_PER_ROOM,
        }, exclude=ws)

        logger.info("WS connect  project=%s user=%s count=%s/%s",
                    project_id, user["username"], len(room), MAX_PER_ROOM)
        return True

    def disconnect(self, ws: WebSocket, project_id: int) -> dict | None:
        """Bağlantıyı odadan kaldır, ayrılan kullanıcı bilgisini döndür."""
        room = self._rooms.get(project_id, [])
        conn = next((c for c in room if c.ws is ws), None)
        if not conn:
            return None

        room.remove(conn)
        if not room:
            del self._rooms[project_id]

        logger.info("WS disconnect project=%s user=%s remaining=%s",
                    project_id, conn.user["username"], len(room))
        return conn.user

    # ── Yayın ────────────────────────────────────────────────────────────────

    async def broadcast(self, project_id: int, event: dict,
                        exclude: WebSocket | None = None) -> None:
        """Oda içindeki tüm bağlı istemcilere olay gönder."""
        await self._broadcast(project_id, event, exclude)

    async def _broadcast(self, project_id: int, event: dict,
                         exclude: WebSocket | None = None) -> None:
        room = self._rooms.get(project_id)
        if not room:
            return

        dead: list[_Connection] = []
        for conn in list(room):          # kopya — iterasyon sırasında silme
            if conn.ws is exclude:
                continue
            try:
                await conn.ws.send_json(event)
            except Exception:
                dead.append(conn)

        for conn in dead:
            if conn in room:
                room.remove(conn)


# ── Global singleton ──────────────────────────────────────────────────────────

manager = ConnectionManager()
