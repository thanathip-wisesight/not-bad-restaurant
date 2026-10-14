> ฉบับแปลภาษาไทยของ `../design.md`: ไฟล์ภาษาอังกฤษคือฉบับหลัก หากเนื้อหาขัดกัน ให้ยึดฉบับภาษาอังกฤษ

# การออกแบบ (Design)

## บริบท (Context)

ปัจจุบัน (`lib/domain.ts`, `lib/service.ts`): สถานะมี `pending | cancel_requested | in_progress | served | cancelled` ทั้ง Void และ Confirm cancel ของพนักงานจบที่ `cancelled`; `transitionItem()` เปลี่ยนทีละจานด้วย UPDATE แบบมีเงื่อนไขครั้งเดียว การปิดบิลแค่เปลี่ยนสถานะ session และลบตะกร้า อาหารที่ยังไม่จบของโต๊ะที่ถูกเคลียร์จึงค้างเป็น `pending` ตลอดไป ไม่มีเวลาของแต่ละการเปลี่ยนแปลงนอกจาก `order_items.updated_at` หน้าจอ poll ทุก 5 วินาที (`usePolling` ใน `lib/client.ts`) เหตุผลดูที่ proposal.md – Why ถือว่านี่คือ production version แรก จึงไม่ย้อนเติมประวัติ

## เป้าหมาย / สิ่งที่ไม่ทำ (Goals / Non-Goals)

**เป้าหมาย:**
- โค้ดเส้นทางเดียวสำหรับการเปลี่ยนสถานะทีละจานและแบบกลุ่ม ที่ตรวจสอบ อัปเดต และบันทึกพร้อมกันแบบ atomic ด้วยเวลาเดียว
- บันทึกสถานะแบบเพิ่มอย่างเดียว ที่ telemetry endpoint อ่าน
- อยู่ภายใน Vercel Hobby และ Neon Free สำหรับร้านขนาด demo

**สิ่งที่ไม่ทำ:**
- trigger ในฐานข้อมูลหรือ event sourcing บันทึกถูกเขียนโดยชั้น service เท่านั้น
- pagination/cursor นอกเหนือจากการจำกัดจำนวนผลลัพธ์ และหน้ารายงาน

## การตัดสินใจ (Decisions)

### D1. เพิ่มค่า enum สองค่า ไม่แก้ข้อมูลเดิม
`ALTER TYPE item_status ADD VALUE 'voided'` และ `'finished'` ใน migration ที่ generate แถวเดิมคงค่าเดิม (production version แรก ไม่มีอะไรต้องแปลง) Postgres ยอมให้เพิ่มค่า enum ใน migration ได้ ตราบที่ transaction เดียวกันไม่ได้ใช้ค่านั้น migration นี้แค่เพิ่ม

### D2. ตาราง `order_item_events`
`id bigserial`, `order_item_id` (FK), `from_status item_status null`, `to_status item_status not null`, `at timestamptz not null`, `actor` enum `customer | staff | system`, `staff_user_id` (FK users, null), `device_id uuid null`, `note text null`; index `(order_item_id, at)` โค้ดมีแต่การ insert ไม่มีการ update หรือ delete event ของลูกค้าเก็บ device id ของพนักงานเก็บ user id ของระบบไม่เก็บทั้งสอง
*ทางเลือกอื่น:* เก็บประวัติเป็น JSON ใน `order_items` — query สำหรับ telemetry ยากกว่า และถูกเขียนทับได้ง่าย

### D3. ตาราง domain กำหนดทั้งกฎและชื่อที่แสดง
`ACTIONS` เพิ่ม `void → voided` แบบ `reason: "required"` และ `confirm_cancel`/`reject_cancel` แบบ `reason: "optional"`; `RESOLVED = served, cancelled, voided`; `CHARGED = served, finished` (ยอดรวมบิลและใบเสร็จ) `customerLabel(status)` แปลง `cancelled` และ `voided` เป็น "Cancelled" กฎของเหตุผล: เมื่อบังคับ ต้องยาว ≥ 3 ตัวอักษรหลัง trim และไม่เกิน 500 ตัวอักษรเสมอ

### D4. การเปลี่ยนแบบกลุ่มแทน UPDATE แบบมีเงื่อนไขทีละจาน
`transitionItems(ids, action, actor, scope, note?)` ทำงานใน transaction เดียว: `SELECT … FOR UPDATE` อาหารภายในขอบเขต (ลูกค้า: โต๊ะเดียว; พนักงาน: สาขาเดียวเหมือนเดิม) id ใดไม่พบ → 404; อาหารมาจากมากกว่าหนึ่งโต๊ะหรือสถานะไม่ตรงกันทั้งหมด → 400; อาหารที่สถานะไม่ใช่ `from` ที่ถูกต้องของการกระทำ → 409 พร้อมระบุจานเหล่านั้น; จากนั้น UPDATE หนึ่งครั้งและ INSERT หลายแถวลง `order_item_events` ด้วย `now` เดียว การล็อกแถวทำให้กรณีชนกันระหว่างยกเลิกกับเริ่มทำยังปลอดภัย (ฝ่ายที่มาทีหลังรอ อ่านใหม่ และได้ 409) API ทีละจานเรียกด้วย id เดียว กฎจึงมีเส้นทางเดียว

### D5. การปิดบิลตั้งสถานะสุดท้าย
`closeSession()` (จ่ายเงิน Mark paid และเคลียร์โต๊ะ) ใน transaction เดิม: `served → finished`; `pending | cancel_requested | in_progress → voided` พร้อมโน้ต "table cleared" (เกิดได้เฉพาะตอนเคลียร์โต๊ะ เพราะการจ่ายเงินต้องจัดการรายการให้จบก่อน); บันทึกแต่ละการเปลี่ยนเป็น `system` ด้วยเวลาเดียว

### D6. การยืนยันตะกร้าบันทึก event แรก
`confirmCart()` เพิ่ม event `none → pending` (ผู้กระทำคือลูกค้า พร้อม device id) ด้วยเวลาที่สร้าง ticket ให้ทุกจานที่สร้าง

### D7. Query สำหรับ telemetry
- ช่วงเวลา: `from` รวม `to` ไม่รวม รูปแบบ ISO-8601 ค่าเริ่มต้นคือ 30 วันล่าสุด; `from > to` วันที่อ่านไม่ได้ หรือช่วงยาวเกิน 366 วัน → 400 ช่วงเวลากรองตามเวลาที่สร้าง ticket (เวลาที่สั่งอาหาร)
- `GET /api/console/[branch]/telemetry/dishes`: จัดกลุ่มตาม `order_items.menu_item_id` ภายในสาขา: ชื่อ (snapshot ล่าสุด), ordered = จำนวนทั้งหมด, finished/cancelled/voided = จำนวนตามสถานะปัจจุบัน
- `GET /api/console/[branch]/telemetry/items?menuItemId=`: อาหารเรียงจากใหม่ไปเก่า สูงสุด 500 รายการ แต่ละรายการมีเลขบิล โต๊ะ สถานะ และ event เรียงตามเวลา (ผู้กระทำแสดงเป็น `customer`, `system` หรือ username ของพนักงาน)
ทั้งสองเรียก `requireStaff` ก่อน (401/403 เหมือนที่อื่น)

### D8. UI ของคอนโซล
สถานะการเลือก `{ tableNumber, status, ids }` ใช้ร่วมกันระหว่างบอร์ด แผงด้านข้าง และรายการบนโทรศัพท์; checkbox ของโต๊ะหรือสถานะอื่นถูกปิดขณะมีการเลือกอยู่; มี "เลือกทั้งหมด" ต่อกลุ่มโต๊ะ+สถานะ แถบปุ่มติดด้านล่างแสดงจำนวนที่เลือกและการกระทำของสถานะนั้น Void, Confirm cancel และ Reject cancel เปิดกล่องโต้ตอบเล็ก ๆ ที่มีช่องข้อความ (บังคับสำหรับ Void ไม่บังคับสำหรับอย่างอื่น) ใช้ทั้งแบบทีละจานและแบบกลุ่ม แบบกลุ่มเรียก `POST /api/console/[branch]/items/batch { ids, action, note }` ส่วน route ทีละจานเดิมส่งต่อไปยังฟังก์ชัน service เดียวกัน

### D9. Polling ให้อยู่ในโควตาฟรี
Poll ทุก 10 วินาที (คอนโซลและลูกค้า) หน้าลูกค้าหยุด poll เมื่อไม่มี session เปิดอยู่และตะกร้าของตัวเองว่าง และกลับมา poll เมื่อเกิด `pointerdown`, `keydown`, `focus` หรือ `visibilitychange` เป็น visible การคำนวณงบ (Hobby: 1,000,000 invocations/เดือน; Neon Free: 100 CU-hours ≈ 400 ชั่วโมงที่ 0.25 CU): โทรศัพท์ที่ใช้งานหนึ่งเครื่อง ≈ 720 request/ชั่วโมง (2 ครั้งต่อ 10 วินาที) คอนโซล ≈ 360/ชั่วโมง README อธิบายเรื่องนี้และข้อห้ามใช้เชิงพาณิชย์ของ Hobby (แหล่งอ้างอิง: vercel.com/docs/plans/hobby, neon.com/docs/introduction/plans)

## ความเสี่ยง / ข้อแลกเปลี่ยน (Risks / Trade-offs)

- [ลบค่า enum ออกได้ยาก] → ยอมรับ; การ rollback คือ deploy โค้ดเก่า ซึ่งแค่ไม่รู้จักค่าใหม่ในการแสดงผล
- [การล็อกแถวทำให้ batch ที่แตะอาหารเดียวกันต้องรอกัน] → batch เป็นรายโต๊ะและเล็กมาก การแย่งกันแทบไม่มีผล
- [โควตา Hobby เป็นเพดานรายเดือนแบบตายตัว (หยุด 30 วัน)] → ลดความถี่ polling และหยุดเมื่อไม่ได้ใช้; มีงบในเอกสาร; ใช้งานหนักกว่านี้ต้องใช้ Pro
- [Neon ไม่หลับขณะมีหน้าจอใดยัง poll อยู่] → แก้แบบเดียวกัน; แท็บคอนโซลที่เปิดค้าง 12 ชม./วัน ใช้ ≈ 360 จาก ≈ 400 ชั่วโมงฟรี
- [แถว `cancelled` เก่าจากระยะก่อนปนกันระหว่างลูกค้ายกเลิกและพนักงานนำออก] → production version แรก ไม่มีข้อมูลเก่าให้แยก

## แผนการ migrate (Migration Plan)

`npm run db:generate` → ตรวจ migration ของ enum และตาราง → `npm run db:migrate` ไม่ต้องแก้ seed การ rollback: deploy build ก่อนหน้า ค่า enum และตารางใหม่ยังอยู่แต่ไม่ถูกใช้
