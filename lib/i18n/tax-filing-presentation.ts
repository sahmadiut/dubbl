/** Live report labels only; statutory IDs and CSV/wire labels stay canonical. */
export function basFieldLabelKey(field: string) {
  switch (field) {
    case "G1": return "totalSales";
    case "G2": return "exportSales";
    case "G3": return "gstFreeSales";
    case "G10": return "capitalPurchases";
    case "G11": return "nonCapitalPurchases";
    case "1A": return "gstSales";
    case "1B": return "gstPurchases";
    case "NET": return "netGst";
    default: return null;
  }
}

export function scheduleCLineLabelKey(line: string) {
  switch (line) {
    case "1": return "grossReceipts";
    case "2": return "returnsAllowances";
    case "8": return "advertising";
    case "9": return "carTruck";
    case "10": return "commissions";
    case "13": return "depreciation";
    case "15": return "insurance";
    case "16a": return "mortgageInterest";
    case "16b": return "otherInterest";
    case "17": return "legalProfessional";
    case "18": return "officeExpense";
    case "20a": return "vehicleRent";
    case "20b": return "propertyRent";
    case "21": return "repairs";
    case "22": return "supplies";
    case "23": return "taxesLicenses";
    case "24a": return "travel";
    case "24b": return "meals";
    case "25": return "utilities";
    case "26": return "wages";
    case "27": return "otherExpenses";
    default: return null;
  }
}
