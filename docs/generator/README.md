# Document generator

Builds `docs/FiveStar-Bus-System-Documentation.docx|pdf` (same layout as the
clinic and SJCMPC documents). Requires Node.js, Microsoft Edge (screenshots)
and Microsoft Word (table of contents and PDF).

The figures are screenshots of the **running prototype**, so they always match
what Five Star can click.

```powershell
# 1. Serve the prototype (repository root)
npm run build
npx vite preview --port 4180

# 2. In docs/generator
npm install
node shoot.js                 # writes shots/*.png (optional: node shoot.js http://localhost:5173)
node website-doc.js ../FiveStar-Bus-System-Documentation.docx
powershell -ExecutionPolicy Bypass -File finalize.ps1 -Docx (Resolve-Path ../FiveStar-Bus-System-Documentation.docx)
```

`shoot.js` lists every screenshot: page, staff account to sign in as, viewport,
clicks to run first, and the element to crop to. `finalize.ps1` refreshes the
contents and page numbers in Word and exports the PDF. `render.ps1 -Pdf <file>
-OutDir <dir>` renders PDF pages to PNG for a visual check.
