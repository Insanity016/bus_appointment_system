param([string]$Docx)
# Open in Word, refresh the table of contents and fields, save, export PDF.
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($Docx)
    foreach ($toc in $doc.TablesOfContents) { $toc.Update() }
    $doc.Fields.Update() | Out-Null
    $doc.Save()
    $pdf = [IO.Path]::ChangeExtension($Docx, '.pdf')
    $doc.ExportAsFixedFormat($pdf, 17)  # wdExportFormatPDF
    "pages: $($doc.ComputeStatistics(2))"
    $doc.Close()
    "pdf: $pdf"
} finally {
    $word.Quit()
}
