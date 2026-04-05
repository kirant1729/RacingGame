# serve.ps1 — Minimal static file server using .NET HttpListener
param([int]$Port = 3000)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $root on http://localhost:$Port/"

$mime = @{
  '.html' = 'text/html'; '.js'  = 'application/javascript'
  '.css'  = 'text/css';  '.png' = 'image/png'
  '.jpg'  = 'image/jpeg';'.ico' = 'image/x-icon'
  '.json' = 'application/json'; '.woff2' = 'font/woff2'
}

while ($listener.IsListening) {
  $ctx  = $listener.GetContext()
  $req  = $ctx.Request
  $resp = $ctx.Response

  $rel  = $req.Url.AbsolutePath.TrimStart('/')
  if ($rel -eq '') { $rel = 'index.html' }
  $file = Join-Path $root $rel

  if (Test-Path $file -PathType Leaf) {
    $ext  = [System.IO.Path]::GetExtension($file).ToLower()
    $ct   = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $resp.ContentType   = $ct
    $resp.ContentLength64 = $bytes.Length
    $resp.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $resp.StatusCode = 404
  }
  $resp.OutputStream.Close()
}
