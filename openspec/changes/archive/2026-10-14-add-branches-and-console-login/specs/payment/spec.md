# Spec Delta

## MODIFIED Requirements

### Requirement: Bill number
Each TableSession SHALL have a Bill number unique across all sessions, shown in the customer's Orders tab and in the console, combining the branch code, the table number, and a sequence (e.g. `SIAM-T05-0042`). Bill numbers issued before branches existed keep their original form.

#### Scenario: Bill number visible
- **WHEN** a TableSession is open for SIAM table 5
- **THEN** the Orders tab shows a Bill number beginning with `SIAM-T05-`

#### Scenario: Same table number, different branch
- **WHEN** sessions are open at SIAM table 5 and ASOK table 5
- **THEN** their Bill numbers begin with `SIAM-T05-` and `ASOK-T05-` respectively

### Requirement: Cashier payment
A customer SHALL be able to pay at the cashier by presenting the Bill number; staff record it through the restaurant console of that Bill's branch.

#### Scenario: Pay at counter
- **WHEN** staff on the SIAM console marks Bill `SIAM-T05-0042` paid
- **THEN** the Bill becomes `paid`
