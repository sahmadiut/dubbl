import { ORGANIZATION_COOKIE } from "./locale";

// Mirror the existing browser selection for server locale resolution. The
// cookie never grants access: membership is checked before reading defaults.
export function setActiveOrganization(id: string | null) {
  if (id) localStorage.setItem("activeOrgId", id);
  else localStorage.removeItem("activeOrgId");
  document.cookie = `${ORGANIZATION_COOKIE}=${encodeURIComponent(id ?? "")}; Path=/; SameSite=Lax; Max-Age=${id ? 31536000 : 0}${location.protocol === "https:" ? "; Secure" : ""}`;
}

export function hasOrganizationCookie(id: string) {
  return document.cookie.split(";").some(part => part.trim() === `${ORGANIZATION_COOKIE}=${encodeURIComponent(id)}`);
}
