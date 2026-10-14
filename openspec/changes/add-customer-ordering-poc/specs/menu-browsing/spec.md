# Spec Delta

## Purpose

Lets a customer at a table open the restaurant menu on a phone from the table's QR code and browse items in a modern or traditional-like layout.

## ADDED Requirements

### Requirement: Table menu entry by QR URL
The system SHALL serve the menu at a per-table URL containing the table number, and SHALL display that table number on the menu page. Opening the URL SHALL NOT create a TableSession.

#### Scenario: Customer scans table QR
- **WHEN** a customer opens `/t/5`
- **THEN** the menu page is shown with "Table 5" visible

#### Scenario: Unknown table number
- **WHEN** a customer opens a URL for a table number that does not exist
- **THEN** the system shows a "table not found" message and no menu

#### Scenario: Scan does not open a session
- **WHEN** a customer opens `/t/5` and adds nothing to a cart
- **THEN** no TableSession exists for table 5

### Requirement: Six menu categories
The system SHALL group menu items into exactly these categories, in this order: Main, A la carte, Soup, Special, Dessert, Drink. Both layouts SHALL provide a tab per category.

#### Scenario: Category tabs present
- **WHEN** the menu page loads in either layout
- **THEN** six category tabs are shown in the stated order

### Requirement: Menu item display
Each menu item SHALL display its Thai name, English name, image placeholder or image, price in whole Thai Baht, and an "Add" control.

#### Scenario: Item card content
- **WHEN** the menu shows the item "ผัดไทย / Pad Thai" priced 80
- **THEN** the card shows both names, "฿80", and an "Add" control

### Requirement: Modern layout
The Modern layout SHALL present items in a vertically scrolling two-column grid, grouped by category. Selecting a category tab SHALL scroll to that category's first item.

#### Scenario: Tab jumps to category
- **WHEN** a customer in Modern layout taps the "Dessert" tab
- **THEN** the view scrolls to the first Dessert item

### Requirement: Traditional-like layout
The Traditional-like layout SHALL present items on horizontally paged pages of 4 columns by 2 rows. Each category SHALL start on a new page; unused slots on a category's last page SHALL stay empty. Selecting a category tab SHALL show that category's first page.

#### Scenario: Category starting a new page
- **WHEN** the Soup category has 10 items in Traditional-like layout
- **THEN** Soup occupies two pages (8 then 2 items) and the next category starts on a new page

#### Scenario: Tab jumps to page
- **WHEN** a customer taps the "Drink" tab
- **THEN** the first page of Drink items is shown

### Requirement: Layout selection
The system SHALL default to the Modern layout and SHALL let the customer switch layouts. The choice SHALL persist on the same device across page reloads.

#### Scenario: First visit
- **WHEN** a device opens the menu for the first time
- **THEN** the Modern layout is shown

#### Scenario: Choice remembered
- **WHEN** a customer switches to Traditional-like and reloads the page
- **THEN** the Traditional-like layout is shown
