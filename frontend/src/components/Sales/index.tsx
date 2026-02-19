import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin, Grid3X3 } from "lucide-react";
import { type Customer } from "@/services/salesApi";
import RouteView from "./RouteView";
import CustomerDashboard from "./CustomerDashboard";
import OrderFlow from "./OrderFlow";
import PaymentFlow from "./PaymentFlow";
import StatementView from "./StatementView";

type Tab = "route" | "catalog";
type Screen =
  | { name: "route" }
  | { name: "dashboard"; customer: Customer }
  | { name: "order"; customer: Customer }
  | { name: "payment"; customer: Customer }
  | { name: "statement"; customer: Customer };

export default function SalesRoot() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("route");
  const [screen, setScreen] = useState<Screen>({ name: "route" });

  function goBack() {
    if (screen.name === "order" || screen.name === "payment" || screen.name === "statement") {
      setScreen({ name: "dashboard", customer: screen.customer });
    } else {
      setScreen({ name: "route" });
    }
  }

  const isFullScreen =
    screen.name === "order" ||
    screen.name === "payment" ||
    screen.name === "statement";

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Page header (hidden when a full-screen flow is open) */}
      {!isFullScreen && screen.name !== "dashboard" && (
        <header className="flex items-center justify-between px-5 pt-safe pt-4 pb-3 border-b border-border bg-card">
          <h1 className="text-lg font-black text-primary">{t("app.name")}</h1>
        </header>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {screen.name === "route" && (
          <RouteView
            onSelectCustomer={(c) =>
              setScreen({ name: "dashboard", customer: c })
            }
          />
        )}

        {screen.name === "dashboard" && (
          <CustomerDashboard
            customer={screen.customer}
            onBack={() => setScreen({ name: "route" })}
            onAction={(action) => {
              if (action === "order")
                setScreen({ name: "order", customer: screen.customer });
              else if (action === "pay")
                setScreen({ name: "payment", customer: screen.customer });
              else if (action === "statement")
                setScreen({ name: "statement", customer: screen.customer });
              else if (action === "returnedCheck")
                setScreen({ name: "statement", customer: screen.customer });
            }}
          />
        )}

        {screen.name === "order" && (
          <OrderFlow
            customer={screen.customer}
            onBack={goBack}
            onDone={() => setScreen({ name: "dashboard", customer: screen.customer })}
          />
        )}

        {screen.name === "payment" && (
          <PaymentFlow
            customer={screen.customer}
            onBack={goBack}
            onDone={() => setScreen({ name: "dashboard", customer: screen.customer })}
          />
        )}

        {screen.name === "statement" && (
          <StatementView customer={screen.customer} onBack={goBack} />
        )}
      </main>

      {/* Bottom nav (hidden during full-screen flows) */}
      {!isFullScreen && (
        <nav className="pb-safe flex border-t border-border bg-card">
          {(
            [
              { key: "route" as Tab, label: t("nav.route"), Icon: MapPin },
              { key: "catalog" as Tab, label: t("nav.catalog"), Icon: Grid3X3 },
            ] as { key: Tab; label: string; Icon: React.FC<{ className?: string }> }[]
          ).map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setScreen({ name: "route" });
              }}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                tab === key
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <Icon
                className={`h-5 w-5 ${tab === key ? "text-primary" : "text-muted-foreground"}`}
              />
              {label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
