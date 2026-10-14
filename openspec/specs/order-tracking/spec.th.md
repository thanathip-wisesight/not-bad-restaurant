> ฉบับแปลภาษาไทยของ `spec.md` ในโฟลเดอร์เดียวกัน: ไฟล์ภาษาอังกฤษคือฉบับหลัก หากเนื้อหาขัดกัน ให้ยึดฉบับภาษาอังกฤษ

# order-tracking Specification

## Purpose

ให้ทุกอุปกรณ์ที่โต๊ะเห็นสถานะของอาหารทุกจานที่ยืนยันแล้วใน TableSession ปัจจุบัน และขอยกเลิกอาหารที่ครัวยังไม่เริ่มทำได้

## Requirements

### Requirement: วงจรสถานะของ OrderItem (OrderItem status lifecycle)
OrderItem ที่ยืนยันแล้วแต่ละรายการ SHALL มีสถานะเดียวเท่านั้น: `pending`, `cancel_requested`, `in_progress`, `served` หรือ `cancelled` การเปลี่ยนสถานะ SHALL ทำได้เฉพาะเหล่านี้: `pending`→`in_progress` (พนักงาน), `pending`→`cancel_requested` (ลูกค้า), `cancel_requested`→`cancelled` (พนักงาน), `cancel_requested`→`pending` (พนักงาน), `in_progress`→`served` (พนักงาน) และ `pending` หรือ `in_progress`→`cancelled` (พนักงาน void) การเปลี่ยนสถานะอื่น SHALL ถูกปฏิเสธ

#### Scenario: ปฏิเสธการเปลี่ยนสถานะที่ไม่ถูกต้อง
- **WHEN** มี request เปลี่ยน OrderItem ที่เป็น `served` ไปเป็น `in_progress`
- **THEN** ระบบปฏิเสธ และสถานะยังคงเป็น `served`

#### Scenario: คำขอยกเลิกทำให้เริ่มทำอาหารไม่ได้
- **WHEN** พนักงานพยายามเริ่มทำ OrderItem ที่อยู่ในสถานะ `cancel_requested`
- **THEN** ระบบปฏิเสธ และสถานะยังคงเป็น `cancel_requested`

### Requirement: รายการออร์เดอร์ของทั้งโต๊ะ (Table-wide orders view)
แท็บ Orders SHALL แสดง OrderItem ที่ยืนยันแล้วทุกรายการของ TableSession ที่เปิดอยู่ของโต๊ะ จากทุกอุปกรณ์ พร้อมชื่อ ตัวเลือก โน้ต ราคาต่อหน่วย และสถานะ SHALL แสดงเลขบิลและยอดรวมบิล (ผลรวมของ OrderItem ที่เป็น `served`)

#### Scenario: มองเห็นร่วมกัน
- **WHEN** โทรศัพท์ A ยืนยันผัดไทย และโทรศัพท์ B เปิดแท็บ Orders ของโต๊ะเดียวกัน
- **THEN** โทรศัพท์ B แสดงผัดไทยในสถานะ `pending`

#### Scenario: ไม่มี session เปิดอยู่
- **WHEN** โต๊ะไม่มี TableSession เปิดอยู่
- **THEN** แท็บ Orders แสดงว่าไม่มีออร์เดอร์

### Requirement: การอัปเดตสถานะ (Status refresh)
แท็บ Orders SHALL แสดงการเปลี่ยนสถานะที่ทำโดยพนักงานหรืออุปกรณ์อื่นภายใน 10 วินาที โดยไม่ต้องโหลดหน้าใหม่เอง

#### Scenario: พนักงานเสิร์ฟอาหาร
- **WHEN** พนักงานทำเครื่องหมาย OrderItem เป็น `served` ขณะที่ลูกค้าดูแท็บ Orders อยู่
- **THEN** รายการนั้นแสดง `served` ภายใน 10 วินาที

### Requirement: คำขอยกเลิกของลูกค้า (Customer cancel request)
อุปกรณ์ใดก็ได้ที่โต๊ะ SHALL ขอยกเลิก OrderItem ใดก็ได้ที่อยู่ในสถานะ `pending` ได้ โดยเปลี่ยนเป็น `cancel_requested` ปุ่มนี้ SHALL NOT แสดงสำหรับสถานะอื่น ลูกค้า SHALL NOT ถอนคำขอยกเลิกได้

#### Scenario: ขอยกเลิกรายการที่ pending
- **WHEN** ลูกค้าแตะ Cancel บน OrderItem ที่เป็น `pending`
- **THEN** สถานะเปลี่ยนเป็น `cancel_requested` และแท็บ Orders แจ้งว่าพนักงานจะมาที่โต๊ะ

#### Scenario: รายการที่กำลังทำอยู่แล้ว
- **WHEN** OrderItem อยู่ในสถานะ `in_progress`
- **THEN** ไม่แสดงปุ่ม Cancel สำหรับรายการนั้น

#### Scenario: ชนกับการเริ่มทำของพนักงาน
- **WHEN** พนักงานเริ่มทำ OrderItem แล้วคำขอยกเลิกของลูกค้าสำหรับรายการนั้นมาถึงทีหลัง
- **THEN** คำขอยกเลิกถูกปฏิเสธ และลูกค้าได้รับแจ้งว่าอาหารกำลังทำอยู่แล้ว
