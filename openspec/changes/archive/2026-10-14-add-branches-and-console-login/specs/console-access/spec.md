# Spec Delta

## Purpose

Restricts the restaurant console to logged-in staff and scopes everything they see and do to the branches they belong to.

## ADDED Requirements

### Requirement: Staff login
The system SHALL provide a login page where staff enter a username and password. A correct pair SHALL start a staff session stored in an HTTP-only cookie; a wrong pair SHALL show a generic "invalid username or password" message without revealing which part was wrong. Passwords SHALL be stored only as salted hashes.

#### Scenario: Successful login
- **WHEN** `siam.staff` enters the correct password
- **THEN** a staff session starts and the user continues to the console

#### Scenario: Wrong password
- **WHEN** a user enters a wrong password
- **THEN** no session starts and the page shows "invalid username or password"

### Requirement: Session lifetime and logout
A staff session SHALL expire after 24 hours without console activity. Any console request within that time SHALL extend it. Logging out SHALL end the session immediately.

#### Scenario: Inactive for a day
- **WHEN** a staff user makes no console request for more than 24 hours
- **THEN** the next console request requires logging in again

#### Scenario: Logout
- **WHEN** a staff user taps Log out
- **THEN** the session ends and visiting `/console` shows the login page

### Requirement: Console requires login
Every page under `/console` and every console API SHALL require a valid staff session. Pages SHALL redirect to the login page and return to the requested page after login; APIs SHALL respond with status 401. Customer pages and APIs SHALL NOT require login.

#### Scenario: Page without session
- **WHEN** someone without a session opens `/console/SIAM/history`
- **THEN** the login page is shown, and after logging in they land on `/console/SIAM/history`

#### Scenario: API without session
- **WHEN** a request to a console API carries no valid session
- **THEN** the response status is 401 and nothing changes

#### Scenario: Customers unaffected
- **WHEN** a customer opens `/b/SIAM/t/5` without logging in
- **THEN** the menu is shown

### Requirement: Branch selection
Each staff user SHALL belong to one or more branches. After login, a user with one branch SHALL go straight to that branch's console; a user with several SHALL choose one from a list of their branches. The console SHALL show the selected branch and, for users with several branches, a control to switch branch.

#### Scenario: Single-branch user
- **WHEN** `siam.staff` logs in
- **THEN** the SIAM console is shown without a branch choice

#### Scenario: Multi-branch user
- **WHEN** `area.manager` logs in
- **THEN** a choice of SIAM and ASOK is shown, and choosing ASOK opens the ASOK console

#### Scenario: Switching branch
- **WHEN** `area.manager` is on the SIAM console and taps Switch branch, then chooses ASOK
- **THEN** the ASOK console is shown

### Requirement: Branch-scoped authorization
Every console read and action SHALL be limited to the selected branch, and the server SHALL reject any request for a branch the user does not belong to, or for a table, OrderItem, or Bill outside the selected branch, without changing anything.

#### Scenario: Not a member
- **WHEN** `siam.staff` opens `/console/ASOK` or calls an ASOK console API
- **THEN** access is refused with status 403 and nothing is shown or changed

#### Scenario: Item from another branch
- **WHEN** a request on the SIAM console targets an OrderItem that belongs to an ASOK table
- **THEN** the request is rejected as not found and the item is unchanged

### Requirement: Seeded staff accounts
Staff accounts and branch memberships SHALL come only from the seed; there SHALL be no sign-up or account administration. The seed SHALL create `siam.staff` (SIAM) and `area.manager` (SIAM and ASOK).

#### Scenario: No sign-up
- **WHEN** someone looks for a way to create an account
- **THEN** no sign-up page or API exists
