# ============================================================================
#  ASC Studio — เพิ่ม Copyright Header ในไฟล์ JS ทุกไฟล์
#  Copyright © 2024–2569 ProInventive · All rights reserved.
#
#  รันครั้งเดียว: .\add-copyright-headers.ps1
#  สคริปต์ตรวจสอบก่อนว่ามี header แล้วหรือไม่ ถ้ามีแล้วจะข้ามไฟล์นั้น
# ============================================================================

$ErrorActionPreference = 'Stop'
$DocsDir = Join-Path $PSScriptRoot 'docs'

$HEADER = @'
/* ============================================================================
 *  Auto Solar Co-pilot Studio (ASC Studio / ASCS)
 *  Copyright (C) 2024-2569 ProInventive. All rights reserved.
 *
 *  PROPRIETARY AND CONFIDENTIAL
 *  This software is the exclusive property of ProInventive.
 *  Unauthorized copying, reverse engineering, decompilation, or distribution
 *  of this file, in whole or in part, is strictly prohibited.
 *
 *  License : Proprietary -- see EULA at https://proinventive.co.th/asc-eula
 *  Author  : Peerapong (Lungpee) -- ProInventive -- giskku@gmail.com
 * ========================================================================== */

'@

$JsFiles = Get-ChildItem -Path $DocsDir -Filter '*.js' -Recurse |
           Sort-Object FullName

$Added   = 0
$Skipped = 0

foreach ($f in $JsFiles) {
    $content = Get-Content -Raw -Encoding UTF8 $f.FullName

    # ข้ามถ้ามี copyright header แล้ว
    if ($content -match 'Copyright \(C\) 2024-2569 ProInventive') {
        Write-Host "  [ข้าม]  $($f.Name)" -ForegroundColor DarkGray
        $Skipped++
        continue
    }

    # เพิ่ม header ด้านบน
    $newContent = $HEADER + $content
    [System.IO.File]::WriteAllText($f.FullName, $newContent, [System.Text.Encoding]::UTF8)
    Write-Host "  [เพิ่ม]  $($f.Name)" -ForegroundColor Green
    $Added++
}

Write-Host ""
Write-Host "สำเร็จ: เพิ่ม $Added ไฟล์, ข้าม $Skipped ไฟล์" -ForegroundColor Cyan
