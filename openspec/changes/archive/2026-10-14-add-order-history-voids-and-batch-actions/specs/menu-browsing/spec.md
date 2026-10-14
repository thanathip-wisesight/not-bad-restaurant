# Spec Delta

## MODIFIED Requirements

### Requirement: Table menu entry by QR URL
The system SHALL serve the menu at a per-table URL containing the branch code and the table number (`/b/<branchCode>/t/<tableNo>`), and SHALL display the branch name and table number on the menu page. Opening the URL SHALL NOT create a TableSession. Retired pre-branch paths (`/t/<tableNo>`) are not served and get the application's standard not-found page.

#### Scenario: Customer scans table QR
- **WHEN** a customer opens `/b/SIAM/t/5`
- **THEN** the menu page is shown with the SIAM branch name and "Table 5" visible

#### Scenario: Unknown table number
- **WHEN** a customer opens a `/b/…/t/…` URL for a branch code or table number that does not exist
- **THEN** the system shows a "table not found" message and no menu

#### Scenario: Retired table link
- **WHEN** a customer opens the old form `/t/5`
- **THEN** the standard not-found page is shown and no menu

#### Scenario: Scan does not open a session
- **WHEN** a customer opens `/b/SIAM/t/5` and adds nothing to a cart
- **THEN** no TableSession exists for SIAM table 5
