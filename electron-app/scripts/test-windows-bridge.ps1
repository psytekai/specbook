# Clear any previous files
Remove-Item stdout.txt, stderr.txt -ErrorAction SilentlyContinue

# Run with separated outputs
$env:SPEC_BRIDGE_PAYLOAD = '{"url": "https://www.homedepot.com/p/DEWALT-20V-MAX-Cordless-Drill-Driver-Kit-DCD771C2/204279858", "options": {"method": "requests"}}'
$env:OPENAI_API_KEY = "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"
$env:FIRECRAWL_API_KEY = "fc-de6666a8b66346bab82f30de8b6f9abds"

$process = Start-Process -FilePath ".\electron_bridge.exe" `
    -RedirectStandardOutput "stdout.txt" `
    -RedirectStandardError "stderr.txt" `
    -Wait -PassThru -NoNewWindow

Write-Host "Exit code: $($process.ExitCode)"
Write-Host "`n=== STDOUT ===" -ForegroundColor Green
Get-Content stdout.txt
Write-Host "`n=== STDERR ===" -ForegroundColor Yellow
Get-Content stderr.txt