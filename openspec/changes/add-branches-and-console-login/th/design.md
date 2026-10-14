> ฉบับแปลภาษาไทยของ `../design.md` — ไฟล์ภาษาอังกฤษคือฉบับหลัก หากเนื้อหาขัดกัน ให้ยึดฉบับภาษาอังกฤษ

# การออกแบบ (Design)

## บริบท (Context)

สถานะปัจจุบัน: โต๊ะระบุด้วย `tables.number` ที่ไม่ซ้ำทั้งระบบ route ฝั่งลูกค้าคือ `/t/[table]` และ `/api/tables/[table]/…` route ของคอนโซลคือ `/console`, `/console/history`, `/console/bills/[id]/print` และ `/api/console/…` ซึ่งทั้งหมดไม่มีการยืนยันตัวตน กฎทางธุรกิจอยู่ใน `lib/service.ts` เลขบิลสร้างด้วย SQL ใน `openSession()` ใช้ Postgres ผ่าน Drizzle + `pg` และ Next.js 16 ที่เปิด Cache Components (ข้อมูลจาก request ต้องอ่านภายใน `<Suspense>` หรือใน route handler) เหตุผลของการเปลี่ยนแปลงดูที่ proposal.md – Why

## เป้าหมาย / สิ่งที่ไม่ทำ (Goals / Non-Goals)

**เป้าหมาย:**
- โมเดลข้อมูลที่รู้จักสาขา พร้อม migration ที่ย้ายข้อมูลเดิมไปสาขา SIAM อย่างปลอดภัย
- การล็อกอินของพนักงานและการอนุญาตตามขอบเขตสาขา บังคับใช้ในโค้ดฝั่งเซิร์ฟเวอร์สำหรับทุกหน้าและทุก API ของคอนโซล
- ไม่เพิ่ม dependency ใหม่

**สิ่งที่ไม่ทำ:**
- framework สำหรับ auth, OAuth หรือ JWT
- การคัดลอก `branch_id` ไปไว้ใน session ตะกร้า หรือออร์เดอร์ (หาได้ผ่าน `tables`)

## การตัดสินใจ (Decisions)

### D1. สาขาผูกผ่านโต๊ะ ไม่คัดลอกไปทุกแถว
เพิ่ม `branches(id, code unique, name)`; `tables.branch_id` (FK, not null) พร้อม unique `(branch_id, number)` แทน unique `number` เดิม session ตะกร้า ticket และรายการออร์เดอร์อ้างอิง `tables` อยู่แล้ว (โดยตรงหรือผ่าน session) จึงหาสาขาได้ด้วยการ join เพียงครั้งเดียว และไม่มีทางขัดแย้งกับโต๊ะของมัน
*ทางเลือกอื่น:* ใส่ `branch_id` ในทุกตาราง — ซ้ำซ้อนและข้อมูลอาจไม่ตรงกันได้

### D2. Migration พร้อมเติมข้อมูลเดิม
ใช้ Drizzle migration ที่ generate มาหนึ่งไฟล์ แล้วแก้ด้วยมือเพื่อจัดการข้อมูล: สร้าง `branches`; เพิ่ม `('SIAM','Not Bad Siam')`; เพิ่ม `tables.branch_id` แบบ nullable; ตั้งค่าเป็น SIAM ให้ทุกแถว; ตั้ง NOT NULL; สลับ unique constraint ค่า `bill_no` เดิมไม่ถูกแตะต้อง ส่วนสาขา ASOK และโต๊ะของมันมาจาก seed ไม่ใช่ migration

### D3. เลขบิล
`openSession()` สร้างเลขบิลด้วย `code || '-T' || lpad(number,2,'0') || '-' || lpad(nextval('bill_seq')::text,4,'0')` — ใช้ sequence เดียวทั้งระบบ unique index ไม่เปลี่ยน

### D4. Routes
- ฝั่งลูกค้า: `/b/[branch]/t/[table]` (+ `/pay`); API `/api/b/[branch]/tables/[table]/…` ใช้ `getTable(branchCode, number)` แทน `getTable(number)`; route เดิม `/t/…` ถูกลบ (404 → หน้า "table not found")
- คอนโซล: `/login` (สาธารณะ), `/console` (redirect ไปสาขาของผู้ใช้ หรือแสดงตัวเลือกสาขา), `/console/[branch]`, `/console/[branch]/history`, `/console/[branch]/bills/[id]/print`; API `/api/console/[branch]/…`; API ด้าน auth คือ `/api/auth/login`, `/api/auth/logout`
การใส่สาขาไว้ใน URL ทำให้การเลือกสาขาชัดเจน bookmark ได้ และตรวจสอบได้ทุก request โดยไม่ต้องเก็บสถานะเพิ่มใน session

### D5. รหัสผ่านและ session ด้วย `node:crypto`
- ตาราง: `users(id, username unique, password_hash, display_name)`, `user_branches(user_id, branch_id)` โดยมี PK เป็นทั้งสองคอลัมน์, `staff_sessions(token_hash pk, user_id, expires_at)`
- แฮช: `scrypt(password, salt สุ่ม 16 ไบต์, 64)` เก็บในรูป `scrypt$<salt b64>$<hash b64>`; ตรวจด้วย `timingSafeEqual` หาก username ไม่มีอยู่ ยังคงรันการตรวจหลอกหนึ่งครั้ง เพื่อไม่ให้เวลาตอบสนองเผยว่าส่วนไหนผิด
- Session: ไบต์สุ่ม 32 ไบต์ เข้ารหัส base64url ส่งเป็น cookie `staff_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`, และ `Secure` บน production) เก็บเฉพาะค่า SHA-256 ของมัน `expires_at = now + 24h` และต่ออายุเมื่อมี request ของคอนโซลขณะเหลือเวลาน้อยกว่า 23 ชม. (sliding window โดยไม่ต้องเขียนฐานข้อมูลทุก request) การ logout ลบแถวและล้าง cookie

### D6. ตัวตรวจสอบเดียว ใช้ทุกจุด
`lib/auth.ts` export `requireStaff(branchCode?)`: อ่าน cookie โหลด session และผู้ใช้ ปฏิเสธ session ที่หมดอายุ และเมื่อระบุสาขา จะตรวจการสังกัด → คืนค่า `{ user, branch }` หรือ throw `AppError` 401/403 route handler ของคอนโซลเรียกเป็นอย่างแรก หน้าคอนโซลเรียกภายใน child ที่อยู่ใน `<Suspense>` และแปลง 401 เป็น `redirect('/login?next=…')` และ 403 เป็นหน้า "ไม่มีสิทธิ์เข้าสาขานี้" ไม่ใช้ proxy/middleware ของ Next.js: ตัวตรวจที่ต้องเข้าฐานข้อมูลควรอยู่ติดกับโค้ดที่มันป้องกัน และ helper เดียวทำให้กฎอยู่ที่เดียว
*ทางเลือกอื่น:* HTTP Basic Auth — ไม่มี logout และตัวเลือกสาขา; Auth.js — เกินความจำเป็นสำหรับ demo ที่มีแต่ผู้ใช้จาก seed

### D7. ตรวจความเป็นเจ้าของตามสาขาในชั้น service
ฟังก์ชัน service ของคอนโซลรับ `branchId` ที่ resolve แล้ว: ภาพรวมและประวัติกรองตามค่านี้; `transitionItem`, `markPaid`, `clearSession` และ `getBill` เพิ่มเงื่อนไข `tables.branch_id = $branchId` ในการค้นหา ทำให้ id จากสาขาอื่นมีพฤติกรรมเหมือน id ที่ไม่มีอยู่ (404) และไม่มีอะไรเปลี่ยน

### D8. Seed
Seed สร้างสาขา SIAM (10 โต๊ะ), ASOK (6 โต๊ะ), เมนูร่วม และผู้ใช้ `siam.staff` / `area.manager` พร้อมรหัสผ่านทดลองที่แฮชตอน seed รหัสผ่านระบุไว้ใน README เท่านั้น ยังคงใช้ตัวป้องกัน `--force` สำหรับการ seed ใหม่ทั้งหมด

`--users-only` เป็นโหมดที่ไม่ลบข้อมูล: ภายใน transaction เดียว จะ upsert สาขาตามรหัส (เพิ่มโต๊ะของ ASOK ที่ยังไม่มี โดยไม่เปลี่ยนเลขหรือลบโต๊ะเดิม) upsert ผู้ใช้ตาม username (รีเซ็ตแฮชรหัสผ่านเป็นค่าทดลอง) และเพิ่มแถว `user_branches` ที่ยังไม่มี โหมดนี้ไม่ truncate และไม่แตะเมนู session ตะกร้า ออร์เดอร์ หรือบิล ฐานข้อมูลเดิมจึงคงประวัติไว้ รันได้โดยไม่ต้องใช้ `--force` และรันซ้ำได้อย่างปลอดภัย

### D9. การทดสอบ
- Unit: แฮชแล้วตรวจกลับได้และปฏิเสธรหัสผิด; กฎการหมดอายุและต่ออายุ session
- Service/route: การแยกสาขา (โต๊ะเลขเดียวกันในสองสาขา), รูปแบบเลขบิล, 401 เมื่อไม่มี cookie, 403 สำหรับสาขาที่ไม่ได้สังกัด, 404 สำหรับรายการของสาขาอื่น
- Browser walkthrough: flow ลูกค้าใต้ `/b/SIAM/…`, การล็อกอินพนักงาน, การ redirect ของผู้ใช้สาขาเดียว, ตัวเลือกและการสลับสาขาของผู้ใช้หลายสาขา, หน้า 403

## ความเสี่ยง / ข้อแลกเปลี่ยน (Risks / Trade-offs)

- [URL เปลี่ยนแบบ breaking: ลิงก์ `/t/<n>` ที่บันทึกไว้จะใช้ไม่ได้] → ยอมรับได้สำหรับ demo; README และ demo index แสดงลิงก์ใหม่
- [cookie ถูกขโมยจะเข้าถึงได้ 24 ชม.] → `HttpOnly` + `Secure` + `SameSite=Lax`; rate limiting และการล็อกบัญชีอยู่นอกขอบเขต
- [Seed `--force` ลบผู้ใช้ด้วย] → ใช้ตัวป้องกันเดิม และระบุไว้ในเอกสาร
- [Migration บนฐานข้อมูลที่ใช้งานอยู่] → ทำใน transaction เดียว; มีแต่ข้อมูล demo

## แผนการ migrate (Migration Plan)

1. `npm run db:generate` แล้วแก้ migration ด้วยมือเพื่อเติมข้อมูล SIAM (D2); จากนั้น `npm run db:migrate`
2. ฐานข้อมูลใหม่: `npm run db:seed` ฐานข้อมูลเดิมที่มีประวัติ: `npm run db:seed -- --users-only` เพื่อเพิ่ม ASOK และบัญชีพนักงานโดยไม่แตะบิล (D8)
3. Rollback: deploy build ก่อนหน้าและกู้ฐานข้อมูลจาก backup; การเปลี่ยน schema นี้ใช้ย้อนหลังกับโค้ดเดิมไม่ได้
