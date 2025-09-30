# Clear any previous files
Remove-Item stdout.txt, stderr.txt -ErrorAction SilentlyContinue

# Run with separated outputs
$env:SPEC_BRIDGE_PAYLOAD = '{"url": "https://www.homedepot.com/p/DEWALT-20V-MAX-Cordless-Drill-Driver-Kit-DCD771C2/204279858", "options": {"method": "requests"}}'
$env:OPENAI_API_KEY = ""
$env:FIRECRAWL_API_KEY = ""

$process = Start-Process -FilePath ".\electron_bridge.exe" `
    -RedirectStandardOutput "stdout.txt" `
    -RedirectStandardError "stderr.txt" `
    -Wait -PassThru -NoNewWindow

Write-Host "Exit code: $($process.ExitCode)"
Write-Host "`n=== STDOUT ===" -ForegroundColor Green
Get-Content stdout.txt
Write-Host "`n=== STDERR ===" -ForegroundColor Yellow
Get-Content stderr.txt