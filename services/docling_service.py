# ═══════════════════════════════════════════════════════════════
#  Docling document → Markdown + extracted images
#  Lazy-imports Docling so server.py can start even before pip install.
# ═══════════════════════════════════════════════════════════════
from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any


class DoclingUnavailable(RuntimeError):
    pass


class DoclingService:
    def __init__(self):
        self._converter = None

    def _get_converter(self):
        if self._converter is not None:
            return self._converter
        try:
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions
            from docling.datamodel.settings import settings as docling_settings
            from docling.document_converter import DocumentConverter, PdfFormatOption
        except ImportError as e:
            raise DoclingUnavailable(
                'Docling is not installed. From the repo root run: '
                'python install_requirements.py'
            ) from e

        # torch.compile pulls torch._inductor, which opens UTF-8 kernel templates
        # with the process default encoding. On Chinese Windows that is GBK and
        # crashes with UnicodeDecodeError. Inference still uses CUDA when available.
        docling_settings.inference.compile_torch_models = False
        # Large PDFs + RapidOCR easily OOM (std::bad_alloc). Process one page at a time.
        docling_settings.perf.page_batch_size = 1
        docling_settings.perf.page_batch_concurrency = 1
        docling_settings.perf.elements_batch_size = 8

        pdf_opts = PdfPipelineOptions()
        pdf_opts.generate_picture_images = True
        pdf_opts.images_scale = 1.0  # 2.0 doubles raster RAM per page
        # OCR is the main memory hog (RapidOCR/ONNX). Most teaching PDFs already
        # have a text layer; enable only when needed: DOCLING_OCR=1
        pdf_opts.do_ocr = os.environ.get('DOCLING_OCR', '').strip() in ('1', 'true', 'True', 'yes')
        pdf_opts.do_table_structure = True
        self._converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_opts),
            }
        )
        return self._converter

    def convert_document(self, file_path: str, out_dir: str, url_prefix: str) -> dict[str, Any]:
        """Convert a document to markdown and extract embedded pictures.

        Returns:
          {
            markdown: str,          # image links rewritten to url_prefix/images/...
            images: [{id, filename, url, width?, height?}, ...],
            markdown_path: str,     # relative filesystem path under repo root (posix)
          }
        """
        converter = self._get_converter()
        from docling_core.types.doc import ImageRefMode, PictureItem

        out = Path(out_dir)
        img_dir = out / 'images'
        img_dir.mkdir(parents=True, exist_ok=True)

        result = converter.convert(file_path)
        doc = result.document

        images: list[dict[str, Any]] = []
        pic_idx = 0
        for element, _level in doc.iterate_items():
            if not isinstance(element, PictureItem):
                continue
            pic_idx += 1
            try:
                pil = element.get_image(doc)
            except Exception:
                pil = None
            if pil is None:
                continue
            fname = f'picture_{pic_idx:02d}.png'
            pil.save(img_dir / fname, format='PNG')
            entry = {
                'id': f'picture_{pic_idx:02d}',
                'filename': fname,
                'url': f'{url_prefix}/images/{fname}',
                'order': pic_idx,
                'anchor': {
                    'kind': 'figure',
                    'order': pic_idx,
                },
            }
            try:
                entry['width'], entry['height'] = pil.size
            except Exception:
                pass
            images.append(entry)

        # Prefer referenced mode so markdown keeps ![](...) slots; then rewrite to our URLs.
        try:
            md = doc.export_to_markdown(image_mode=ImageRefMode.REFERENCED)
        except TypeError:
            md = doc.export_to_markdown()

        md = _rewrite_image_links(md, images, url_prefix)
        _attach_md_anchors(md, images)
        md_path = out / 'content.md'
        md_path.write_text(md, encoding='utf-8')

        return {
            'markdown': md,
            'images': images,
            'markdown_path': md_path.as_posix(),
        }


_IMG_MD = re.compile(r'!\[[^\]]*\]\(([^)]+)\)')


def _attach_md_anchors(md: str, images: list[dict]) -> None:
    """Fill positional anchors: char offset in markdown + nearest heading above."""
    for im in images:
        url = im.get('url') or ''
        pos = md.find(url) if url else -1
        anchor = im.setdefault('anchor', {})
        anchor['order'] = im.get('order') or anchor.get('order')
        if pos >= 0:
            anchor['mdCharOffset'] = pos
            head = md.rfind('\n#', 0, pos)
            if head >= 0:
                line = md[head + 1:md.find('\n', head + 1)].strip()
                anchor['nearHeading'] = re.sub(r'^#+\s*', '', line)[:120]
        else:
            anchor.setdefault('mdCharOffset', None)


def _rewrite_image_links(md: str, images: list[dict], url_prefix: str) -> str:
    """Map Docling's local/placeholder image refs onto our served /uploads/... URLs."""
    if not images:
        return md

    by_name = {im['filename']: im['url'] for im in images}
    queue = list(images)
    used = 0

    def repl(m: re.Match) -> str:
        nonlocal used
        raw = m.group(1).strip().strip('"\'')
        base = os.path.basename(raw.split('?')[0])
        if base in by_name:
            return m.group(0).replace(m.group(1), by_name[base])
        # Sequential fallback for placeholders like picture-1 / art_1.png
        if used < len(queue):
            url = queue[used]['url']
            used += 1
            return f'![image]({url})'
        return m.group(0)

    md2 = _IMG_MD.sub(repl, md)

    # If markdown had no image slots but we extracted pictures, append a gallery.
    if images and not _IMG_MD.search(md):
        lines = ['', '## Extracted figures', '']
        for im in images:
            lines.append(f'![{im["id"]}]({im["url"]})')
            lines.append('')
        md2 = md2.rstrip() + '\n' + '\n'.join(lines)

    return md2


docling_service = DoclingService()
