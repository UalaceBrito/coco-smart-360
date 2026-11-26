param(
  [string]$LanIp,
  [int]$Port = 13001
)

$ErrorActionPreference = "Stop"

$frontendRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$certificateDirectory = Join-Path $env:LOCALAPPDATA "CocoSmart360\certificates"
$publicCertificateDirectory = Join-Path $frontendRoot "public\local-https"
$caKey = Join-Path $certificateDirectory "coco-smart-360-root-key.pem"
$caCertificate = Join-Path $certificateDirectory "coco-smart-360-root.pem"
$serverKey = Join-Path $certificateDirectory "coco-smart-360-server-key.pem"
$serverCertificate = Join-Path $certificateDirectory "coco-smart-360-server.pem"
$serverRequest = Join-Path $certificateDirectory "coco-smart-360-server.csr"
$serverExtensions = Join-Path $certificateDirectory "coco-smart-360-server-extensions.cnf"
$phoneCertificate = Join-Path $publicCertificateDirectory "coco-smart-360-root.cer"
$iosProfile = Join-Path $publicCertificateDirectory "coco-smart-360-root.mobileconfig"
$openssl = (Get-Command openssl -ErrorAction Stop).Source

if (-not $LanIp) {
  $privateInterfaces = @(
    Get-NetConnectionProfile -ErrorAction Stop |
      Where-Object NetworkCategory -eq "Private" |
      ForEach-Object InterfaceAlias
  )

  $LanIp = Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred |
    Where-Object {
      $privateInterfaces -contains $_.InterfaceAlias -and
      $_.IPAddress -notmatch "^(127\.|169\.254\.)"
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
}

if (-not $LanIp) {
  throw "Nenhum IPv4 privado foi encontrado. Informe o endereço com -LanIp."
}

$parsedAddress = [System.Net.IPAddress]::Parse($LanIp)
if ($parsedAddress.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
  throw "O endereço de rede deve ser um IPv4."
}

$octets = $parsedAddress.GetAddressBytes()
$isPrivateAddress =
  $octets[0] -eq 10 -or
  ($octets[0] -eq 172 -and $octets[1] -ge 16 -and $octets[1] -le 31) -or
  ($octets[0] -eq 192 -and $octets[1] -eq 168)
if (-not $isPrivateAddress) {
  throw "Por segurança, o servidor HTTPS só pode ser vinculado a um endereço IPv4 privado."
}

$listeners = @(
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
)
if ($listeners.Count -gt 0) {
  $processIds = ($listeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
  throw "A porta $Port já está ocupada pelo(s) processo(s) $processIds. Escolha outra porta com -Port."
}

New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $publicCertificateDirectory -Force | Out-Null

$currentUserSid = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$currentUserPermission = "*{0}:F" -f $currentUserSid
$systemPermission = "*S-1-5-18:F"
$icacls = Join-Path $env:SystemRoot "System32\icacls.exe"

function Invoke-OpenSsl {
  param([string[]]$Arguments)

  & $openssl @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Falha ao executar OpenSSL: openssl $($Arguments -join ' ')"
  }
}

$hasCaKey = Test-Path $caKey
$hasCaCertificate = Test-Path $caCertificate
if ($hasCaKey -ne $hasCaCertificate) {
  throw "A autoridade local esta incompleta. Nao remova nem substitua somente um dos arquivos da CA."
}

if (-not $hasCaKey) {
  Invoke-OpenSsl @(
    "genpkey",
    "-algorithm", "RSA",
    "-pkeyopt", "rsa_keygen_bits:3072",
    "-out", $caKey
  )
  Invoke-OpenSsl @(
    "req",
    "-x509",
    "-new",
    "-key", $caKey,
    "-sha256",
    "-days", "3650",
    "-out", $caCertificate,
    "-subj", "/CN=COCO SMART 360 Local Root",
    "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
    "-addext", "keyUsage=critical,keyCertSign,cRLSign",
    "-addext", "subjectKeyIdentifier=hash"
  )
}

& $icacls $caKey /inheritance:r /grant:r $currentUserPermission $systemPermission /C | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Nao foi possivel restringir a chave privada da autoridade certificadora."
}

@"
[server_certificate]
basicConstraints=critical,CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=@alternative_names

[alternative_names]
DNS.1=localhost
IP.1=127.0.0.1
IP.2=$LanIp
"@ | Set-Content -LiteralPath $serverExtensions -Encoding ascii

Invoke-OpenSsl @(
  "genpkey",
  "-algorithm", "RSA",
  "-pkeyopt", "rsa_keygen_bits:2048",
  "-out", $serverKey
)
Invoke-OpenSsl @(
  "req",
  "-new",
  "-key", $serverKey,
  "-out", $serverRequest,
  "-subj", "/CN=COCO SMART 360 local server"
)
Invoke-OpenSsl @(
  "x509",
  "-req",
  "-in", $serverRequest,
  "-CA", $caCertificate,
  "-CAkey", $caKey,
  "-CAcreateserial",
  "-out", $serverCertificate,
  "-days", "825",
  "-sha256",
  "-extfile", $serverExtensions,
  "-extensions", "server_certificate"
)
Invoke-OpenSsl @(
  "verify",
  "-CAfile", $caCertificate,
  $serverCertificate
)
Invoke-OpenSsl @(
  "x509",
  "-in", $caCertificate,
  "-outform", "DER",
  "-out", $phoneCertificate
)
$rootCertificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($phoneCertificate)
$certificatePayloadId = [guid]::NewGuid().ToString().ToUpperInvariant()
$profilePayloadId = [guid]::NewGuid().ToString().ToUpperInvariant()
$certificateData = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($phoneCertificate))
$profile = @"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadContent</key>
      <data>$certificateData</data>
      <key>PayloadDescription</key>
      <string>Autoridade local do HTTPS do COCO SMART 360.</string>
      <key>PayloadDisplayName</key>
      <string>COCO SMART 360 Local Root</string>
      <key>PayloadIdentifier</key>
      <string>com.cocosmart360.localhttps.root</string>
      <key>PayloadType</key>
      <string>com.apple.security.root</string>
      <key>PayloadUUID</key>
      <string>$certificatePayloadId</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Certificado para instalar o PWA COCO SMART 360 nesta rede privada.</string>
  <key>PayloadDisplayName</key>
  <string>COCO SMART 360 Local HTTPS</string>
  <key>PayloadIdentifier</key>
  <string>com.cocosmart360.localhttps</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>$profilePayloadId</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>
"@
$profile | Set-Content -LiteralPath $iosProfile -Encoding utf8

$nextCommand = Join-Path $frontendRoot "node_modules\.bin\next.cmd"
if (-not (Test-Path $nextCommand)) {
  throw "Dependências do frontend não encontradas. Execute npm install em $frontendRoot."
}

$env:NEXT_DIST_DIR = ".next-https"
Write-Host "HTTPS local: https://${LanIp}:$Port/"
Write-Host "Certificado CA para instalar no celular: $phoneCertificate"
Write-Host "Perfil de certificado para iPhone/iPad: $iosProfile"
Write-Host "Impressao digital da CA: $($rootCertificate.Thumbprint)"
Write-Host "A CA e privada deste computador; nao compartilhe a chave coco-smart-360-root-key.pem."

Push-Location $frontendRoot
try {
  & $nextCommand dev `
    --hostname $LanIp `
    --port $Port `
    --experimental-https `
    --experimental-https-key $serverKey `
    --experimental-https-cert $serverCertificate
  if ($LASTEXITCODE -ne 0) {
    throw "O servidor Next.js terminou com código $LASTEXITCODE."
  }
}
finally {
  Pop-Location
}
