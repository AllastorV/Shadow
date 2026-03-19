"""
Gerçek zamanlı işbirliği WebSocket endpoint'i.
ws://<host>/ws/{project_id}?token=<jwt>
"""
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.user import User, UserRole
from ..models.project import Project
from ..services.auth import decode_token
from ..ws_manager import manager

logger  = logging.getLogger(__name__)
router  = APIRouter(tags=["collaboration"])


def _user_info(user: User) -> dict:
    return {
        "id":         user.id,
        "username":   user.username,
        "full_name":  user.full_name,
        "avatar_url": user.avatar_url,
    }


@router.websocket("/ws/{project_id}")
async def collab_ws(
    project_id: int,
    websocket:  WebSocket,
    token:      str = Query(...),
    db:         Session = Depends(get_db),
):
    """
    Proje işbirliği odası.
    • JWT token query param ile kimlik doğrulama
    • Oda doluluğu kontrolü (MAX_PER_ROOM = 10)
    • Kullanıcı katılım/ayrılma olayları yayınlanır
    • Marker / yorum / durum olayları routers üzerinden push edilir
    """

    # ── 1. JWT doğrulama ──────────────────────────────────────────────────────
    token_data = decode_token(token)
    if not token_data:
        await websocket.accept()
        await websocket.close(code=4001, reason="Geçersiz token")
        return

    user = db.query(User).filter(
        User.id == token_data.user_id,
        User.is_active == True,
    ).first()

    if not user:
        await websocket.accept()
        await websocket.close(code=4001, reason="Kullanıcı bulunamadı")
        return

    # ── 2. Proje erişim kontrolü ──────────────────────────────────────────────
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        await websocket.accept()
        await websocket.close(code=4004, reason="Proje bulunamadı")
        return

    if user.role != UserRole.admin:
        is_owner  = project.owner_id == user.id
        is_member = any(m.id == user.id for m in project.members)
        if not is_owner and not is_member:
            await websocket.accept()
            await websocket.close(code=4003, reason="Bu projeye erişim yetkiniz yok")
            return

    # ── 3. Odaya bağlan ───────────────────────────────────────────────────────
    connected = await manager.connect(websocket, project_id, _user_info(user))
    if not connected:
        return          # Oda dolu — manager zaten close() çağırdı

    # ── 4. Mesaj döngüsü ──────────────────────────────────────────────────────
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except ValueError:
                continue

            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        left = manager.disconnect(websocket, project_id)
        if left:
            await manager.broadcast(project_id, {
                "type":    "user_left",
                "user_id": left["id"],
                "count":   manager.room_count(project_id),
                "max":     10,
            })
    except Exception as exc:
        logger.warning("WS error project=%s user=%s: %s", project_id, user.username, exc)
        manager.disconnect(websocket, project_id)
