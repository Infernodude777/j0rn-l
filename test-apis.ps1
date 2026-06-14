$ErrorActionPreference = 'Continue'
$key = 'BLACKBOX_API_KEY'
Write-Host '---TEST-1-BLACKBOX-LITERAL-KEY---'
$body = '{"model":"blackboxai/minimax/minimax-free","messages":[{"role":"user","content":"Say hello in 5 words"}],"max_tokens":50}'
try {
  $resp = Invoke-WebRequest -Uri 'https://api.blackbox.ai/v1/chat/completions' -Method POST -Headers @{"Authorization"="Bearer $key";"Content-Type"="application/json"} -Body $body -TimeoutSec 30
  Write-Host ("Status: " + $resp.StatusCode)
  Write-Host ("Body: " + $resp.Content.Substring(0, [Math]::Min(600, $resp.Content.Length)))
} catch {
  Write-Host ("Error: " + $_.Exception.Message)
  if ($_.Exception.Response) {
    try {
      $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      Write-Host ("Body: " + $sr.ReadToEnd())
    } catch {}
  }
}
Write-Host ''
Write-Host '---TEST-2-NVIDIA-NIM-MODELS---'
$wkey = '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'
try {
  $resp2 = Invoke-WebRequest -Uri 'https://integrate.api.nvidia.com/v1/models' -Method GET -Headers @{"Authorization"="Bearer $wkey"} -TimeoutSec 30
  Write-Host ("NVIDIA Status: " + $resp2.StatusCode)
  Write-Host ("Body: " + $resp2.Content.Substring(0, [Math]::Min(600, $resp2.Content.Length)))
} catch {
  Write-Host ("NVIDIA Error: " + $_.Exception.Message)
}
Write-Host ''
Write-Host '---TEST-3-ENV-LOCAL---'
Get-Content .env.local
