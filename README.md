# Agro-Livestock Monitoring

Aplikasi web multi-tenant untuk memantau lingkungan dan peternakan/pertanian secara real-time: data sensor IoT, alert, dokumentasi foto, laporan, dan peta lokasi.

Update By 
- YGR 25102026

## Ringkasan

Hierarki data: **Tenant → Site → Cluster → Device → Sensor**. Setiap tenant hanya melihat datanya sendiri; admin global (level 0) dapat melihat semua tenant.

Fitur utama:
- Dashboard ringkasan, peta site (Leaflet), dan cuaca (diproksi lewat backend)
- Monitoring sensor dengan grafik riwayat (1 jam / 24 jam / 7 hari) dan indikator data tidak terbaru
- Alert/alarm dengan ekspor CSV
- Galeri media (foto/video) per site dan cluster
- Laporan dan ekspor Excel
- Manajemen tenant, user, site, cluster, device, dan sensor
- Role: admin, tenant_admin, operator, farmer, investor, viewer
- Tema terang/gelap, antarmuka berbahasa Indonesia, aksesibel (WCAG AA)

## Struktur Repo

| Folder | Isi |
|---|---|
| `app-backend/` | REST API (NestJS), migrasi SQL di `migrations/`, seed di `scripts/` |
| `app-frontend/` | Antarmuka web (Next.js) |


## Tech Stack

| Backend | Frontend |
|---|---|
| NestJS 10 (Express) | Next.js 14 (App Router), React 18 |
| TypeORM + MySQL/MariaDB | TypeScript, Tailwind CSS 3 |
| Passport (local + JWT), bcryptjs | Radix UI / shadcn, lucide-react |
| helmet, throttler, cookie-parser | Zustand, TanStack Query, Axios |
| multer (upload), exceljs (laporan) | React Hook Form + Zod |
| Swagger (opsional), Jest + supertest | Recharts, Leaflet, next-themes, sonner |

## Prasyarat

- Node.js 18 atau lebih baru (disarankan 24 LTS) dan npm
- MySQL 8 atau MariaDB 10.4+

## Instalasi Backend

```bash
cd app-backend
npm install
```

1. **Siapkan database (jika belum ada) **
   ```bash
   mysql -u root -p -e "CREATE DATABASE agro_db CHARACTER SET utf8mb4;"
   mysql -u root -p agro_db < ../MyAssets/agro_db.txt
   mysql -u root -p agro_db < scripts/seed-database.sql
   ```
2. **Jalankan migrasi** (wajib, sekali; membuat tabel refresh token):
   ```bash
   mysql -u root -p agro_db < migrations/add-refresh-token-table.sql
   ```
3. **Konfigurasi environment**: salin `.env.example` menjadi `.env` (Windows: `copy .env.example .env`), lalu isi:

   | Variabel | Keterangan |
   |---|---|
   | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Koneksi database |
   | `JWT_SECRET`, `JWT_REFRESH_SECRET` | String acak panjang (min. 32 karakter), **wajib diganti** |
   | `JWT_EXPIRATION` / `JWT_REFRESH_EXPIRATION` | Default `15m` / `7d` |
   | `CORS_ORIGIN` | Origin frontend, pisahkan dengan koma. Wajib di production |
   | `PORT`, `API_PREFIX` | Default `3001`, `api/v1` |
   | `OPENWEATHER_API_KEY` | Opsional, untuk widget cuaca |
   | `ENABLE_SWAGGER` | `true` untuk membuka Swagger UI (hanya development) |

4. **Jalankan**
   ```bash
   npm run start:dev      # development, watch mode
   npm run build          # build production
   npm run start:prod     # jalankan hasil build
   ```
   API: `http://localhost:3001/api/v1`

## Instalasi Frontend

```bash
cd app-frontend
npm install
copy .env.local.example .env.local     # Linux/macOS: cp
```

Isi `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
```

```bash
npm run dev        # development: http://localhost:3000
npm run build      # build production
npm start          # jalankan hasil build
```

Catatan:
- `.env.local` menimpa `.env.production`. Hapus atau ubah saat build production.
- Build production menolak `NEXT_PUBLIC_API_URL` yang bukan `https://`.
- Backend harus berjalan dan `CORS_ORIGIN` harus memuat origin frontend.

## Perintah Berguna

| Perintah | Lokasi | Fungsi |
|---|---|---|
| `npm test` | `app-backend` | Jalankan tes otomatis (tenant, role, token, upload, guard) |
| `npm run test:cov` | `app-backend` | Tes dengan coverage |
| `npm run lint` | keduanya | Lint |
| `npm run check:contrast` | `app-frontend` | Verifikasi kontras warna WCAG AA (terang dan gelap) |

## Keamanan

- Access token 15 menit (disimpan di memori), refresh token dirotasi dan disimpan sebagai cookie httpOnly SameSite=Strict.
- Rate limit login dan refresh, helmet, validasi input, upload dibatasi tipe file dan diperiksa magic byte.
- Isolasi data antar tenant dipaksa di backend lewat JWT, bukan dari input klien.
- Saat boot di production, backend menolak secret placeholder dan CORS kosong.
- Folder `app-backend/uploads/` tidak masuk version control. Salin dari server bila membutuhkan gambar yang sudah ada.

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| `NODE_OPTIONS is not recognized` (Windows) | Pakai `npm run dev` (sudah memakai `cross-env`) |
| Backend gagal start / login error 500 | Migrasi `add-refresh-token-table.sql` belum dijalankan |
| Request frontend diblokir CORS | Tambahkan origin frontend ke `CORS_ORIGIN` lalu restart backend |
| Gambar tampil "tidak tersedia" / 404 di `/uploads/...` | File tidak ada di `app-backend/uploads/`; salin dari server |
| Backend menolak start di production | Ganti `JWT_SECRET`, `JWT_REFRESH_SECRET`, dan isi `CORS_ORIGIN` |
| `next build` menolak API URL | Gunakan `https://` atau periksa `.env.local` yang menimpa `.env.production` |

 