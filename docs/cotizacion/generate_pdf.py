#!/usr/bin/env python3
"""
Genera el PDF de la propuesta comercial a partir del HTML template.

Uso:
    python3 generate_pdf.py

Requisitos:
    pip install weasyprint --break-system-packages
"""
import sys
from pathlib import Path
from weasyprint import HTML

HERE = Path(__file__).parent

def main():
    html_path = HERE / "propuesta.html"
    pdf_path = HERE / "propuesta.pdf"

    if not html_path.exists():
        print(f"ERROR: no se encontró {html_path}")
        sys.exit(1)

    print(f"Generando PDF desde {html_path.name}...")
    HTML(filename=str(html_path)).write_pdf(str(pdf_path))
    size_kb = pdf_path.stat().st_size / 1024
    print(f"✓ PDF generado: {pdf_path} ({size_kb:.1f} KB)")

if __name__ == "__main__":
    main()
