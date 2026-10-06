/** Use authenticated headers for file responses, just like payroll JSON requests. */
export async function downloadPayrollCsv(organizationId: string) {
  const response = await fetch("/api/v1/payroll/reports/export", { headers: { "x-organization-id": organizationId } });
  if (!response.ok) { const body = await response.json(); throw new Error(body.error || "Payroll export failed"); }
  const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
  link.href = url; link.download = "payroll-export.csv"; link.click(); URL.revokeObjectURL(url);
}
export async function downloadTaxFormData(organizationId: string, id: string) {
  const response = await fetch(`/api/v1/payroll/tax-forms/${id}/pdf`, { headers: { "x-organization-id": organizationId } });
  if (!response.ok) { const body = await response.json(); throw new Error(body.error || "Unable to load form data"); }
  const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
  link.href = url; link.download = `tax-form-${id}.json`; link.click(); URL.revokeObjectURL(url);
}
