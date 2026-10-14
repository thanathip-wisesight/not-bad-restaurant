# Spec Delta

## MODIFIED Requirements

### Requirement: OrderItem status lifecycle
Each confirmed OrderItem SHALL have exactly one status: `pending`, `cancel_requested`, `in_progress`, `served`, `cancelled`, `voided`, or `finished`. Only these transitions SHALL be allowed: by staff `pending`→`in_progress`, `in_progress`→`served`, `cancel_requested`→`cancelled` or `pending`, and `pending` or `in_progress`→`voided`; by a customer `pending`→`cancel_requested`; by the system when a Bill closes, as defined below. Any other transition SHALL be rejected.

#### Scenario: Invalid transition rejected
- **WHEN** a request moves a `served` OrderItem to `in_progress`
- **THEN** the system rejects it and the status stays `served`

#### Scenario: Cancel request blocks cooking
- **WHEN** staff tries to start an OrderItem in `cancel_requested`
- **THEN** the system rejects it and the status stays `cancel_requested`

#### Scenario: Customer cancel and staff void stay distinct
- **WHEN** staff confirms a customer's cancel request on one dish and voids another dish on their own
- **THEN** the first dish is `cancelled` and the second is `voided`

### Requirement: Table-wide orders view
The Orders tab SHALL list every confirmed OrderItem of the table's open TableSession, from all devices, with name, options, note, unit price, and status, showing both `cancelled` and `voided` dishes to customers as "Cancelled" without any staff reason or remark. It SHALL show the Bill number and the running Bill total (sum of `served` OrderItems).

#### Scenario: Shared visibility
- **WHEN** phone A confirms Pad Thai and phone B opens the Orders tab of the same table
- **THEN** phone B lists Pad Thai with status `pending`

#### Scenario: No open session
- **WHEN** the table has no open TableSession
- **THEN** the Orders tab shows that there are no orders

#### Scenario: Voided dish seen by the customer
- **WHEN** staff voids a dish with the reason "dropped on floor"
- **THEN** the customer's Orders tab shows that dish as "Cancelled" and does not show the reason

### Requirement: Status refresh
While the table has an open TableSession, the Orders tab SHALL reflect status changes made by staff or other devices within 15 seconds without a manual reload.

#### Scenario: Staff serves item
- **WHEN** staff marks an OrderItem `served` while a customer views the Orders tab
- **THEN** the item shows `served` within 15 seconds

## ADDED Requirements

### Requirement: Void reason and cancel remark
Voiding a dish SHALL require a reason of at least 3 characters after trimming; without one the void SHALL be rejected and nothing SHALL change. Confirming or rejecting a customer's cancel request SHALL accept an optional remark. Reasons and remarks SHALL be visible only on the console and in the order history.

#### Scenario: Void without reason
- **WHEN** staff tries to void a `pending` dish with the reason "  " or "ok"
- **THEN** the void is rejected and the dish stays `pending`

#### Scenario: Confirm cancel with a remark
- **WHEN** staff confirms a cancel request with the remark "customer changed mind"
- **THEN** the dish becomes `cancelled` and the remark is recorded with that change

### Requirement: Final statuses when a Bill closes
When a Bill closes, by payment or force-clear, every `served` dish SHALL become `finished`, and every dish still `pending`, `cancel_requested`, or `in_progress` SHALL become `voided` with the reason "table cleared". `cancelled` and `voided` dishes SHALL keep their status.

#### Scenario: Paid bill
- **WHEN** a Bill with one `served` and one `cancelled` dish is paid
- **THEN** the dishes become `finished` and stay `cancelled` respectively

#### Scenario: Walk-out
- **WHEN** staff force-clears a table whose Bill has one `served` and one `in_progress` dish
- **THEN** the first becomes `finished` and the second becomes `voided` with the reason "table cleared"

### Requirement: Refresh pauses without an open Bill
A customer device SHALL stop its periodic refresh while its table has no open TableSession and its own cart is empty, and SHALL refresh again as soon as the customer interacts with the page or returns to it.

#### Scenario: Idle phone after payment
- **WHEN** a table's Bill has been paid and a phone at that table keeps the page open without touching it
- **THEN** that phone makes no further periodic requests until the customer interacts with the page
