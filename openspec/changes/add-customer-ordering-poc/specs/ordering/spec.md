# Spec Delta

## Purpose

Lets each customer device at a table build its own cart of dishes with options and notes, edit it, and confirm it to the kitchen as individual plates.

## ADDED Requirements

### Requirement: Device identity
The system SHALL identify each customer device by a random identifier generated on first visit and kept on that device. No login SHALL be required.

#### Scenario: Same device after reload
- **WHEN** a customer adds an item, then reloads the menu page
- **THEN** the same cart is shown

### Requirement: Item options and note
Tapping "Add" on a menu item SHALL open an options view listing that item's extras with their price deltas, a quantity selector (minimum 1), and a free-text note field. The note SHALL be optional. Cancel SHALL discard all selections and leave the cart unchanged.

#### Scenario: Add with extra and note
- **WHEN** a customer adds Pad Thai (฿80), selects "Extra egg +฿10", enters note "no beansprout!", and confirms
- **THEN** the cart contains one line for Pad Thai with that extra and note, priced ฿90

#### Scenario: Cancel options
- **WHEN** a customer opens options for an item and taps Cancel
- **THEN** the cart is unchanged

### Requirement: Per-device cart
Each device SHALL have its own cart within the table's TableSession. A device's cart lines SHALL NOT be visible to or editable by other devices.

#### Scenario: Carts isolated
- **WHEN** phone A adds Pad Thai to its cart and phone B opens the same table
- **THEN** phone B's cart is empty

### Requirement: Cart editing
Before confirmation, a customer SHALL be able to change a cart line's options, note, and quantity, and to remove the line. The cart SHALL show a running total.

#### Scenario: Edit quantity
- **WHEN** a customer changes a ฿90 line from quantity 1 to 2
- **THEN** the cart total increases by ฿90

#### Scenario: Remove line
- **WHEN** a customer removes a line
- **THEN** the line disappears and the total decreases by its amount

### Requirement: TableSession opens on first cart add
The system SHALL open a TableSession for a table when an item is first added to any cart for that table and no TableSession is open. Later adds from any device SHALL join the open TableSession.

#### Scenario: First add opens session
- **WHEN** table 5 has no open TableSession and a customer adds an item
- **THEN** a TableSession for table 5 is opened

#### Scenario: Second device joins
- **WHEN** table 5 has an open TableSession and another device adds an item
- **THEN** the item joins the same TableSession

### Requirement: Cart confirmation
Confirming a cart SHALL submit only that device's cart lines as one Ticket. Each line with quantity N SHALL become N separate OrderItems in status `pending`, each carrying the line's options, note, and unit price. The device's cart SHALL then be empty. Confirming an empty cart SHALL be rejected.

#### Scenario: Quantity split on confirm
- **WHEN** a customer confirms a cart holding Pad Thai ×3
- **THEN** three `pending` OrderItems for Pad Thai are created and the cart is empty

#### Scenario: Other device unaffected
- **WHEN** phone A confirms its cart while phone B's cart has items
- **THEN** phone B's cart keeps its items

#### Scenario: Empty cart
- **WHEN** a customer confirms an empty cart
- **THEN** the system rejects it and creates no OrderItems
