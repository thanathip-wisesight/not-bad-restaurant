# Spec Delta

## MODIFIED Requirements

### Requirement: Tables overview
The console SHALL list every table of the selected branch with its open TableSession, if any: Bill number, Bill status, Bill total, and each OrderItem with name, options, note, and status. Tables of other branches SHALL NOT appear. Items in `cancel_requested` SHALL be visually highlighted. The view SHALL refresh within 10 seconds of changes.

#### Scenario: New order appears
- **WHEN** a customer confirms a cart at SIAM table 3
- **THEN** the SIAM console shows the new `pending` OrderItems under table 3 within 10 seconds

#### Scenario: Idle table
- **WHEN** SIAM table 7 has no open TableSession
- **THEN** the SIAM console shows table 7 as free

#### Scenario: Other branch hidden
- **WHEN** ASOK table 2 has an open TableSession
- **THEN** the SIAM console does not show it

### Requirement: Mark Bill paid
The console SHALL let staff mark a Bill of the selected branch paid only when every OrderItem is `served` or `cancelled`. Marking paid SHALL have the same effect as a successful customer payment, including the unsent carts warning defined in the payment capability.

#### Scenario: Paid at cashier
- **WHEN** all items of Bill `SIAM-T05-0042` are served or cancelled and staff on the SIAM console taps Mark paid
- **THEN** the Bill becomes `paid` and SIAM table 5's TableSession closes

#### Scenario: Unresolved items block
- **WHEN** a Bill has an `in_progress` item and staff taps Mark paid
- **THEN** the system rejects it and names the unresolved items

### Requirement: Print receipt
The console SHALL provide "Print bill" for any open or historical Bill of the selected branch, opening the browser print dialog with a receipt showing restaurant name, branch name, table number, Bill number, date and time, served OrderItems with options and prices, total, and paid/unpaid/voided status. It SHALL be repeatable. The receipt is not a tax invoice.

#### Scenario: Reprint
- **WHEN** staff taps Print bill twice on the same Bill
- **THEN** the print dialog opens each time with identical receipt content

#### Scenario: Branch on receipt
- **WHEN** staff prints a SIAM Bill
- **THEN** the receipt shows the SIAM branch name

### Requirement: Bill history
The console SHALL list closed Bills of the selected branch, newest first, with Bill number, table, close time, total, and status (`paid` or `voided`), and SHALL allow opening a Bill to view its OrderItems and print it.

#### Scenario: View past bill
- **WHEN** staff opens SIAM Bill history after SIAM table 5 paid
- **THEN** that Bill is listed as `paid` with its total

#### Scenario: Other branch's bills hidden
- **WHEN** ASOK table 2's Bill has been paid
- **THEN** it does not appear in SIAM Bill history

### Requirement: Table strip
Above the board, the console SHALL show one chip per table of the selected branch in table-number order. A free table's chip SHALL be grey and labelled free. An occupied table's chip SHALL show its Bill number, served total, and the number of dishes not yet served or cancelled.

#### Scenario: Strip content
- **WHEN** SIAM table 3 is free and SIAM table 5 has Bill SIAM-T05-0042 with ฿90 served and 2 unresolved dishes
- **THEN** table 3's chip is grey and labelled free, and table 5's chip shows SIAM-T05-0042, ฿90, and 2
