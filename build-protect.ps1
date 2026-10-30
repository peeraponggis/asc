# ============================================================================
#  ASC Studio — IP Protection Build Script
#  Copyright © 2024–2569 ProInventive · All rights reserved.
#
#  ขั้นตอน:
#    1. ติดตั้ง javascript-obfuscator (ครั้งแรกเท่านั้น)
#    2. คัดลอก docs/ → dist/
#    3. Obfuscate JS ทุกไฟล์ใน dist/ (ยกเว้น sw.js และไฟล์ CDN)
#    4. ไฟล์ dist/ พร้อม deploy ขึ้น Cloudflare Pages
#
#  วิธีใช้:
#    .\build-protect.ps1                    (build ปกติ)
#    .\build-protect.ps1 -SkipObfuscate     (build เร็ว ไม่ obfuscate)
#    .\build-protect.ps1 -CleanDist         (ลบ dist/ ก่อน build ใหม่)
# ============================================================================

param(
    [switch]$SkipObfuscate,
    [switch]$CleanDist
)

$ErrorActionPreference = 'Stop'
$Root   = $PSScriptRoot
$Docs   = Join-Path $Root 'docs'
$Dist   = Join-Path $Root 'dist'
$NpmDir = Join-Path $Root 'node_modules'

# ── ตรวจ Node.js ──────────────────────────────────────────────────────────
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "ไม่พบ Node.js — ดาวน์โหลดจาก https://nodejs.org แล้วติดตั้งใน F:\NodeJS\"
    exit 1
}

# ── ติดตั้ง javascript-obfuscator ──────────────────────────────────────────
if (-not $SkipObfuscate) {
    $ObfBin = Join-Path $NpmDir '.bin\javascript-obfuscator.cmd'
    if (-not (Test-Path $ObfBin)) {
        Write-Host "กำลังติดตั้ง javascript-obfuscator..." -ForegroundColor Cyan
        Push-Location $Root
        # บันทึก npm cache ไว้ใน F: drive ไม่ใช้ C:
        $env:npm_config_cache = 'F:\.npm-cache'
        npm install --save-dev javascript-obfuscator --prefix $Root
        Pop-Location
    }
}

# ── ล้าง dist/ ────────────────────────────────────────────────────────────
if ($CleanDist -and (Test-Path $Dist)) {
    Remove-Item -Recurse -Force $Dist
    Write-Host "ลบ dist/ แล้ว" -ForegroundColor Yellow
}

# ── คัดลอก docs/ → dist/ ──────────────────────────────────────────────────
Write-Host "คัดลอก docs/ → dist/ ..." -ForegroundColor Cyan
if (-not (Test-Path $Dist)) { New-Item -ItemType Directory -Path $Dist | Out-Null }
Copy-Item -Recurse -Force (Join-Path $Docs '*') $Dist

# ── Obfuscate JS ──────────────────────────────────────────────────────────
if (-not $SkipObfuscate) {
    Write-Host "กำลัง Obfuscate JavaScript ..." -ForegroundColor Cyan

    # ไฟล์ที่ไม่ obfuscate (Service Worker ต้อง readable / vendor CDN)
    $Skip = @('sw.js', 'supabase-config.js')

    $ObfBin = Join-Path $NpmDir '.bin\javascript-obfuscator.cmd'
    $JsFiles = Get-ChildItem -Recurse -Filter '*.js' $Dist |
               Where-Object { $Skip -notcontains $_.Name }

    foreach ($f in $JsFiles) {
        Write-Host "  → $($f.Name)" -ForegroundColor DarkGray
        & $ObfBin $f.FullName `
            --output $f.FullName `
            --compact true `
            --control-flow-flattening false `
            --dead-code-injection false `
            --debug-protection false `
            --disable-console-output false `
            --identifier-names-generator hexadecimal `
            --rename-globals false `
            --self-defending true `
            --string-array true `
            --string-array-encoding base64 `
            --string-array-threshold 0.75 `
            --unicode-escape-sequence false 2>&1 | Out-Null
    }
    Write-Host "Obfuscate สำเร็จ ($($JsFiles.Count) ไฟล์)" -ForegroundColor Green
} else {
    Write-Host "ข้ามขั้นตอน Obfuscate (--SkipObfuscate)" -ForegroundColor Yellow
}

# ── สรุป ──────────────────────────────────────────────────────────────────
$DistSize = (Get-ChildItem -Recurse $Dist | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host ""
Write-Host "Build สำเร็จ!" -ForegroundColor Green
Write-Host "  ผลลัพธ์: $Dist"
Write-Host "  ขนาด:   $([math]::Round($DistSize,2)) MB"
Write-Host ""
Write-Host "Deploy ขึ้น Cloudflare Pages:" -ForegroundColor Cyan
Write-Host "  npx wrangler pages deploy dist --project-name asc-studio"
Write-Host ""
