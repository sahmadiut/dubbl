export const timeOperations = [
  {
    "name": "list_payroll_timesheets",
    "service": "listPayrollTimesheets",
    "path": "timesheets",
    "verb": "GET",
    "env": "",
    "args": [],
    "body": false,
    "query": true
  },
  {
    "name": "create_payroll_timesheet",
    "service": "createPayrollTimesheet",
    "path": "timesheets",
    "verb": "POST",
    "env": "timesheet",
    "args": [],
    "body": true,
    "query": false
  },
  {
    "name": "get_payroll_timesheet",
    "service": "getPayrollTimesheet",
    "path": "timesheets/[id]",
    "verb": "GET",
    "env": "timesheet",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "update_payroll_timesheet",
    "service": "updatePayrollTimesheet",
    "path": "timesheets/[id]",
    "verb": "PATCH",
    "env": "timesheet",
    "args": [
      "id"
    ],
    "body": true,
    "query": false
  },
  {
    "name": "list_payroll_timesheet_entries",
    "service": "listPayrollTimesheetEntries",
    "path": "timesheets/[id]/entries",
    "verb": "GET",
    "env": "data",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "create_payroll_timesheet_entry",
    "service": "createPayrollTimesheetEntry",
    "path": "timesheets/[id]/entries",
    "verb": "POST",
    "env": "entry",
    "args": [
      "id"
    ],
    "body": true,
    "query": false
  },
  {
    "name": "delete_payroll_timesheet_entry",
    "service": "deletePayrollTimesheetEntry",
    "path": "timesheets/[id]/entries",
    "verb": "DELETE",
    "env": "",
    "args": [
      "id",
      "entryId"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "submit_payroll_timesheet",
    "service": "submitPayrollTimesheet",
    "path": "timesheets/[id]/submit",
    "verb": "POST",
    "env": "timesheet",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "approve_payroll_timesheet",
    "service": "approvePayrollTimesheet",
    "path": "timesheets/[id]/approve",
    "verb": "POST",
    "env": "timesheet",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "reject_payroll_timesheet",
    "service": "rejectPayrollTimesheet",
    "path": "timesheets/[id]/reject",
    "verb": "POST",
    "env": "timesheet",
    "args": [
      "id"
    ],
    "body": true,
    "query": false
  },
  {
    "name": "list_payroll_shifts",
    "service": "listPayrollShifts",
    "path": "shifts",
    "verb": "GET",
    "env": "data",
    "args": [],
    "body": false,
    "query": false
  },
  {
    "name": "create_payroll_shift",
    "service": "createPayrollShift",
    "path": "shifts",
    "verb": "POST",
    "env": "shift",
    "args": [],
    "body": true,
    "query": false
  },
  {
    "name": "get_payroll_shift",
    "service": "getPayrollShift",
    "path": "shifts/[id]",
    "verb": "GET",
    "env": "shift",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "update_payroll_shift",
    "service": "updatePayrollShift",
    "path": "shifts/[id]",
    "verb": "PATCH",
    "env": "shift",
    "args": [
      "id"
    ],
    "body": true,
    "query": false
  },
  {
    "name": "list_payroll_leave_policies",
    "service": "listPayrollLeavePolicies",
    "path": "leave/policies",
    "verb": "GET",
    "env": "data",
    "args": [],
    "body": false,
    "query": false
  },
  {
    "name": "create_payroll_leave_policy",
    "service": "createPayrollLeavePolicy",
    "path": "leave/policies",
    "verb": "POST",
    "env": "policy",
    "args": [],
    "body": true,
    "query": false
  },
  {
    "name": "get_payroll_leave_policy",
    "service": "getPayrollLeavePolicy",
    "path": "leave/policies/[id]",
    "verb": "GET",
    "env": "policy",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "update_payroll_leave_policy",
    "service": "updatePayrollLeavePolicy",
    "path": "leave/policies/[id]",
    "verb": "PATCH",
    "env": "policy",
    "args": [
      "id"
    ],
    "body": true,
    "query": false
  },
  {
    "name": "delete_payroll_shift",
    "service": "deletePayrollShift",
    "path": "shifts/[id]",
    "verb": "DELETE",
    "env": "",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "list_payroll_employee_schedules",
    "service": "listPayrollEmployeeSchedules",
    "path": "employees/[id]/schedule",
    "verb": "GET",
    "env": "data",
    "args": [
      "employeeId"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "create_payroll_employee_schedule",
    "service": "createPayrollEmployeeSchedule",
    "path": "employees/[id]/schedule",
    "verb": "POST",
    "env": "schedule",
    "args": [
      "employeeId"
    ],
    "body": true,
    "query": false
  },
  {
    "name": "list_payroll_leave_requests",
    "service": "listPayrollLeaveRequests",
    "path": "leave/requests",
    "verb": "GET",
    "env": "",
    "args": [],
    "body": false,
    "query": true
  },
  {
    "name": "create_payroll_leave_request",
    "service": "createPayrollLeaveRequest",
    "path": "leave/requests",
    "verb": "POST",
    "env": "request",
    "args": [],
    "body": true,
    "query": false
  },
  {
    "name": "get_payroll_leave_request",
    "service": "getPayrollLeaveRequest",
    "path": "leave/requests/[id]",
    "verb": "GET",
    "env": "request",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "update_payroll_leave_request",
    "service": "updatePayrollLeaveRequest",
    "path": "leave/requests/[id]",
    "verb": "PATCH",
    "env": "request",
    "args": [
      "id"
    ],
    "body": true,
    "query": false
  },
  {
    "name": "approve_payroll_leave_request",
    "service": "approvePayrollLeaveRequest",
    "path": "leave/requests/[id]/approve",
    "verb": "POST",
    "env": "request",
    "args": [
      "id"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "reject_payroll_leave_request",
    "service": "rejectPayrollLeaveRequest",
    "path": "leave/requests/[id]/reject",
    "verb": "POST",
    "env": "request",
    "args": [
      "id"
    ],
    "body": true,
    "query": false
  },
  {
    "name": "get_employee_leave_balances",
    "service": "getPayrollEmployeeLeaveBalances",
    "path": "employees/[id]/leave-balances",
    "verb": "GET",
    "env": "data",
    "args": [
      "employeeId"
    ],
    "body": false,
    "query": false
  },
  {
    "name": "list_self_payroll_timesheets",
    "service": "listSelfPayrollTimesheets",
    "path": "self-service/timesheets",
    "verb": "GET",
    "env": "data",
    "args": [],
    "body": false,
    "query": false
  },
  {
    "name": "create_self_payroll_timesheet",
    "service": "createSelfPayrollTimesheet",
    "path": "self-service/timesheets",
    "verb": "POST",
    "env": "timesheet",
    "args": [],
    "body": true,
    "query": false
  },
  {
    "name": "create_self_payroll_leave_request",
    "service": "createSelfPayrollLeaveRequest",
    "path": "self-service/leave-requests",
    "verb": "POST",
    "env": "request",
    "args": [],
    "body": true,
    "query": false
  },
  {
    "name": "get_self_payroll_leave_balances",
    "service": "getSelfPayrollLeaveBalances",
    "path": "self-service/leave-balance",
    "verb": "GET",
    "env": "data",
    "args": [],
    "body": false,
    "query": false
  }
] as const;
