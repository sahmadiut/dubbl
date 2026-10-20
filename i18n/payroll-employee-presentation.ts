import { payrollJson } from "@/lib/money/payroll-ui";

/** A create response is used only for navigation; validate its ID and any money supplied. */
export async function payrollEmployeeCreatedJson(response: Response): Promise<{ employee: { id: string } }> {
  if (!response.ok) throw new Error("Employee creation failed");
  const body = await payrollJson(response);
  if (!body || typeof body !== "object" || Array.isArray(body) ||
    !body.employee || typeof body.employee !== "object" || Array.isArray(body.employee) ||
    typeof body.employee.id !== "string" || !body.employee.id.trim()) {
    throw new Error("Invalid employee creation response");
  }
  return body;
}
