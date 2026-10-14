# restaurant-console Specification

## Purpose

Gives restaurant staff a single simple page to see every table's orders, drive each plate's status, resolve cancel requests, record cashier payments, clear tables, and print receipts.

## Requirements

### Requirement: Tables overview
The console SHALL list every table of the selected branch with its open TableSession, if any: Bill number, Bill status, Bill total, and each OrderItem with name, options, note, and status. Tables of other branches SHALL NOT appear. Items in `cancel_requested` SHALL be visually highlighted. The view SHALL refresh within 15 seconds of changes.

#### Scenario: New order appears
- **WHEN** a customer confirms a cart at SIAM table 3
- **THEN** the SIAM console shows the new `pending` OrderItems under table 3 within 15 seconds

#### Scenario: Idle table
- **WHEN** SIAM table 7 has no open TableSession
- **THEN** the SIAM console shows table 7 as free

#### Scenario: Other branch hidden
- **WHEN** ASOK table 2 has an open TableSession
- **THEN** the SIAM console does not show it

### Requirement: Item status actions
For each OrderItem the console SHALL offer only the actions valid for its status: Start (`pending`→`in_progress`), Serve (`in_progress`→`served`), Void (`pending` or `in_progress`→`voided`, asking for a required reason), Confirm cancel (`cancel_requested`→`cancelled`) and Reject cancel (`cancel_requested`→`pending`), both offering an optional remark.

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
- **WHEN** staff taps Void on an `in_progress` OrderItem and enters the reason "burnt"
- **THEN** it becomes `voided`, is excluded from the Bill total, and the console shows the reason

### Requirement: Mark Bill paid
The console SHALL let staff mark a Bill of the selected branch paid only when every OrderItem is `served`, `cancelled`, or `voided`. Marking paid SHALL have the same effect as a successful customer payment, including the unsent carts warning defined in the payment capability.

#### Scenario: Paid at cashier
- **WHEN** all items of Bill `SIAM-T05-0042` are served, cancelled, or voided and staff on the SIAM console taps Mark paid
- **THEN** the Bill becomes `paid` and SIAM table 5's TableSession closes

#### Scenario: Unresolved items block
- **WHEN** a Bill has an `in_progress` item and staff taps Mark paid
- **THEN** the system rejects it and names the unresolved items

### Requirement: Force-clear table
The console SHALL let staff clear a table's open TableSession at any time, after a confirmation prompt. If the Bill is unpaid, it SHALL be recorded as `voided`. The session closes as on payment, with the final dish statuses defined in order-tracking, and the Bill stays in history.

#### Scenario: Walk-out
- **WHEN** staff clears table 4 whose Bill is unpaid and confirms the prompt
- **THEN** the Bill is recorded `voided`, its unfinished dishes become `voided` with the reason "table cleared", table 4 shows as free, and the Bill remains in history

### Requirement: Print receipt
The console SHALL provide "Print bill" for any open or historical Bill of the selected branch, opening the browser print dialog with a receipt showing restaurant name, branch name, table number, Bill number, date and time, `served` or `finished` OrderItems with options and prices, total, and paid/unpaid/voided status. It SHALL be repeatable. The receipt is not a tax invoice.

#### Scenario: Reprint
- **WHEN** staff taps Print bill twice on the same Bill
- **THEN** the print dialog opens each time with identical receipt content

#### Scenario: Branch on receipt
- **WHEN** staff prints a SIAM Bill
- **THEN** the receipt shows the SIAM branch name

#### Scenario: Paid bill receipt
- **WHEN** staff prints a paid Bill whose served dishes became `finished`
- **THEN** those dishes are listed on the receipt and voided or cancelled dishes are not

### Requirement: Bill history
The console SHALL list closed Bills of the selected branch, newest first, with Bill number, table, close time, total, and status (`paid` or `voided`), and SHALL allow opening a Bill to view its OrderItems and print it.

#### Scenario: View past bill
- **WHEN** staff opens SIAM Bill history after SIAM table 5 paid
- **THEN** that Bill is listed as `paid` with its total

#### Scenario: Other branch's bills hidden
- **WHEN** ASOK table 2's Bill has been paid
- **THEN** it does not appear in SIAM Bill history

### Requirement: Layout by screen width
At viewport widths of 768 px and above, the console SHALL show the kitchen board with the table strip. Below 768 px, it SHALL show the per-table card list with a count bar. Both layouts SHALL offer the same staff actions with the same rules.

#### Scenario: Tablet
- **WHEN** the console is opened at 768×1024
- **THEN** the kitchen board and table strip are shown

#### Scenario: Phone
- **WHEN** the console is opened at 390×844
- **THEN** the per-table card list with a count bar is shown

### Requirement: Kitchen board columns
The kitchen board SHALL show four columns in this order: Cancel requested, Pending, In progress, Served, each holding the dishes of all open bills in that status. Cancelled and voided dishes SHALL NOT appear on the board. Cancel requested, Pending, and In progress SHALL list the longest-waiting dish first; Served SHALL list the most recently served first.

#### Scenario: Dish moves column
- **WHEN** staff taps Start on a dish in the Pending column
- **THEN** the dish appears in the In progress column

#### Scenario: Oldest pending first
- **WHEN** table 2 confirmed a dish 6 minutes ago and table 7 confirmed one 1 minute ago
- **THEN** table 2's dish is above table 7's in the Pending column

#### Scenario: Cancelled dish hidden
- **WHEN** staff confirms a cancel request
- **THEN** the dish leaves the board

#### Scenario: Voided dish hidden
- **WHEN** staff voids a dish
- **THEN** the dish leaves the board

### Requirement: Column header counts
Each column header SHALL show its dish count and stay visible while the column scrolls. The Cancel requested header SHALL be visually highlighted while its count is above zero.

#### Scenario: Cancel request needs attention
- **WHEN** a customer requests a cancel at any table
- **THEN** within 15 seconds the Cancel requested header shows a count of at least 1 and is highlighted

### Requirement: Board dish card
Each board card SHALL show the table number prominently, the dish name, selected options, the note, the time elapsed since the dish's last status change in whole minutes, and only the staff actions valid for its status.

#### Scenario: Card content
- **WHEN** table 5's Pad Thai with "Extra egg" and note "no beansprout!" has been pending for 4 minutes
- **THEN** its card shows "Table 5", the dish, "Extra egg", the note, "4 min", and the Start and Void actions

### Requirement: Table strip
Above the board, the console SHALL show one chip per table of the selected branch in table-number order. A free table's chip SHALL be grey and labelled free. An occupied table's chip SHALL show its Bill number, served total, and the number of dishes not yet served, cancelled, or voided.

#### Scenario: Strip content
- **WHEN** SIAM table 3 is free and SIAM table 5 has Bill SIAM-T05-0042 with ฿90 served and 2 unresolved dishes
- **THEN** table 3's chip is grey and labelled free, and table 5's chip shows SIAM-T05-0042, ฿90, and 2

### Requirement: Table drawer
Selecting an occupied table chip SHALL open a side drawer listing all of that table's dishes, including cancelled and voided ones with their latest reason or remark, with their statuses and valid item actions, plus Mark paid, Print bill, and Clear table. The drawer SHALL stay open across refreshes and SHALL close when the table's bill closes or staff dismisses it.

#### Scenario: Pay from drawer
- **WHEN** staff opens table 5's drawer and taps Mark paid with all dishes resolved
- **THEN** the bill is paid, the drawer closes, and table 5's chip shows free

#### Scenario: Drawer survives refresh
- **WHEN** the drawer is open and the console refreshes
- **THEN** the drawer stays open on the same table

#### Scenario: Void reason shown
- **WHEN** a dish of table 5 was voided with the reason "burnt"
- **THEN** table 5's drawer lists it as voided with "burnt"

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

### Requirement: Batch selection
On the kitchen board, in the table drawer, and on the phone card list, staff SHALL be able to select several dishes, but only dishes of the same table and the same status. Each place SHALL offer "select all" for the dishes of that table in that status. Dishes of another table or status SHALL NOT be selectable while a selection exists.

#### Scenario: Same table and status only
- **WHEN** staff has selected a `pending` dish of table 5
- **THEN** `pending` dishes of table 5 can be added to the selection, and dishes of table 3 or `in_progress` dishes of table 5 cannot

#### Scenario: Select all
- **WHEN** table 5 has three `pending` dishes and staff taps select all for them
- **THEN** all three are selected

### Requirement: Batch status update
For a selection, the console SHALL offer only the actions valid for that status and SHALL apply the chosen action to every selected dish together, all with the same change time. A batch Void SHALL ask for one reason that applies to all selected dishes. If any selected dish has changed status in the meantime, the whole batch SHALL be rejected, nothing SHALL change, and the console SHALL name the conflicting dishes.

#### Scenario: Two dishes started together
- **WHEN** staff selects Fried Rice and Crispy Pork, both `pending` at table 5, and taps Start
- **THEN** both become `in_progress` with the same change time

#### Scenario: Conflict rejects the batch
- **WHEN** staff starts a batch of two `pending` dishes, but a customer's cancel request turned one of them into `cancel_requested` first
- **THEN** neither dish changes and the console names the dish whose status changed

#### Scenario: Batch void
- **WHEN** staff voids three selected `in_progress` dishes of table 5 with the reason "stove failure"
- **THEN** all three become `voided` with the reason "stove failure"
