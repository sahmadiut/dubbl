import type { useTranslations } from "next-intl";

type Translate = ReturnType<typeof useTranslations<"SettingsMembers">>;
interface Capacity {
  plan: string;
  status: string;
  max: number | null;
  seatCount: number;
  reason: string | null;
}

export function memberPlanLabel(t: Translate, plan: string) {
  switch (plan) {
    case "free": case "pro": case "business": return t(plan);
    default: return plan;
  }
}

export function memberCapacityReason(t: Translate, capacity: Capacity | null) {
  if (!capacity?.reason) return t("upgradeYourPlanToAddMoreMembers");
  // Use structured fields rather than interpolating arbitrary server prose.
  if (capacity.status !== "active" && capacity.status !== "trialing") {
    return t("updateYourPaymentMethodToContinueInvitingMembers");
  }
  if (capacity.plan === "free") return t("freeLimit");
  if (capacity.plan === "pro") return t("seatLimit", { count: capacity.seatCount });
  if (capacity.max !== null) return t("memberLimit", { count: capacity.max });
  return t("upgradeYourPlanToAddMoreMembers");
}
