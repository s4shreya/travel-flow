"""Receipt text extraction: embedded PDF text first, Tesseract OCR as fallback."""

import threading
from pathlib import Path

import pypdfium2 as pdfium
import pytesseract
from PIL import Image, ImageOps

from core.config import logger
from core.exceptions import AppException

MAX_PDF_PAGES = 3  # receipts are short; cap work on long PDFs
MIN_EMBEDDED_TEXT = 40  # below this a PDF is treated as a scan
OCR_TIMEOUT_SECONDS = 30
# --psm 4: single column of variable-size text (typical receipt layout)
TESSERACT_CONFIG = "--oem 3 --psm 4"
# PDFium is not thread-safe and sync routes run in a thread pool: one PDF at a time
_PDFIUM_LOCK = threading.Lock()


def extract_text(path: Path, content_type: str) -> str:
    """Return the receipt's text (may be empty if nothing is readable)."""
    if content_type == "application/pdf":
        return _pdf_text(path)
    with Image.open(path) as image:
        return _ocr(image)


def _pdf_text(path: Path) -> str:
    # PDFium work stays under the lock; OCR (a Tesseract subprocess) runs outside it
    with _PDFIUM_LOCK:
        pdf = pdfium.PdfDocument(str(path))
        try:
            count = min(len(pdf), MAX_PDF_PAGES)
            # Digital PDFs (e-invoices, cab/airline mails) already contain text
            text = "\n".join(_page_text(pdf, i) for i in range(count))
            # Scanned PDF: render pages at ~300 DPI for OCR
            scans = [] if len(text.strip()) >= MIN_EMBEDDED_TEXT else [_page_image(pdf, i) for i in range(count)]
        finally:
            pdf.close()
    if not scans:
        return text
    return "\n".join(_ocr(image) for image in scans)


# Child objects are closed before their page / document, or PDFium double-frees them
def _page_text(pdf: pdfium.PdfDocument, index: int) -> str:
    page = pdf[index]
    try:
        textpage = page.get_textpage()
        try:
            return textpage.get_text_range()
        finally:
            textpage.close()
    finally:
        page.close()


def _page_image(pdf: pdfium.PdfDocument, index: int) -> Image.Image:
    page = pdf[index]
    try:
        bitmap = page.render(scale=300 / 72)
        try:
            # copy: the PIL image would otherwise share the bitmap's memory
            return bitmap.to_pil().copy()
        finally:
            bitmap.close()
    finally:
        page.close()


def _prepare(image: Image.Image) -> Image.Image:
    # Respect phone rotation, drop colour, stretch contrast
    image = ImageOps.exif_transpose(image)
    image = ImageOps.grayscale(image)
    # Small photos OCR badly; upscale to ~1800px wide
    if image.width < 1800:
        ratio = 1800 / image.width
        image = image.resize((1800, int(image.height * ratio)), Image.Resampling.LANCZOS)
    return ImageOps.autocontrast(image)


def _ocr(image: Image.Image) -> str:
    try:
        return pytesseract.image_to_string(
            _prepare(image), lang="eng", config=TESSERACT_CONFIG, timeout=OCR_TIMEOUT_SECONDS
        )
    except pytesseract.TesseractNotFoundError as exc:
        logger.error("Tesseract binary not installed")
        raise AppException(
            status_code=503,
            sub_status_code="ocr_unavailable",
            message="Receipt scanning is unavailable right now. Please fill the details manually.",
        ) from exc
    except RuntimeError as exc:
        # pytesseract raises RuntimeError on timeout
        logger.warning(f"OCR timed out: {exc}")
        raise AppException(
            status_code=422,
            sub_status_code="ocr_timeout",
            message="This receipt took too long to read. Please fill the details manually.",
        ) from exc
