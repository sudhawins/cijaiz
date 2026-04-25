# =====================================================
# SSL Certificate Generator for nginx
# =====================================================
# Purpose: Generate self-signed SSL certificates for local development
# Usage: .\generate-certs.ps1
# Note: For production, use Let's Encrypt or a trusted CA

# Configuration
$certPath = ".\ssl"
$certName = "nginx"
$daysValid = 365
$commonName = "localhost"

# Create ssl directory if it doesn't exist
if (-not (Test-Path $certPath)) {
    Write-Host "Creating $certPath directory..." -ForegroundColor Green
    New-Item -ItemType Directory -Path $certPath -Force | Out-Null
}

Write-Host "Generating self-signed SSL certificate..." -ForegroundColor Green
Write-Host "CN: $commonName" -ForegroundColor Yellow
Write-Host "Valid for: $daysValid days" -ForegroundColor Yellow

# Generate private key and self-signed certificate
$cert = New-SelfSignedCertificate -DnsName $commonName `
    -CertStoreLocation cert:\LocalMachine\My `
    -NotAfter (Get-Date).AddDays($daysValid) `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256

Write-Host "Certificate created: $($cert.Thumbprint)" -ForegroundColor Green

# Export private key
$password = ConvertTo-SecureString -AsPlainText -Force -String "temp_password"
$pfxPath = Join-Path $certPath "temp.pfx"

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null
Write-Host "PFX exported to: $pfxPath" -ForegroundColor Green

# Convert to PEM format (private key)
$openssl_cmd = @"
openssl pkcs12 -in $pfxPath -out $(Join-Path $certPath "$certName.key") -nocerts -passin pass:temp_password -passout pass:
"@

Write-Host "`nConverting to PEM format..." -ForegroundColor Green

# Try to use openssl if available
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    Invoke-Expression $openssl_cmd
    Write-Host "Private key exported to: $(Join-Path $certPath "$certName.key")" -ForegroundColor Green
} else {
    Write-Host "OpenSSL not found. Using alternative method..." -ForegroundColor Yellow
    
    # If openssl is not available, you can use WSL or install Git Bash
    # For now, provide instructions
    Write-Host @"
`nTo convert the certificate, you have two options:`n
Option 1: Install Git Bash or WSL and run the script again
Option 2: Use OpenSSL manually:`n
  openssl pkcs12 -in $pfxPath -out nginx.key -nocerts -passin pass:temp_password -passout pass:`n
Option 3: Use this PowerShell code:`n
  $cert = Get-Item $pfxPath
  # Use a .NET method to extract the key
"@ -ForegroundColor Yellow
}

# Export certificate
$certPath_full = Join-Path $certPath "$certName.crt"
Export-Certificate -Cert $cert -FilePath $certPath_full -Type CERT | Out-Null
Write-Host "Certificate exported to: $certPath_full" -ForegroundColor Green

# Clean up PFX
Remove-Item $pfxPath -Force -ErrorAction SilentlyContinue

Write-Host "`n" + "="*50 -ForegroundColor Green
Write-Host "SSL Certificate Generation Complete!" -ForegroundColor Green
Write-Host "="*50 -ForegroundColor Green

Write-Host @"
`nCertificate Details:
  Subject: $commonName
  Thumbprint: $($cert.Thumbprint)
  Valid Until: $($cert.NotAfter)
  Certificate File: $certPath_full
  Key File: $(Join-Path $certPath "$certName.key")

Next Steps:
1. If you haven't already, convert the certificate to PEM format using OpenSSL
2. Run: docker-compose up
3. Access the application at: https://localhost

Browser Warning:
Since this is a self-signed certificate, your browser will show a security warning.
Click "Advanced" or "Proceed" to accept and continue (development only).

For Production:
- Use Let's Encrypt for free certificates
- Update VITE_API_URL and frontend config to use https://your-domain.com
- See SSL_SETUP_GUIDE.md for more details
"@
