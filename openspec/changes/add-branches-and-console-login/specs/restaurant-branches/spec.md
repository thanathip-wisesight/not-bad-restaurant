# Spec Delta

## Purpose

Lets one brand run several restaurant branches from one system, each with its own tables, sessions, and bills, while sharing a single menu.

## ADDED Requirements

### Requirement: Branch identity
Each branch SHALL have a unique short uppercase code (e.g. `SIAM`) and a display name. The code SHALL identify the branch in table URLs, console URLs, and Bill numbers.

#### Scenario: Seeded branches
- **WHEN** the database is seeded
- **THEN** branches SIAM and ASOK exist, with 10 and 6 tables respectively

### Requirement: Per-branch tables
Each table SHALL belong to exactly one branch. Table numbers SHALL be unique within a branch and SHALL start at 1 in every branch.

#### Scenario: Same number in two branches
- **WHEN** both SIAM and ASOK have a table 5
- **THEN** they are two distinct tables

### Requirement: Shared menu
All branches SHALL show the same menu items, options, and prices.

#### Scenario: Same price everywhere
- **WHEN** a customer opens the menu at SIAM table 5 and another at ASOK table 2
- **THEN** both see the same items with the same prices

### Requirement: Branch isolation
TableSessions, carts, OrderItems, and Bills SHALL belong to the branch of their table. Activity at a table in one branch SHALL NOT affect any table in another branch.

#### Scenario: Independent sessions
- **WHEN** a customer adds a dish at SIAM table 5 while ASOK table 5 has no open session
- **THEN** a session opens for SIAM table 5 only, and ASOK table 5 stays free

#### Scenario: Payment stays in its branch
- **WHEN** SIAM table 5's Bill is paid
- **THEN** ASOK table 5's open session, if any, is unchanged

### Requirement: Existing data belongs to SIAM
When this change is deployed, every existing table, TableSession, cart line, OrderItem, and Bill SHALL be assigned to branch SIAM without altering its content, including Bill numbers already issued.

#### Scenario: Old bill keeps its number
- **WHEN** Bill `T05-0042` existed before the migration
- **THEN** afterwards it appears in SIAM's Bill history as `T05-0042` with its original items and total
