> ฉบับแปลภาษาไทยของ `spec.md` ในโฟลเดอร์เดียวกัน: ไฟล์ภาษาอังกฤษคือฉบับหลัก หากเนื้อหาขัดกัน ให้ยึดฉบับภาษาอังกฤษ

# order-tracking Specification

## Purpose

ให้ทุกอุปกรณ์ที่โต๊ะเห็นสถานะของอาหารทุกจานที่ยืนยันแล้วใน TableSession ปัจจุบัน และขอยกเลิกอาหารที่ครัวยังไม่เริ่มทำได้

## Requirements

### Requirement: วงจรสถานะของ OrderItem (OrderItem status lifecycle)
OrderItem ที่ยืนยันแล้วแต่ละรายการ SHALL มีสถานะเดียวเท่านั้น: `pending`, `cancel_requested`, `in_progress`, `served`, `cancelled`, `voided` หรือ `finished` การเปลี่ยนสถานะ SHALL ทำได้เฉพาะ: โดยพนักงาน `pending`→`in_progress`, `in_progress`→`served`, `cancel_requested`→`cancelled` หรือ `pending` และ `pending` หรือ `in_progress`→`voided`; โดยลูกค้า `pending`→`cancel_requested`; โดยระบบเมื่อบิลปิด ตามที่กำหนดด้านล่าง การเปลี่ยนสถานะอื่น SHALL ถูกปฏิเสธ

#### Scenario: ปฏิเสธการเปลี่ยนสถานะที่ไม่ถูกต้อง
- **WHEN** มี request เปลี่ยน OrderItem ที่เป็น `served` ไปเป็น `in_progress`
- **THEN** ระบบปฏิเสธ และสถานะยังคงเป็น `served`

#### Scenario: คำขอยกเลิกทำให้เริ่มทำอาหารไม่ได้
- **WHEN** พนักงานพยายามเริ่มทำ OrderItem ที่อยู่ในสถานะ `cancel_requested`
- **THEN** ระบบปฏิเสธ และสถานะยังคงเป็น `cancel_requested`

#### Scenario: ลูกค้ายกเลิกกับพนักงาน void ยังแยกกัน
- **WHEN** พนักงานยืนยันคำขอยกเลิกของลูกค้าสำหรับอาหารจานหนึ่ง และ void อีกจานเอง
- **THEN** จานแรกเป็น `cancelled` และจานที่สองเป็น `voided`

### Requirement: รายการออร์เดอร์ของทั้งโต๊ะ (Table-wide orders view)
แท็บ Orders SHALL แสดง OrderItem ที่ยืนยันแล้วทุกรายการของ TableSession ที่เปิดอยู่ของโต๊ะ จากทุกอุปกรณ์ พร้อมชื่อ ตัวเลือก โน้ต ราคาต่อหน่วย และสถานะ โดยแสดงอาหารที่เป็น `cancelled` และ `voided` ให้ลูกค้าเห็นเป็น "Cancelled" โดยไม่แสดงเหตุผลหรือหมายเหตุของพนักงาน SHALL แสดงเลขบิลและยอดรวมบิล (ผลรวมของ OrderItem ที่เป็น `served`)

#### Scenario: มองเห็นร่วมกัน
- **WHEN** โทรศัพท์ A ยืนยันผัดไทย และโทรศัพท์ B เปิดแท็บ Orders ของโต๊ะเดียวกัน
- **THEN** โทรศัพท์ B แสดงผัดไทยในสถานะ `pending`

#### Scenario: ไม่มี session เปิดอยู่
- **WHEN** โต๊ะไม่มี TableSession เปิดอยู่
- **THEN** แท็บ Orders แสดงว่าไม่มีออร์เดอร์

#### Scenario: ลูกค้าเห็นอาหารที่ถูก void
- **WHEN** พนักงาน void อาหารด้วยเหตุผล "dropped on floor"
- **THEN** แท็บ Orders ของลูกค้าแสดงอาหารนั้นเป็น "Cancelled" และไม่แสดงเหตุผล

### Requirement: การอัปเดตสถานะ (Status refresh)
ขณะที่โต๊ะมี TableSession เปิดอยู่ แท็บ Orders SHALL แสดงการเปลี่ยนสถานะที่ทำโดยพนักงานหรืออุปกรณ์อื่นภายใน 15 วินาที โดยไม่ต้องโหลดหน้าใหม่เอง

#### Scenario: พนักงานเสิร์ฟอาหาร
- **WHEN** พนักงานทำเครื่องหมาย OrderItem เป็น `served` ขณะที่ลูกค้าดูแท็บ Orders อยู่
- **THEN** รายการนั้นแสดง `served` ภายใน 15 วินาที

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

### Requirement: เหตุผลของ void และหมายเหตุการยกเลิก (Void reason and cancel remark)
การ void อาหาร SHALL ต้องมีเหตุผลยาวอย่างน้อย 3 ตัวอักษรหลัง trim หากไม่มี การ void SHALL ถูกปฏิเสธและ SHALL ไม่มีอะไรเปลี่ยน การยืนยันหรือปฏิเสธคำขอยกเลิกของลูกค้า SHALL รับหมายเหตุแบบไม่บังคับ เหตุผลและหมายเหตุ SHALL มองเห็นได้เฉพาะในคอนโซลและในประวัติออร์เดอร์

#### Scenario: Void โดยไม่มีเหตุผล
- **WHEN** พนักงานพยายาม void อาหารที่เป็น `pending` ด้วยเหตุผล "  " หรือ "ok"
- **THEN** การ void ถูกปฏิเสธ และอาหารยังเป็น `pending`

#### Scenario: ยืนยันการยกเลิกพร้อมหมายเหตุ
- **WHEN** พนักงานยืนยันคำขอยกเลิกพร้อมหมายเหตุ "customer changed mind"
- **THEN** อาหารเป็น `cancelled` และหมายเหตุถูกบันทึกไว้กับการเปลี่ยนแปลงนั้น

### Requirement: สถานะสุดท้ายเมื่อบิลปิด (Final statuses when a Bill closes)
เมื่อบิลปิด ไม่ว่าจากการจ่ายเงินหรือการเคลียร์โต๊ะ อาหารทุกจานที่เป็น `served` SHALL เป็น `finished` และอาหารทุกจานที่ยังเป็น `pending`, `cancel_requested` หรือ `in_progress` SHALL เป็น `voided` พร้อมเหตุผล "table cleared" อาหารที่เป็น `cancelled` และ `voided` SHALL คงสถานะเดิม

#### Scenario: บิลที่จ่ายแล้ว
- **WHEN** บิลที่มีอาหาร `served` หนึ่งจานและ `cancelled` หนึ่งจานถูกจ่าย
- **THEN** อาหารเป็น `finished` และคง `cancelled` ตามลำดับ

#### Scenario: ลูกค้าเดินออกโดยไม่จ่าย
- **WHEN** พนักงานเคลียร์โต๊ะที่บิลมีอาหาร `served` หนึ่งจานและ `in_progress` หนึ่งจาน
- **THEN** จานแรกเป็น `finished` และจานที่สองเป็น `voided` พร้อมเหตุผล "table cleared"

### Requirement: หยุดอัปเดตเมื่อไม่มีบิลเปิดอยู่ (Refresh pauses without an open Bill)
อุปกรณ์ของลูกค้า SHALL หยุดการอัปเดตเป็นระยะ ขณะที่โต๊ะไม่มี TableSession เปิดอยู่และตะกร้าของตัวเองว่าง และ SHALL อัปเดตอีกครั้งทันทีที่ลูกค้าโต้ตอบกับหน้าเว็บหรือกลับมาที่หน้าเว็บ

#### Scenario: โทรศัพท์ที่ไม่ได้ใช้หลังจ่ายเงิน
- **WHEN** บิลของโต๊ะถูกจ่ายแล้ว และโทรศัพท์เครื่องหนึ่งที่โต๊ะเปิดหน้าค้างไว้โดยไม่แตะ
- **THEN** โทรศัพท์เครื่องนั้นไม่ส่ง request เป็นระยะอีก จนกว่าลูกค้าจะโต้ตอบกับหน้าเว็บ
