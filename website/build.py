"""Build the static website into ../docs (served by GitHub Pages: Settings -> Pages -> Branch main, folder /docs).

    python website/build.py --repo https://github.com/<user>/<repo>

Inlines the HTML partials (<load ="..."/>), copies js/ css/ and the result figures. No Node/npm needed.
"""
import argparse
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DOCS = ROOT / "docs"
LOAD = re.compile(r'<load\s*="([^"]+)"\s*/>')


def inline(path: Path) -> str:
    html = path.read_text(encoding="utf-8")
    return LOAD.sub(lambda m: inline(HERE / m.group(1)), html)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", default="https://github.com/YOUR-USERNAME/YOUR-REPO", help="GitHub repository URL linked from the site")
    args = ap.parse_args()

    if DOCS.exists():
        shutil.rmtree(DOCS)
    DOCS.mkdir()
    html = inline(HERE / "index.html").replace("{{REPO_URL}}", args.repo.rstrip("/"))
    (DOCS / "index.html").write_text(html, encoding="utf-8")
    for d in ["js", "css"]:
        shutil.copytree(HERE / d, DOCS / d)
    shutil.copy(HERE / "logo.svg", DOCS / "logo.svg")
    shutil.copytree(ROOT / "results" / "figures", DOCS / "figures")
    (DOCS / ".nojekyll").write_text("")  # serve files as-is
    missing = [p for p in ["js/generated/site_data.js", "js/generated/model_lgbm.js"] if not (DOCS / p).exists()]
    if missing:
        print("WARNING: run notebooks/07_website_export.ipynb first, missing:", missing)
    size = sum(f.stat().st_size for f in DOCS.rglob("*") if f.is_file()) / 1e6
    print(f"built {DOCS} ({size:.1f} MB), repo link -> {args.repo}")


if __name__ == "__main__":
    main()
