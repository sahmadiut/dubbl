# AUD-005 actual owner review and scope approval

Date: 2026-10-02 (Asia/Tehran). Reviewer: project-owner, the actual user in this conversation. Review kind: human. Recorded by coding-assistant; the assistant is not the approver.

The owner received the AUD-005 review packet and a Persian explanation of the baseline, both open financial findings, each proposed deferral, and the mandatory work continuing afterward. After requesting clarification, the owner replied in Persian; English translation: "No, your proposed recommendation is fine." This accepts the proposal just explained; it is not a refusal of that proposal.

Approved planning scope: continue core accounting correctness/parity, exact money/FX and safe migrations, English/Persian UI, RTL, Persian numeral/calendar presentation and manual/CSV banking. Defer intra-organization branches, toman input/display, bank-feed adapter and connector, new SaaS/miscellaneous endpoint parity, new Iranian statutory tax/payroll/e-invoicing implementation, statutory accounting-calendar rules and hosting/provider selection. Reasons and task mapping: [review packet](../docs/AUD-005-OWNER-REVIEW.md), accepted DEC-006 in [decisions](../docs/DECISIONS.md).

Optional task dispositions authorized: skip PAR-006, DATA-005, DATA-006 and DATA-007. Mandatory MON-009, DATA-004, LOC-004, QA-002 and release tasks remain. Existing capabilities are preserved. Any future inclusion requires an explicit new scope decision and reopening or bounded new tasks.

The planning baseline is accepted with both known defects open: trial-balance credit-normal balances displayed in the debit column, and bank API balance 0 versus GL 102000 cents in the synthetic fixture. Planned remediation remains PAR-008/DATA-004/MON-007 and QA-001. No defect is fixed or waived by this approval.

This is owner review of planning and scope, not independent specialist accounting qualification, approval of erroneous outputs, provider eligibility, IRR production enablement or deployment authorization. The schedule remains an estimate with no agreed start or due date.
