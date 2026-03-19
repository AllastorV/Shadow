"""
marker_service.py — Marker'ları sidecar ve dosya içi metadata olarak yazar.

Desteklenen export formatları:
  • XMP sidecar (.xmp)  — Adobe Premiere Pro, After Effects, Bridge
  • FCPXML sidecar (.fcpxml) — DaVinci Resolve, Final Cut Pro
  • PNG/TIFF dosya içi XMP — doğrudan dosyaya gömülü (kayıpsız)

Video formatları: MP4, MOV, H.264, H.265/HEVC, AVI, MKV, WebM
Gorsel formatları: PNG, JPG/JPEG, TIFF/TIF
"""

import logging
import os
from pathlib import Path
from xml.sax.saxutils import escape as xml_escape
from typing import Optional

logger = logging.getLogger(__name__)

# Premiere Pro zaman tabanı: saniye başına tik
# Çoğu medya formatı için 254016000 tik/saniye standart değerdir.
_PREMIERE_TICKS_PER_SEC = 254016000


def _ticks(seconds: float) -> int:
    return int(seconds * _PREMIERE_TICKS_PER_SEC)


def _fcpxml_time(seconds: float) -> str:
    """Saniyeyi FCPXML rasyonel zaman formatına dönüştür (ör. 10000/1000s)."""
    ms = round(seconds * 1000)
    return f"{ms}/1000s"


# ── XMP Sidecar ───────────────────────────────────────────────────────────────

def generate_xmp(markers: list[dict], asset_name: str) -> str:
    """
    Adobe XMP Dynamic Media (xmpDM) paketi oluştur.
    Premiere Pro bu formatı doğrudan okur; sidecar dosyası medya dosyasıyla
    aynı dizinde aynı adda .xmp uzantısıyla yer almalıdır.
    """
    items = []
    for m in sorted(markers, key=lambda x: (x.get("timestamp") or 0)):
        start = _ticks(m.get("timestamp") or 0)
        dur = _ticks(m.get("duration_sec") or 0)
        label = xml_escape(m.get("label") or "Marker")
        note = xml_escape(m.get("note") or "")
        color = m.get("color", "red")
        items.append(f"""\
      <rdf:li rdf:parseType="Resource">
        <xmpDM:startTime>{start}</xmpDM:startTime>
        <xmpDM:duration>{dur}</xmpDM:duration>
        <xmpDM:name>{label}</xmpDM:name>
        <xmpDM:comment>{note}</xmpDM:comment>
        <xmpDM:type>Comment</xmpDM:type>
        <xmpDM:markerColor>{color}</xmpDM:markerColor>
      </rdf:li>""")

    body = "\n".join(items)
    title = xml_escape(asset_name)

    return (
        '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Shadow DAM 1.0">\n'
        '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n'
        '    <rdf:Description rdf:about=""\n'
        '        xmlns:xmpDM="http://ns.adobe.com/xmp/1.0/DynamicMedia/"\n'
        '        xmlns:dc="http://purl.org/dc/elements/1.1/">\n'
        '      <dc:title>\n'
        '        <rdf:Alt><rdf:li xml:lang="x-default">' + title + '</rdf:li></rdf:Alt>\n'
        '      </dc:title>\n'
        '      <xmpDM:markers>\n'
        '        <rdf:Seq>\n'
        + body + '\n'
        '        </rdf:Seq>\n'
        '      </xmpDM:markers>\n'
        '    </rdf:Description>\n'
        '  </rdf:RDF>\n'
        '</x:xmpmeta>\n'
        '<?xpacket end="w"?>'
    )


# ── FCPXML Sidecar ────────────────────────────────────────────────────────────

def generate_fcpxml(
    markers: list[dict],
    asset_name: str,
    file_path: str,
    duration: float = 0.0,
) -> str:
    """
    FCPXML v1.10 sidecar oluştur.
    DaVinci Resolve ve Final Cut Pro tarafından okunur.
    Resolve'da: File → Import → Timeline / Markers
    """
    abs_path = os.path.abspath(file_path)
    # Windows yollarını da destekle
    file_uri = Path(abs_path).as_uri()

    total_dur = _fcpxml_time(duration) if duration > 0 else "0s"
    name_esc = xml_escape(asset_name)
    uri_esc = xml_escape(file_uri)

    marker_lines = []
    for m in sorted(markers, key=lambda x: (x.get("timestamp") or 0)):
        ts = m.get("timestamp") or 0
        dur_m = m.get("duration_sec") or 0
        val = xml_escape(m.get("label") or "Marker")
        note = xml_escape(m.get("note") or "")
        color = m.get("color", "red")
        # DaVinci Resolve marker renk formatı
        resolve_colors = {
            "red": "Red", "green": "Green", "blue": "Blue",
            "yellow": "Yellow", "purple": "Purple",
            "orange": "Orange", "cyan": "Cyan",
        }
        rc = resolve_colors.get(color, "Red")
        marker_lines.append(
            f'              <marker start="{_fcpxml_time(ts)}" '
            f'duration="{_fcpxml_time(dur_m)}" '
            f'value="{val}" note="{note}" '
            f'markerColor="{rc}" completed="0"/>'
        )

    markers_xml = "\n".join(marker_lines)

    return f"""\
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.10">
  <resources>
    <format id="r1" name="FFVideoFormat1080p25" frameDuration="100/2500s"/>
    <asset id="r2" name="{name_esc}" start="0s" duration="{total_dur}" hasVideo="1" hasAudio="1">
      <media-rep kind="original-media" src="{uri_esc}"/>
    </asset>
  </resources>
  <library>
    <event name="Shadow Markers">
      <project name="{name_esc}">
        <sequence format="r1" duration="{total_dur}" tcStart="0s" tcFormat="NDF" audioLayout="stereo">
          <spine>
            <asset-clip ref="r2" offset="0s" name="{name_esc}" duration="{total_dur}" format="r1">
{markers_xml}
            </asset-clip>
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>"""


# ── Dosyaya XMP Gömme ─────────────────────────────────────────────────────────

def _embed_xmp_png(file_path: str, xmp_str: str) -> bool:
    """PNG dosyasına XMP metadata göm (kayıpsız)."""
    try:
        from PIL import Image, PngImagePlugin
        img = Image.open(file_path)
        pnginfo = PngImagePlugin.PngInfo()
        pnginfo.add_itxt("XML:com.adobe.xmp", xmp_str, zip=False)
        tmp = file_path + ".shadow_tmp"
        img.save(tmp, format="PNG", pnginfo=pnginfo)
        img.close()
        os.replace(tmp, file_path)
        return True
    except Exception as exc:
        logger.warning(f"PNG XMP embed failed ({file_path}): {exc}")
        if os.path.exists(file_path + ".shadow_tmp"):
            os.remove(file_path + ".shadow_tmp")
        return False


def _embed_xmp_tiff(file_path: str, xmp_bytes: bytes) -> bool:
    """TIFF dosyasına XMP metadata göm — TIFF tag 700 (kayıpsız)."""
    try:
        from PIL import Image, TiffImagePlugin
        img = Image.open(file_path)
        ifd = TiffImagePlugin.ImageFileDirectory_v2()
        ifd[700] = xmp_bytes  # XMP Packet tag
        tmp = file_path + ".shadow_tmp"
        # Orijinal sıkıştırma ayarlarını koru
        compression = img.info.get("compression", "raw")
        img.save(tmp, format="TIFF", tiffinfo=ifd, compression=compression)
        img.close()
        os.replace(tmp, file_path)
        return True
    except Exception as exc:
        logger.warning(f"TIFF XMP embed failed ({file_path}): {exc}")
        if os.path.exists(file_path + ".shadow_tmp"):
            os.remove(file_path + ".shadow_tmp")
        return False


# ── Ana Senkronizasyon Fonksiyonu ─────────────────────────────────────────────

def sync_markers_to_files(
    file_path: str,
    markers: list[dict],
    asset_name: str,
    asset_type: str,
    duration: float = 0.0,
) -> None:
    """
    Marker'ları dosyalara yaz. Background task olarak çağrılır.

    Her zaman:
      • <dosya>.xmp sidecar yazar (Premiere Pro)

    Video/audio için ek olarak:
      • <dosya>.fcpxml sidecar yazar (DaVinci Resolve, Final Cut Pro)

    Gorsel için ek olarak:
      • PNG ve TIFF: XMP doğrudan dosyaya gömülür (kayıpsız)
      • JPEG: yalnızca sidecar (yeniden sıkıştırma kayıplarını önlemek için)
    """
    fp = Path(file_path)
    if not fp.exists():
        logger.warning(f"sync_markers_to_files: file not found: {file_path}")
        return

    xmp_str = generate_xmp(markers, asset_name)
    xmp_path = fp.with_suffix(".xmp")

    # 1. XMP sidecar — her format için
    try:
        xmp_path.write_text(xmp_str, encoding="utf-8")
        logger.info(f"XMP sidecar updated: {xmp_path} ({len(markers)} markers)")
    except Exception as exc:
        logger.error(f"XMP sidecar write failed: {exc}")

    # 2. FCPXML sidecar — video ve audio
    if asset_type in ("video", "audio"):
        try:
            fcpxml_str = generate_fcpxml(markers, asset_name, file_path, duration)
            fcpxml_path = fp.with_suffix(".fcpxml")
            fcpxml_path.write_text(fcpxml_str, encoding="utf-8")
            logger.info(f"FCPXML sidecar updated: {fcpxml_path}")
        except Exception as exc:
            logger.error(f"FCPXML sidecar write failed: {exc}")

    # 3. Dosya içi XMP — kayıpsız gorsel formatları
    if asset_type == "image":
        ext = fp.suffix.lower()
        if ext == ".png":
            _embed_xmp_png(file_path, xmp_str)
        elif ext in (".tif", ".tiff"):
            _embed_xmp_tiff(file_path, xmp_str.encode("utf-8"))
        # JPEG: sidecar yeterli, yeniden sıkıştırma kalite kaybı yaratır
