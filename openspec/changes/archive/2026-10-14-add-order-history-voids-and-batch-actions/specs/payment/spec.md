# Spec Delta

## MODIFIED Requirements

### Requirement: Payment eligibility gate
The customer "Pay" action SHALL be enabled only when the requesting device's cart is empty and every OrderItem of the TableSession is `served`, `cancelled`, or `voided`. Otherwise the system SHALL tell the customer what blocks payment: unconfirmed cart lines to confirm or remove, or unresolved items to settle with staff.

#### Scenario: Cart not empty
- **WHEN** a customer taps Pay while their cart has a line
- **THEN** payment does not start and the customer is prompted to confirm or remove cart lines

#### Scenario: Unresolved items
- **WHEN** a customer taps Pay while an OrderItem is `pending`, `cancel_requested`, or `in_progress`
- **THEN** payment does not start and the customer is told to resolve those items with staff

#### Scenario: Eligible
- **WHEN** the device's cart is empty and all OrderItems are `served`, `cancelled`, or `voided`
- **THEN** payment options are shown

### Requirement: Bill total
The Bill total SHALL equal the sum of unit prices, including option deltas, of all `served` and `finished` OrderItems, in whole Thai Baht. `cancelled` and `voided` OrderItems SHALL contribute zero.

#### Scenario: Cancelled item excluded
- **WHEN** a Bill has served items of ฿90 and ฿50 and one cancelled ฿80 item
- **THEN** the Bill total is ฿140

#### Scenario: Voided item excluded
- **WHEN** a Bill has a served ฿90 item and a voided ฿120 item
- **THEN** the Bill total is ฿90

#### Scenario: Total unchanged after closing
- **WHEN** a Bill totalling ฿140 is paid and its served dishes become `finished`
- **THEN** the Bill total in history is still ฿140

### Requirement: Session closes on payment
When a Bill becomes `paid`, the system SHALL close its TableSession, set the final dish statuses defined in order-tracking, discard all remaining cart lines of that session, and keep the Bill and its OrderItems in history. Devices at that table SHALL then see an empty Orders tab, and the next cart add SHALL open a new TableSession.

#### Scenario: Orders cleared after payment
- **WHEN** table 5's Bill is paid
- **THEN** every device at table 5 shows no orders within 15 seconds, and the Bill remains retrievable in history

#### Scenario: Next customers
- **WHEN** a customer adds an item at table 5 after its Bill was paid
- **THEN** a new TableSession with a new Bill number is opened
