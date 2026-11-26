# aisolar.dev — บันทึกการตั้งค่าโดเมน

## ผังโดเมน

| โดเมน | ชี้ไป | repo |
|-------|-------|------|
| `aisolar.dev` | ASC (หน้าหลัก) | `peeraponggis/asc` (branch main, /docs) |
| `www.aisolar.dev` | เด้งไป aisolar.dev | (GitHub ทำให้อัตโนมัติ) |
| `pi.aisolar.dev` | เว็บบริษัท PROINVENTIVE | `peeraponggis/webproinventive` (branch main, /) |

## DNS Records ที่ Cloudflare (เมฆเทา / DNS only)

| Type | Name | Content |
|------|------|---------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | peeraponggis.github.io |
| CNAME | pi | peeraponggis.github.io |

## Cloudflare API Token

- ชื่อ: `aisolar-dns`
- สิทธิ์: Zone > DNS > Edit (เฉพาะ aisolar.dev)
- เก็บที่: `F:\secrets\cloudflare-aisolar.txt` (นอก repo)

## ใบรับรอง HTTPS

- GitHub ออกให้อัตโนมัติ (Let's Encrypt) หมดอายุ 25 ก.พ. 2570
- Enforce HTTPS: เปิดทั้งสอง repo

## วิธีย้อนกลับ

1. ลบ custom domain ใน GitHub Pages Settings ของแต่ละ repo (หรือ `gh api -X PUT repos/peeraponggis/<repo>/pages -f cname=`)
2. ลบ DNS records ที่ Cloudflare
3. ลิงก์ github.io เดิมจะกลับมาใช้ได้ทันที

## ตั้งค่าเมื่อ

27 พ.ย. 2569 โดย ลุงพี
