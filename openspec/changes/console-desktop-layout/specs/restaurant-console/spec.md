# Spec Delta

## ADDED Requirements

### Requirement: Layout by screen width
At viewport widths of 768 px and above, the console SHALL show the kitchen board with the table strip. Below 768 px, it SHALL show the per-table card list with a count bar. Both layouts SHALL offer the same staff actions with the same rules.

#### Scenario: Tablet
- **WHEN** the console is opened at 768×1024
- **THEN** the kitchen board and table strip are shown

#### Scenario: Phone
- **WHEN** the console is opened at 390×844
- **THEN** the per-table card list with a count bar is shown

### Requirement: Kitchen board columns
The kitchen board SHALL show four columns in this order: Cancel requested, Pending, In progress, Served, each holding the dishes of all open bills in that status. Cancelled dishes SHALL NOT appear on the board. Cancel requested, Pending, and In progress SHALL list the longest-waiting dish first; Served SHALL list the most recently served first.

#### Scenario: Dish moves column
- **WHEN** staff taps Start on a dish in the Pending column
- **THEN** the dish appears in the In progress column

#### Scenario: Oldest pending first
- **WHEN** table 2 confirmed a dish 6 minutes ago and table 7 confirmed one 1 minute ago
- **THEN** table 2's dish is above table 7's in the Pending column

#### Scenario: Cancelled dish hidden
- **WHEN** staff confirms a cancel request
- **THEN** the dish leaves the board

### Requirement: Column header counts
Each column header SHALL show its dish count and stay visible while the column scrolls. The Cancel requested header SHALL be visually highlighted while its count is above zero.

#### Scenario: Cancel request needs attention
- **WHEN** a customer requests a cancel at any table
- **THEN** within 10 seconds the Cancel requested header shows a count of at least 1 and is highlighted

### Requirement: Board dish card
Each board card SHALL show the table number prominently, the dish name, selected options, the note, the time elapsed since the dish's last status change in whole minutes, and only the staff actions valid for its status.

#### Scenario: Card content
- **WHEN** table 5's Pad Thai with "Extra egg" and note "no beansprout!" has been pending for 4 minutes
- **THEN** its card shows "Table 5", the dish, "Extra egg", the note, "4 min", and the Start and Void actions

### Requirement: Table strip
Above the board, the console SHALL show one chip per table in table-number order. A free table's chip SHALL be grey and labelled free. An occupied table's chip SHALL show its Bill number, served total, and the number of dishes not yet served or cancelled.

#### Scenario: Strip content
- **WHEN** table 3 is free and table 5 has Bill T05-0042 with ฿90 served and 2 unresolved dishes
- **THEN** table 3's chip is grey and labelled free, and table 5's chip shows T05-0042, ฿90, and 2

### Requirement: Table drawer
Selecting an occupied table chip SHALL open a side drawer listing all of that table's dishes, including cancelled ones, with their statuses and valid item actions, plus Mark paid, Print bill, and Clear table. The drawer SHALL stay open across refreshes and SHALL close when the table's bill closes or staff dismisses it.

#### Scenario: Pay from drawer
- **WHEN** staff opens table 5's drawer and taps Mark paid with all dishes resolved
- **THEN** the bill is paid, the drawer closes, and table 5's chip shows free

#### Scenario: Drawer survives refresh
- **WHEN** the drawer is open and the console refreshes
- **THEN** the drawer stays open on the same table

### Requirement: Phone count bar
Below 768 px, the top of the console SHALL show the counts of Cancel requested, Pending, and In progress dishes, with Cancel requested highlighted while above zero.

#### Scenario: Counts on phone
- **WHEN** there are 1 cancel request and 3 pending dishes across tables, viewed at 390×844
- **THEN** the count bar shows 1 cancel requested (highlighted) and 3 pending

### Requirement: Full-width bill history
At 1280 px and above, the Bill history page SHALL use the available width instead of a narrow centred column. The receipt print layout SHALL be unchanged.

#### Scenario: Desktop history
- **WHEN** Bill history is opened at 1920×1080
- **THEN** the table spans the page width and the receipt print page keeps its receipt width
