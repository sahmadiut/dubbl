const activityStatusKeys = {
  draft: "statusDraft", sent: "statusSent", partial: "statusPartial",
  paid: "statusPaid", overdue: "statusOverdue", void: "statusVoid",
  pending_approval: "statusPendingApproval", rejected: "statusRejected",
  accepted: "statusAccepted", declined: "statusDeclined", expired: "statusExpired",
  converted: "statusConverted", applied: "statusApplied", received: "statusReceived", made: "statusMade",
} as const;

const statementTypeKeys = {
  invoice: "typeInvoice", credit_note: "typeCreditNote", payment: "typePayment",
  bill: "typeBill", debit_note: "typeDebitNote",
} as const;

export function activityStatusKey(value: string) {
  return Object.hasOwn(activityStatusKeys, value)
    ? activityStatusKeys[value as keyof typeof activityStatusKeys] : "statusUnknown";
}

export function statementTypeKey(value: string) {
  return Object.hasOwn(statementTypeKeys, value)
    ? statementTypeKeys[value as keyof typeof statementTypeKeys] : "typeUnknown";
}
