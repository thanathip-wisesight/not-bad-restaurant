# Spec Delta

## Purpose

Lets every device at a table see the status of all confirmed plates for the current TableSession and request cancellation of plates the kitchen has not started.

## ADDED Requirements

### Requirement: OrderItem status lifecycle
Each confirmed OrderItem SHALL have exactly one status: `pending`, `cancel_requested`, `in_progress`, `served`, or `cancelled`. Only these transitions SHALL be allowed: `pending`→`in_progress` (staff), `pending`→`cancel_requested` (customer), `cancel_requested`→`cancelled` (staff), `cancel_requested`→`pending` (staff), `in_progress`→`served` (staff), and `pending` or `in_progress`→`cancelled` (staff void). Any other transition SHALL be rejected.

#### Scenario: Invalid transition rejected
- **WHEN** a request moves a `served` OrderItem to `in_progress`
- **THEN** the system rejects it and the status stays `served`

#### Scenario: Cancel request blocks cooking
- **WHEN** staff tries to start an OrderItem in `cancel_requested`
- **THEN** the system rejects it and the status stays `cancel_requested`

### Requirement: Table-wide orders view
The Orders tab SHALL list every confirmed OrderItem of the table's open TableSession, from all devices, with name, options, note, unit price, and status. It SHALL show the Bill number and the running Bill total (sum of `served` OrderItems).

#### Scenario: Shared visibility
- **WHEN** phone A confirms Pad Thai and phone B opens the Orders tab of the same table
- **THEN** phone B lists Pad Thai with status `pending`

#### Scenario: No open session
- **WHEN** the table has no open TableSession
- **THEN** the Orders tab shows that there are no orders

### Requirement: Status refresh
The Orders tab SHALL reflect status changes made by staff or other devices within 10 seconds without a manual reload.

#### Scenario: Staff serves item
- **WHEN** staff marks an OrderItem `served` while a customer views the Orders tab
- **THEN** the item shows `served` within 10 seconds

### Requirement: Customer cancel request
Any device at the table SHALL be able to request cancellation of any OrderItem in `pending`, moving it to `cancel_requested`. The control SHALL NOT be offered for other statuses. A customer SHALL NOT be able to withdraw a cancel request.

#### Scenario: Request cancel on pending item
- **WHEN** a customer taps Cancel on a `pending` OrderItem
- **THEN** its status becomes `cancel_requested` and the Orders tab shows that staff will come to the table

#### Scenario: Item already in progress
- **WHEN** an OrderItem is `in_progress`
- **THEN** no Cancel control is shown for it

#### Scenario: Race with staff start
- **WHEN** staff starts an OrderItem and a customer's cancel request for it arrives afterwards
- **THEN** the cancel request is rejected and the customer is told the item is already being prepared
