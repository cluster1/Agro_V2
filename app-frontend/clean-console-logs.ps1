# Script to remove console.log statements from TypeScript/TSX files
# Keeps console.error, console.warn for error handling

$sourceDir = "src"
$files = Get-ChildItem -Path $sourceDir -Include *.ts,*.tsx -Recurse

$totalRemoved = 0

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $originalContent = $content
    
    # Remove console.log statements (but keep console.error and console.warn)
    # Pattern matches:
    # - console.log('...') or console.log("...")
    # - console.log(`...`)
    # - Multi-line console.log
    $content = $content -replace "(?m)^\s*console\.log\([^)]*\)\s*$", ""
    $content = $content -replace "console\.log\([^)]*\)", ""
    
    # Remove empty lines that were left behind (max 2 consecutive empty lines)
    $content = $content -replace "(?m)^\s*$(\r?\n){3,}", "`r`n`r`n"
    
    if ($content -ne $originalContent) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
        $linesRemoved = ($originalContent.Length - $content.Length)
        $totalRemoved++
        Write-Host "✓ Cleaned: $($file.Name) " -ForegroundColor Green
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "✅ Cleanup Complete!" -ForegroundColor Green
Write-Host "Files processed: $totalRemoved" -ForegroundColor Yellow
Write-Host "========================================`n" -ForegroundColor Cyan
