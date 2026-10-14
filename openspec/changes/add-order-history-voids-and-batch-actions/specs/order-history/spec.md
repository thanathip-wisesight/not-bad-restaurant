# Spec Delta

## Purpose

Keeps a timestamped record of every dish status change and exposes it per branch as JSON, so the restaurant can see which dishes are popular and which are often cancelled or voided.

## ADDED Requirements

### Requirement: Status change log
Every OrderItem status change SHALL be recorded with the previous status (none when the dish is first confirmed as `pending`), the new status, the time, who made it (staff user, customer device, or system), and the reason or remark if any. Records SHALL be kept after the Bill closes and SHALL never be edited or deleted by the application. Changes made together in one batch SHALL share the same time.

#### Scenario: Full timeline of a served dish
- **WHEN** a dish is confirmed at 12:00:00, started at 12:01:00, served at 12:07:00, and its Bill is paid at 12:30:00
- **THEN** its log reads: none→`pending` 12:00:00 (customer), `pending`→`in_progress` 12:01:00 (staff), `in_progress`→`served` 12:07:00 (staff), `served`→`finished` 12:30:00 (system)

#### Scenario: Void reason kept
- **WHEN** staff voids a dish with the reason "burnt"
- **THEN** the log entry for that change records "burnt" and the staff user

### Requirement: Dish counts API
The console SHALL provide a JSON endpoint returning, for the selected branch and an optional date range, one entry per menu item ID with the dish name and the number of dishes ordered, `finished`, `cancelled`, and `voided`.

#### Scenario: Counts per dish
- **WHEN** in the range SIAM had 3 Pad Thai ordered, of which 2 finished and 1 was voided
- **THEN** the Pad Thai entry shows ordered 3, finished 2, cancelled 0, voided 1

#### Scenario: Branch isolation
- **WHEN** ASOK had 5 Pad Thai ordered in the same range
- **THEN** the SIAM counts do not include them

### Requirement: Dish timeline API
The console SHALL provide a JSON endpoint returning, for the selected branch and an optional date range and menu item ID, the individual dishes with their Bill number, table, current status, and full status change log in time order.

#### Scenario: Filter by menu item
- **WHEN** staff requests SIAM timelines for the Pad Thai menu item ID
- **THEN** only Pad Thai dishes of SIAM are returned, each with its log

### Requirement: Telemetry access
The telemetry endpoints SHALL follow console access rules: status 401 without a staff session, 403 for a branch the user does not belong to, and an invalid date range or menu item ID SHALL be rejected with status 400.

#### Scenario: Wrong branch
- **WHEN** `siam.staff` requests ASOK dish counts
- **THEN** the response status is 403

#### Scenario: Bad range
- **WHEN** the request has `from` later than `to`
- **THEN** the response status is 400
