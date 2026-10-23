const statusKeys = {
  draft: "statusDraft", sent: "statusSent", partial: "statusPartial",
  paid: "statusPaid", overdue: "statusOverdue", void: "statusVoid",
  accepted: "statusAccepted", declined: "statusDeclined", expired: "statusExpired",
  converted: "statusConverted", pending_approval: "statusPendingApproval",
  rejected: "statusRejected",
} as const;

export function portalStatusKey(status: string) {
  return Object.hasOwn(statusKeys, status)
    ? statusKeys[status as keyof typeof statusKeys]
    : "statusUnknown";
}
