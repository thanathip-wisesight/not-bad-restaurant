# Spec Delta

## Purpose

Lets a table settle its Bill through a stubbed QR bank-app flow or at the cashier, and closes the TableSession once the Bill is paid.

## ADDED Requirements

### Requirement: Payment eligibility gate
The customer "Pay" action SHALL be enabled only when the requesting device's cart is empty and every OrderItem of the TableSession is `served` or `cancelled`. Otherwise the system SHALL tell the customer what blocks payment: unconfirmed cart lines to confirm or remove, or unresolved items to settle with staff.

#### Scenario: Cart not empty
- **WHEN** a customer taps Pay while their cart has a line
- **THEN** payment does not start and the customer is prompted to confirm or remove cart lines

#### Scenario: Unresolved items
- **WHEN** a customer taps Pay while an OrderItem is `pending`, `cancel_requested`, or `in_progress`
- **THEN** payment does not start and the customer is told to resolve those items with staff

#### Scenario: Eligible
- **WHEN** the device's cart is empty and all OrderItems are `served` or `cancelled`
- **THEN** payment options are shown

### Requirement: Unsent carts warning
When payment is otherwise eligible but other devices in the TableSession still hold cart lines, the system SHALL warn that those lines will be discarded and ask the table to resolve them first. Payment SHALL proceed only after an explicit "Pay anyway" confirmation. The console "Mark paid" SHALL show the same warning.

#### Scenario: Another phone has unsent dishes
- **WHEN** an eligible customer taps Pay while phone B's cart has 2 lines
- **THEN** a warning states that 2 unsent dishes on other phones will be discarded, and payment starts only after "Pay anyway"

#### Scenario: Table resolves first
- **WHEN** the warning is shown and the customer dismisses it
- **THEN** no payment occurs and all carts are unchanged

### Requirement: Bill total
The Bill total SHALL equal the sum of unit prices, including option deltas, of all `served` OrderItems, in whole Thai Baht. `cancelled` OrderItems SHALL contribute zero.

#### Scenario: Cancelled item excluded
- **WHEN** a Bill has served items of ฿90 and ฿50 and one cancelled ฿80 item
- **THEN** the Bill total is ฿140

### Requirement: Bill number
Each TableSession SHALL have a Bill number unique across all sessions, shown in the customer's Orders tab and in the console, combining the table number and a sequence (e.g. `T05-0042`).

#### Scenario: Bill number visible
- **WHEN** a TableSession is open for table 5
- **THEN** the Orders tab shows a Bill number beginning with `T05-`

### Requirement: Stubbed QR payment
Choosing QR payment SHALL show a list of simulated Thai bank apps. Selecting a bank SHALL mark the Bill `paid` without contacting any real payment system, then return the customer to the menu page with a payment-success message.

#### Scenario: Stub payment succeeds
- **WHEN** an eligible customer chooses QR payment and selects a simulated bank
- **THEN** the Bill becomes `paid` and the menu page shows a success message

### Requirement: Cashier payment
A customer SHALL be able to pay at the cashier by presenting the Bill number; staff record it through the restaurant console.

#### Scenario: Pay at counter
- **WHEN** staff marks Bill `T05-0042` paid in the console
- **THEN** the Bill becomes `paid`

### Requirement: Session closes on payment
When a Bill becomes `paid`, the system SHALL close its TableSession, discard all remaining cart lines of that session, and keep the Bill and its OrderItems in history. Devices at that table SHALL then see an empty Orders tab, and the next cart add SHALL open a new TableSession.

#### Scenario: Orders cleared after payment
- **WHEN** table 5's Bill is paid
- **THEN** every device at table 5 shows no orders within 10 seconds, and the Bill remains retrievable in history

#### Scenario: Next customers
- **WHEN** a customer adds an item at table 5 after its Bill was paid
- **THEN** a new TableSession with a new Bill number is opened
