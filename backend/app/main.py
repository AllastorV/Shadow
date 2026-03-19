from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from .database import Base, engine
from .routers import auth, projects, assets, comments, share
from .config import settings

# Create tables
Base.metadata.create_all(bind=engine)

# Ensure upload dir exists
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Shadow — AI Media Asset Management",
    description="AI-powered Digital Asset Management platform inspired by Shade.inc",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads as static files for preview
uploads_path = Path(settings.UPLOAD_DIR)
if uploads_path.exists():
    app.mount("/files", StaticFiles(directory=str(uploads_path)), name="files")

app.include_router(auth.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(comments.router, prefix="/api/v1")
app.include_router(share.router, prefix="/api/v1")


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "app": "Shadow DAM"}
