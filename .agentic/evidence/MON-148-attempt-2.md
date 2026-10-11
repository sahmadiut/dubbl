# MON-148 attempt 2 - Evidence count correction

2026-10-11, codex, D:/Projects/dubbl on master; self-reviewed scoped delivery.
Reopened before commit to correct one count in immutable attempt-1 evidence.

The five page entries removed from scripts/legacy-money-baseline.json contain
33 permitted legacy references, not eighteen. Eighteen was the diff's removed
JSON line count and was incorrectly described as a reference count. Actual
counts are batch detail 6; batch list 4 formatMoney plus 3 parseMoney; schedule
3; payment detail 8 formatMoney plus 3 minorUnitsToDecimal plus 2
decimalToMinorUnits; payment list 4. The eight named allowances sum to 33.

This correction supersedes that sentence of MON-148-attempt-1.md. Implementation,
scope, acceptance results, actual test commands/results and limitations in
attempt-1 remain unchanged. The final source-only inventory drift check also
passed (415 columns, 2028 files, 1522 consumers, 29072 occurrences).
No implementation or test change occurred after those final checks. Parent
integration remains open. Finish scoped review/done, authorized commit/push,
remote SHA and clean-tree verification, then stop after this task.
