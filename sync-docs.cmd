@echo off
REM ============================================================================
REM  คัดลอกไฟล์โปรแกรมจากรากของ repo ไปยังโฟลเดอร์ docs ที่ GitHub Pages เผยแพร่
REM
REM  ตอนนี้ไฟล์เดียวกันมีสองชุด (ราก และ docs) ถ้าแก้ที่รากแล้วลืมสั่งสคริปต์นี้
REM  เว็บจะยังเป็นของเก่า ให้รันทุกครั้งหลังแก้ไฟล์ที่รากก่อน commit
REM
REM  วิธีใช้ :  double click หรือพิมพ์  sync-docs
REM ============================================================================

setlocal
cd /d "%~dp0"

echo.
echo   กำลังคัดลอกไฟล์โปรแกรมไปยัง docs\ ...
echo.

for %%F in (
  index.html
  user.js
  user.html
  master_shell.html
  manual.html
  asc_e_analysis.html
  asc_design.html
  asc_report.html
  asc_3d.html
  device_location.html
  asc-cloud.js
  supabase-config.js
) do (
  if exist "%%F" (
    copy /Y "%%F" "docs\%%F" >nul && echo     ok  %%F
  ) else (
    echo     ขาด %%F
  )
)

if not exist "docs\img" mkdir "docs\img"
copy /Y "img\pilogo.png" "docs\img\pilogo.png" >nul && echo     ok  img\pilogo.png
copy /Y "img\ld.gif"     "docs\img\ld.gif"     >nul && echo     ok  img\ld.gif

echo.
echo   เสร็จแล้ว  อย่าลืม  git add -A ^&^& git commit ^&^& git push
echo.
echo   หมายเหตุ  docs\mobi.html docs\manifest.json docs\sw.js และไอคอนของแอปมือถือ
echo             มีอยู่ใน docs เท่านั้น ไม่มีสำเนาที่ราก จึงไม่ถูกคัดลอกทับ
echo.
endlocal
