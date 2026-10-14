# Spec Delta

## Purpose

Gives restaurant staff a single simple page to see every table's orders, drive each plate's status, resolve cancel requests, record cashier payments, clear tables, and print receipts.

## ADDED Requirements

### Requirement: Tables overview
The console SHALL list every table with its open TableSession, if any: Bill number, Bill status, Bill total, and each OrderItem with name, options, note, and status. Items in `cancel_requested` SHALL be visually highlighted. The view SHALL refresh within 10 seconds of changes.

#### Scenario: New order appears
- **WHEN** a customer confirms a cart at table 3
- **THEN** the console shows the new `pending` OrderItems under table 3 within 10 seconds

#### Scenario: Idle table
- **WHEN** table 7 has no open TableSession
- **THEN** the console shows table 7 as free

### Requirement: Item status actions
For each OrderItem the console SHALL offer only the actions valid for its status: Start (`pending`→`in_progress`), Serve (`in_progress`→`served`), Void (`pending` or `in_progress`→`cancelled`), Confirm cancel (`cancel_requested`→`cancelled`), and Reject cancel (`cancel_requested`→`pending`).

#### Scenario: Start cooking
- **WHEN** staff taps Start on a `pending` OrderItem
- **THEN** it becomes `in_progress`

#### Scenario: Resolve cancel request at table
- **WHEN** staff taps Confirm cancel on a `cancel_requested` OrderItem
- **THEN** it becomes `cancelled` and is excluded from the Bill total

#### Scenario: Customer keeps the dish
- **WHEN** staff taps Reject cancel on a `cancel_requested` OrderItem
- **THEN** it returns to `pending` and can be started

#### Scenario: Void in-progress item
- **WHEN** staff taps Void on an `in_progress` OrderItem
- **THEN** it becomes `cancelled`

### Requirement: Mark Bill paid
The console SHALL let staff mark a Bill paid only when every OrderItem is `served` or `cancelled`. Marking paid SHALL have the same effect as a successful customer payment, including the unsent carts warning defined in the payment capability.

#### Scenario: Paid at cashier
- **WHEN** all items of Bill `T05-0042` are served or cancelled and staff taps Mark paid
- **THEN** the Bill becomes `paid` and table 5's TableSession closes

#### Scenario: Unresolved items block
- **WHEN** a Bill has an `in_progress` item and staff taps Mark paid
- **THEN** the system rejects it and names the unresolved items

### Requirement: Force-clear table
The console SHALL let staff clear a table's open TableSession at any time, after a confirmation prompt. If the Bill is unpaid, it SHALL be recorded as `voided`. The session closes as on payment, and the Bill stays in history.

#### Scenario: Walk-out
- **WHEN** staff clears table 4 whose Bill is unpaid and confirms the prompt
- **THEN** the Bill is recorded `voided`, table 4 shows as free, and the Bill remains in history

### Requirement: Print receipt
The console SHALL provide "Print bill" for any open or historical Bill, opening the browser print dialog with a receipt showing restaurant name, table number, Bill number, date and time, served OrderItems with options and prices, total, and paid/unpaid/voided status. It SHALL be repeatable. The receipt is not a tax invoice.

#### Scenario: Reprint
- **WHEN** staff taps Print bill twice on the same Bill
- **THEN** the print dialog opens each time with identical receipt content

### Requirement: Bill history
The console SHALL list closed Bills, newest first, with Bill number, table, close time, total, and status (`paid` or `voided`), and SHALL allow opening a Bill to view its OrderItems and print it.

#### Scenario: View past bill
- **WHEN** staff opens Bill history after table 5 paid
- **THEN** that Bill is listed as `paid` with its total
