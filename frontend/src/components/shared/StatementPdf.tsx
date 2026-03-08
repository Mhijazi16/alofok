import "@/lib/pdf-fonts";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from "@react-pdf/renderer";

export interface StatementPdfProps {
  customerName: string;
  dateRange: { from: string; to: string };
  openingBalance: number;
  entries: Array<{
    transaction: {
      type: string;
      amount: number;
      currency: string;
      created_at: string;
      data?: {
        items?: Array<{
          name: string;
          quantity: number;
          unit_price: number;
          total: number;
        }>;
      };
    };
    running_balance: number;
  }>;
  closingBalance: number;
  totals: { orders: number; payments: number; purchases: number };
}

const TYPE_LABELS: Record<string, string> = {
  Order: "\u0637\u0644\u0628",
  Payment_Cash: "\u062F\u0641\u0639 \u0646\u0642\u062F\u064A",
  Payment_Check: "\u0634\u064A\u0643",
  Check_Return: "\u0634\u064A\u0643 \u0645\u0631\u062A\u062C\u0639",
  Purchase: "\u0634\u0631\u0627\u0621",
  opening_balance: "\u0631\u0635\u064A\u062F \u0627\u0641\u062A\u062A\u0627\u062D\u064A",
};

const fmtNum = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const HAS_ITEMS = new Set(["Order", "Purchase"]);

const s = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Cairo",
    fontSize: 9,
  },
  // Header
  headerSection: {
    marginBottom: 16,
    alignItems: "flex-end",
  },
  brandAr: {
    fontSize: 18,
    fontWeight: 700,
  },
  brandEn: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    fontWeight: 600,
    marginTop: 8,
  },
  dateRange: {
    fontSize: 10,
    color: "#888",
    marginTop: 2,
  },
  openingRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 4,
  },
  openingLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "#fff",
  },
  openingValue: {
    fontSize: 10,
    fontWeight: 700,
    color: "#fff",
  },
  // Table
  tableHeader: {
    flexDirection: "row-reverse",
    backgroundColor: "#1a1a1a",
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginTop: 12,
    borderRadius: 4,
  },
  thText: {
    color: "#fff",
    fontWeight: 600,
    fontSize: 9,
  },
  colDate: { width: "22%" },
  colType: { width: "22%" },
  colAmount: { width: "28%", textAlign: "left" },
  colBalance: { width: "28%", textAlign: "left" },
  row: {
    flexDirection: "row-reverse",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
  },
  rowAlt: {
    backgroundColor: "#f5f5f5",
  },
  cellText: {
    fontSize: 9,
    color: "#222",
  },
  // Sub-rows
  subRow: {
    flexDirection: "row-reverse",
    paddingVertical: 2,
    paddingHorizontal: 6,
    paddingRight: 30,
  },
  subText: {
    fontSize: 8,
    color: "#888",
  },
  noItems: {
    fontSize: 8,
    color: "#666",
    fontStyle: "italic",
    paddingHorizontal: 6,
    paddingRight: 30,
    paddingVertical: 2,
  },
  // Summary
  summaryBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 4,
    padding: 12,
  },
  summaryRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  summaryLabel: {
    fontSize: 10,
    color: "#888",
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 600,
  },
  closingRow: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  closingLabel: {
    fontSize: 11,
    fontWeight: 700,
  },
  closingValue: {
    fontSize: 11,
    fontWeight: 700,
  },
});

export function StatementPdf({
  customerName,
  dateRange,
  openingBalance,
  entries,
  closingBalance,
  totals,
}: StatementPdfProps) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headerSection}>
          <Text style={s.brandAr}>{"\u0634\u0631\u0643\u0629 \u0627\u0644\u0623\u0641\u0642"}</Text>
          <Text style={s.brandEn}>Alofok - Tools</Text>
          <Text style={s.customerName}>{customerName}</Text>
          <Text style={s.dateRange}>
            {dateRange.from} {"\u2014"} {dateRange.to}
          </Text>
        </View>

        {/* Opening Balance */}
        <View style={s.openingRow}>
          <Text style={s.openingLabel}>{"\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0627\u0641\u062A\u062A\u0627\u062D\u064A"}</Text>
          <Text style={s.openingValue}>{fmtNum(openingBalance)}</Text>
        </View>

        {/* Table Header */}
        <View style={s.tableHeader}>
          <View style={s.colDate}>
            <Text style={s.thText}>{"\u0627\u0644\u062A\u0627\u0631\u064A\u062E"}</Text>
          </View>
          <View style={s.colType}>
            <Text style={s.thText}>{"\u0627\u0644\u0646\u0648\u0639"}</Text>
          </View>
          <View style={s.colAmount}>
            <Text style={s.thText}>{"\u0627\u0644\u0645\u0628\u0644\u063A"}</Text>
          </View>
          <View style={s.colBalance}>
            <Text style={s.thText}>{"\u0627\u0644\u0631\u0635\u064A\u062F"}</Text>
          </View>
        </View>

        {/* Table Body */}
        {entries.map((entry, idx) => {
          const tx = entry.transaction;
          const sign = tx.amount >= 0 ? "+" : "";
          const items = tx.data?.items;
          const showItems = HAS_ITEMS.has(tx.type);

          return (
            <View key={idx}>
              {/* Main row */}
              <View style={[s.row, idx % 2 === 1 ? s.rowAlt : {}]}>
                <View style={s.colDate}>
                  <Text style={s.cellText}>{fmtDate(tx.created_at)}</Text>
                </View>
                <View style={s.colType}>
                  <Text style={s.cellText}>
                    {TYPE_LABELS[tx.type] ?? tx.type}
                  </Text>
                </View>
                <View style={s.colAmount}>
                  <Text style={s.cellText}>
                    {sign}
                    {fmtNum(tx.amount)}
                  </Text>
                </View>
                <View style={s.colBalance}>
                  <Text style={s.cellText}>
                    {fmtNum(entry.running_balance)}
                  </Text>
                </View>
              </View>

              {/* Sub-rows for Order / Purchase items */}
              {showItems &&
                (items && items.length > 0 ? (
                  items.map((item, iIdx) => (
                    <View key={iIdx} style={s.subRow}>
                      <Text style={s.subText}>
                        {item.name} {"\u00B7"} {item.quantity} {"\u00D7"} {fmtNum(item.unit_price)} = {fmtNum(item.total)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={s.noItems}>
                    {"\u0644\u0627 \u062A\u0641\u0627\u0635\u064A\u0644"}
                  </Text>
                ))}
            </View>
          );
        })}

        {/* Closing Summary */}
        <View style={s.summaryBox}>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>
              {"\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0637\u0644\u0628\u0627\u062A"}
            </Text>
            <Text style={s.summaryValue}>{fmtNum(totals.orders)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>
              {"\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u062F\u0641\u0648\u0639\u0627\u062A"}
            </Text>
            <Text style={s.summaryValue}>{fmtNum(totals.payments)}</Text>
          </View>
          <View style={s.summaryRow}>
            <Text style={s.summaryLabel}>
              {"\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0645\u0634\u062A\u0631\u064A\u0627\u062A"}
            </Text>
            <Text style={s.summaryValue}>{fmtNum(totals.purchases)}</Text>
          </View>
          <View style={s.closingRow}>
            <Text style={s.closingLabel}>
              {"\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u062E\u062A\u0627\u0645\u064A"}
            </Text>
            <Text style={s.closingValue}>{fmtNum(closingBalance)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
