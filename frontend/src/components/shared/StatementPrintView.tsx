import type { StatementPdfProps } from "./StatementPdf";

const TYPE_LABELS: Record<string, string> = {
  Order: "\u0637\u0644\u0628",
  Payment_Cash: "\u062F\u0641\u0639 \u0646\u0642\u062F\u064A",
  Payment_Check: "\u0634\u064A\u0643",
  Check_Return: "\u0634\u064A\u0643 \u0645\u0631\u062A\u062C\u0639",
  Purchase: "\u0634\u0631\u0627\u0621",
  opening_balance: "\u0631\u0635\u064A\u062F \u0627\u0641\u062A\u062A\u0627\u062D\u064A",
};

const HAS_ITEMS = new Set(["Order", "Purchase"]);

const fmtNum = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function buildPrintHtml(props: StatementPdfProps): string {
  const { customerName, dateRange, openingBalance, entries, closingBalance, totals } = props;

  const rows = entries
    .map((entry, idx) => {
      const tx = entry.transaction;
      const sign = tx.amount >= 0 ? "+" : "";
      const bgColor = idx % 2 === 1 ? "#f5f5f5" : "transparent";
      const items = tx.data?.items;
      const showItems = HAS_ITEMS.has(tx.type);

      let mainRow = `<tr style="background:${bgColor}">
        <td style="padding:6px 8px">${fmtDate(tx.created_at)}</td>
        <td style="padding:6px 8px">${TYPE_LABELS[tx.type] ?? tx.type}</td>
        <td style="padding:6px 8px">${sign}${fmtNum(tx.amount)}</td>
        <td style="padding:6px 8px">${fmtNum(entry.running_balance)}</td>
      </tr>`;

      if (showItems) {
        if (items && items.length > 0) {
          mainRow += items
            .map(
              (item) =>
                `<tr style="background:${bgColor}"><td colspan="4" style="padding:2px 8px 2px 30px;font-size:11px;color:#888">${item.name} \u00B7 ${item.quantity} \u00D7 ${fmtNum(item.unit_price)} = ${fmtNum(item.total)}</td></tr>`
            )
            .join("");
        } else {
          mainRow += `<tr style="background:${bgColor}"><td colspan="4" style="padding:2px 8px 2px 30px;font-size:11px;color:#666;font-style:italic">\u0644\u0627 \u062A\u0641\u0627\u0635\u064A\u0644</td></tr>`;
        }
      }

      return mainRow;
    })
    .join("");

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>\u0643\u0634\u0641 \u062D\u0633\u0627\u0628 - ${customerName}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 24px; color: #222; background: #fff; }
  .header { text-align: center; margin-bottom: 20px; }
  .brand-ar { font-size: 22px; font-weight: 700; }
  .brand-en { font-size: 14px; color: #888; }
  .customer { font-size: 16px; font-weight: 600; margin-top: 8px; }
  .date-range { font-size: 12px; color: #888; margin-top: 4px; }
  .opening { display: flex; justify-content: space-between; background: #1a1a1a; color: #fff; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead { background: #1a1a1a; color: #fff; }
  th { padding: 8px; font-weight: 600; font-size: 13px; text-align: right; }
  td { font-size: 13px; border-bottom: 1px solid #ddd; }
  .summary { border: 1px solid #ddd; border-radius: 4px; padding: 12px; }
  .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
  .summary-label { color: #888; }
  .summary-value { font-weight: 600; }
  .closing-row { display: flex; justify-content: space-between; padding: 6px 0 0; margin-top: 6px; border-top: 1px solid #ddd; font-weight: 700; font-size: 14px; }
  @media print {
    body { padding: 12px; }
    nav, .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="brand-ar">\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642</div>
    <div class="brand-en">Alofok - Tools</div>
    <div class="customer">${customerName}</div>
    <div class="date-range">${dateRange.from} \u2014 ${dateRange.to}</div>
  </div>

  <div class="opening">
    <span>\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A</span>
    <span>${fmtNum(openingBalance)}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th>\u0627\u0644\u062A\u0627\u0631\u064A\u062E</th>
        <th>\u0627\u0644\u0646\u0648\u0639</th>
        <th>\u0627\u0644\u0645\u0628\u0644\u063A</th>
        <th>\u0627\u0644\u0631\u0635\u064A\u062F</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="summary">
    <div class="summary-row">
      <span class="summary-label">\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0637\u0644\u0628\u0627\u062A</span>
      <span class="summary-value">${fmtNum(totals.orders)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A</span>
      <span class="summary-value">${fmtNum(totals.payments)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A</span>
      <span class="summary-value">${fmtNum(totals.purchases)}</span>
    </div>
    <div class="closing-row">
      <span>\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u062E\u062A\u0627\u0645\u064A</span>
      <span>${fmtNum(closingBalance)}</span>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Generates the statement as an HTML file and downloads it.
 * The user can then open it in a browser and print to PDF (Ctrl+P → Save as PDF).
 * This approach avoids popup blockers and works reliably with Arabic RTL.
 */
export function handlePrintFallback(props: StatementPdfProps, filename: string): void {
  const html = buildPrintHtml(props);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/\.pdf$/, ".html");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
