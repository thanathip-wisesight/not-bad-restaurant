# Spec Delta

## MODIFIED Requirements

### Requirement: Table menu entry by QR URL
The system SHALL serve the menu at a per-table URL containing the branch code and the table number (`/b/<branchCode>/t/<tableNo>`), and SHALL display the branch name and table number on the menu page. Opening the URL SHALL NOT create a TableSession.

#### Scenario: Customer scans table QR
- **WHEN** a customer opens `/b/SIAM/t/5`
- **THEN** the menu page is shown with the SIAM branch name and "Table 5" visible

#### Scenario: Unknown table number
- **WHEN** a customer opens a URL for a branch code or table number that does not exist, including the old `/t/5` form
- **THEN** the system shows a "table not found" message and no menu

#### Scenario: Scan does not open a session
- **WHEN** a customer opens `/b/SIAM/t/5` and adds nothing to a cart
- **THEN** no TableSession exists for SIAM table 5
