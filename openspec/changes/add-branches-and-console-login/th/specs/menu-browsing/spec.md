> ฉบับแปลภาษาไทยของ `../../../specs/menu-browsing/spec.md` — ไฟล์ภาษาอังกฤษคือฉบับหลัก

# Spec Delta

## MODIFIED Requirements

### Requirement: การเข้าเมนูด้วย URL จาก QR ของโต๊ะ (Table menu entry by QR URL)
ระบบ SHALL ให้บริการเมนูที่ URL ประจำโต๊ะซึ่งมีรหัสสาขาและหมายเลขโต๊ะ (`/b/<branchCode>/t/<tableNo>`) และ SHALL แสดงชื่อสาขาและหมายเลขโต๊ะบนหน้าเมนู การเปิด URL SHALL NOT สร้าง TableSession

#### Scenario: ลูกค้าสแกน QR ของโต๊ะ
- **WHEN** ลูกค้าเปิด `/b/SIAM/t/5`
- **THEN** หน้าเมนูแสดงขึ้นพร้อมชื่อสาขา SIAM และ "Table 5"

#### Scenario: หมายเลขโต๊ะที่ไม่มีอยู่
- **WHEN** ลูกค้าเปิด URL ที่มีรหัสสาขาหรือหมายเลขโต๊ะที่ไม่มีอยู่ รวมถึง URL แบบเดิม `/t/5`
- **THEN** ระบบแสดงข้อความ "table not found" และไม่แสดงเมนู

#### Scenario: การสแกนไม่เปิด session
- **WHEN** ลูกค้าเปิด `/b/SIAM/t/5` และไม่ได้เพิ่มอะไรลงตะกร้า
- **THEN** ไม่มี TableSession สำหรับ SIAM โต๊ะ 5
