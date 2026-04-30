$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$port = 8000
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), $port)
$listener.Start()

Write-Host "Serving $root at http://127.0.0.1:$port/"

function Get-MimeType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '.html' { 'text/html; charset=utf-8' }
    '.css' { 'text/css; charset=utf-8' }
    '.js' { 'application/javascript; charset=utf-8' }
    '.json' { 'application/json' }
    '.geojson' { 'application/geo+json' }
    default { 'application/octet-stream' }
  }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()

    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()

      while (($line = $reader.ReadLine()) -ne $null -and $line -ne '') {}

      $relativePath = 'index.html'
      if ($requestLine -match '^GET\s+([^\s]+)') {
        $relativePath = [Uri]::UnescapeDataString($matches[1].Split('?')[0].TrimStart('/'))
      }
      if ([string]::IsNullOrWhiteSpace($relativePath)) {
        $relativePath = 'index.html'
      }

      $target = Join-Path $root $relativePath
      $resolved = $null
      try {
        $resolved = (Resolve-Path -LiteralPath $target -ErrorAction Stop).Path
      } catch {}

      if ($resolved -and $resolved.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolved -PathType Leaf)) {
        $bytes = [System.IO.File]::ReadAllBytes($resolved)
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $(Get-MimeType $resolved)`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($bytes, 0, $bytes.Length)
      } else {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($body, 0, $body.Length)
      }
    } finally {
      $client.Close()
    }
  }
} finally {
  $listener.Stop()
}
