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
The Traditional-like layout SHALL show one page at a time filling the landscape screen, each page 4 columns by 2 rows with no vertical scrolling. Each category SHALL start on a new page; unused slots on a category's last page SHALL stay empty. Pages SHALL turn by horizontal swipe or previous/next controls, with a page indicator. Selecting a category tab SHALL show that category's first page.

#### Scenario: Category starting a new page
- **WHEN** the Soup category has 10 items in Traditional-like layout
- **THEN** Soup occupies two pages (8 then 2 items) and the next category starts on a new page

#### Scenario: Tab jumps to page
- **WHEN** a customer taps the "Drink" tab
- **THEN** the first page of Drink items is shown

#### Scenario: Turning pages
- **WHEN** a customer on page 1 taps the next-page control
- **THEN** page 2 is shown and the indicator reads "2/N"

### Requirement: Traditional-like layout is landscape-only
Traditional-like SHALL render only while the screen is in landscape orientation. While Traditional-like is the chosen layout and the screen is portrait, the system SHALL show the Modern layout with a hint to turn the phone sideways, and SHALL show Traditional-like again when the screen turns to landscape, without changing the stored choice. The system SHALL NOT request fullscreen or lock screen orientation.

#### Scenario: Phone held upright
- **WHEN** the chosen layout is Traditional-like and the phone is in portrait
- **THEN** the Modern layout is shown with a "turn your phone sideways" hint

#### Scenario: Phone turned sideways
- **WHEN** the same phone is rotated to landscape
- **THEN** the Traditional-like layout is shown

#### Scenario: Modern ignores orientation
- **WHEN** the chosen layout is Modern and the phone is in landscape
- **THEN** the Modern layout is shown

### Requirement: Compact landscape controls
While Traditional-like is shown, the system SHALL replace the header and bottom tab bar with one compact top bar holding the table number, the six category tabs, Cart and Orders controls with counts, and a control to switch to Modern. Cart, Orders, and item options SHALL open as overlays above the menu page, scrolling internally when taller than the screen; closing one SHALL return to the same menu page.

#### Scenario: Cart overlay keeps the page
- **WHEN** a customer on Soup page 2 opens Cart and closes it
- **THEN** Soup page 2 is shown

#### Scenario: Options taller than the screen
- **WHEN** an item's options do not fit the landscape screen height
- **THEN** the options overlay scrolls internally and Confirm stays reachable

### Requirement: Layout selection
The system SHALL default to the Modern layout and SHALL let the customer switch layouts. The choice SHALL persist on the same device across page reloads.

#### Scenario: First visit
- **WHEN** a device opens the menu for the first time
- **THEN** the Modern layout is shown

#### Scenario: Choice remembered
- **WHEN** a customer switches to Traditional-like and reloads the page in landscape
- **THEN** the Traditional-like layout is shown
