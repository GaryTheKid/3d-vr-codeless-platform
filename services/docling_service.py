from docling.document_converter import DocumentConverter


class DoclingService:
    def __init__(self):
        self.converter = DocumentConverter()

    def convert_document(self, file_path: str) -> str:
        result = self.converter.convert(file_path)
        return result.document.export_to_markdown()


docling_service = DoclingService()