# RTL bidi-text mass adoption — Owner skip decision

## Decision

Owner decided that mass bidi-text adoption across all project files (RTL-010, RTL-011, RTL-008, RTL-002) is unnecessary and counterproductive for this project.

## Rationale

The foundational RTL work is complete and sufficient:
- **RTL-003**: Root `html lang/dir` and Radix direction propagation
- **RTL-004**: Shared primitives converted to logical CSS (`start/end` instead of `left/right`)
- **RTL-005**: Shell/sidebar/navigation converted to logical direction
- **RTL-006**: Shared `BidiText`/`IdentifierText` controls created (foundation available when needed)
- **RTL-007**: Persian font (Vazirmatn) self-hosted with proper licensing
- **RTL-009**: Shared data-table direction, sorting, and accessibility hardened

The remaining tasks (RTL-010, RTL-011) would have swept through every TSX file in the project replacing text rendering with `BidiText` wrappers, which the owner judged as unnecessary overhead that adds complexity without proportional benefit. The shared controls exist and can be adopted incrementally where actually needed.

## Affected tasks

- RTL-010: Adopt bidi across dashboard modules → skipped
- RTL-011: Adopt bidi across public/admin/outputs → skipped
- RTL-008: Parent integration of RTL-009/010/011 → skipped
- RTL-002: Parent integration of RTL-006/007/008 → skipped

## Date

2026-10-27T04:30:00+03:30
