> ฉบับแปลภาษาไทยของ `../../../specs/console-access/spec.md` — ไฟล์ภาษาอังกฤษคือฉบับหลัก

# Spec Delta

## Purpose

จำกัดการเข้าถึงคอนโซลของร้านให้เฉพาะพนักงานที่เข้าสู่ระบบแล้ว และจำกัดทุกสิ่งที่พนักงานเห็นและทำได้ให้อยู่ในสาขาที่ตนสังกัด

## ADDED Requirements

### Requirement: การเข้าสู่ระบบของพนักงาน (Staff login)
ระบบ SHALL มีหน้าเข้าสู่ระบบให้พนักงานกรอก username และ password หากถูกต้อง SHALL เริ่ม staff session ที่เก็บใน cookie แบบ HTTP-only หากผิด SHALL แสดงข้อความกลาง ๆ "invalid username or password" โดยไม่บอกว่าส่วนไหนผิด รหัสผ่าน SHALL ถูกเก็บในรูปแฮชที่มี salt เท่านั้น

#### Scenario: เข้าสู่ระบบสำเร็จ
- **WHEN** `siam.staff` กรอกรหัสผ่านถูกต้อง
- **THEN** staff session เริ่มต้น และผู้ใช้ไปต่อที่คอนโซล

#### Scenario: รหัสผ่านผิด
- **WHEN** ผู้ใช้กรอกรหัสผ่านผิด
- **THEN** ไม่มี session เริ่มต้น และหน้าเว็บแสดง "invalid username or password"

### Requirement: อายุ session และการออกจากระบบ (Session lifetime and logout)
staff session SHALL หมดอายุเมื่อไม่มีการใช้งานคอนโซล 24 ชั่วโมง ทุก request ของคอนโซลภายในช่วงเวลานั้น SHALL ต่ออายุ session การออกจากระบบ SHALL จบ session ทันที

#### Scenario: ไม่ได้ใช้งานหนึ่งวัน
- **WHEN** พนักงานไม่มี request ของคอนโซลเลยนานกว่า 24 ชั่วโมง
- **THEN** request คอนโซลครั้งถัดไปต้องเข้าสู่ระบบใหม่

#### Scenario: ออกจากระบบ
- **WHEN** พนักงานกด Log out
- **THEN** session จบลง และการเปิด `/console` จะแสดงหน้าเข้าสู่ระบบ

### Requirement: คอนโซลต้องเข้าสู่ระบบ (Console requires login)
ทุกหน้าใต้ `/console` และทุก console API SHALL ต้องมี staff session ที่ใช้ได้ หน้าเว็บ SHALL redirect ไปหน้าเข้าสู่ระบบ และกลับมาที่หน้าที่ขอไว้หลังเข้าสู่ระบบ ส่วน API SHALL ตอบด้วย status 401 หน้าและ API ฝั่งลูกค้า SHALL NOT ต้องเข้าสู่ระบบ

#### Scenario: เปิดหน้าโดยไม่มี session
- **WHEN** ผู้ที่ไม่มี session เปิด `/console/SIAM/history`
- **THEN** แสดงหน้าเข้าสู่ระบบ และหลังเข้าสู่ระบบจะไปที่ `/console/SIAM/history`

#### Scenario: เรียก API โดยไม่มี session
- **WHEN** request ไปยัง console API ไม่มี session ที่ใช้ได้
- **THEN** ได้ status 401 และไม่มีอะไรเปลี่ยนแปลง

#### Scenario: ลูกค้าไม่ได้รับผลกระทบ
- **WHEN** ลูกค้าเปิด `/b/SIAM/t/5` โดยไม่ได้เข้าสู่ระบบ
- **THEN** แสดงเมนูตามปกติ

### Requirement: การเลือกสาขา (Branch selection)
พนักงานแต่ละคน SHALL สังกัดอย่างน้อยหนึ่งสาขา หลังเข้าสู่ระบบ ผู้ใช้ที่สังกัดสาขาเดียว SHALL ไปที่คอนโซลของสาขานั้นทันที ผู้ใช้ที่สังกัดหลายสาขา SHALL เลือกจากรายการสาขาของตน คอนโซล SHALL แสดงสาขาที่เลือก และสำหรับผู้ใช้หลายสาขา SHALL มีปุ่มสลับสาขา

#### Scenario: ผู้ใช้สาขาเดียว
- **WHEN** `siam.staff` เข้าสู่ระบบ
- **THEN** แสดงคอนโซลของ SIAM โดยไม่ต้องเลือกสาขา

#### Scenario: ผู้ใช้หลายสาขา
- **WHEN** `area.manager` เข้าสู่ระบบ
- **THEN** แสดงตัวเลือก SIAM และ ASOK และเมื่อเลือก ASOK จะเปิดคอนโซลของ ASOK

#### Scenario: การสลับสาขา
- **WHEN** `area.manager` อยู่ที่คอนโซล SIAM แล้วกด Switch branch จากนั้นเลือก ASOK
- **THEN** แสดงคอนโซลของ ASOK

### Requirement: การอนุญาตตามขอบเขตสาขา (Branch-scoped authorization)
ทุกการอ่านและการกระทำในคอนโซล SHALL จำกัดเฉพาะสาขาที่เลือก และเซิร์ฟเวอร์ SHALL ปฏิเสธ request สำหรับสาขาที่ผู้ใช้ไม่ได้สังกัด หรือสำหรับโต๊ะ OrderItem หรือบิลที่อยู่นอกสาขาที่เลือก โดยไม่เปลี่ยนแปลงสิ่งใด

#### Scenario: ไม่ได้สังกัดสาขา
- **WHEN** `siam.staff` เปิด `/console/ASOK` หรือเรียก console API ของ ASOK
- **THEN** การเข้าถึงถูกปฏิเสธด้วย status 403 และไม่มีอะไรถูกแสดงหรือเปลี่ยนแปลง

#### Scenario: รายการจากสาขาอื่น
- **WHEN** request บนคอนโซล SIAM อ้างถึง OrderItem ที่เป็นของโต๊ะใน ASOK
- **THEN** request ถูกปฏิเสธเหมือนไม่พบข้อมูล และรายการนั้นไม่เปลี่ยนแปลง

### Requirement: บัญชีพนักงานจาก seed (Seeded staff accounts)
บัญชีพนักงานและการสังกัดสาขา SHALL มาจาก seed เท่านั้น SHALL ไม่มีการสมัครสมาชิกหรือการจัดการบัญชี seed SHALL สร้าง `siam.staff` (SIAM) และ `area.manager` (SIAM และ ASOK)

#### Scenario: ไม่มีการสมัครสมาชิก
- **WHEN** มีผู้พยายามหาวิธีสร้างบัญชี
- **THEN** ไม่มีหน้าหรือ API สำหรับสมัครสมาชิก
