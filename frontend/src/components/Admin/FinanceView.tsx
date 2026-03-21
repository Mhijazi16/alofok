import { useTranslation } from "react-i18next";

import { PageContainer } from "@/components/layout/page-container";
import { TopBar } from "@/components/ui/top-bar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminChecksView } from "./AdminChecksView";
import { DailyCashReportView } from "./DailyCashReportView";

interface FinanceViewProps {
  onSelectionChange?: (selecting: boolean) => void;
}

export function FinanceView({ onSelectionChange }: FinanceViewProps) {
  const { t, i18n } = useTranslation();

  return (
    <>
      <TopBar title={t("nav.finance")} />
      <PageContainer>
      <div className="space-y-4" dir={i18n.language === "ar" ? "rtl" : "ltr"}>

        <Tabs defaultValue="cashReport">
          <TabsList variant="segment" className="w-full">
            <TabsTrigger value="cashReport">{t("cash.title")}</TabsTrigger>
            <TabsTrigger value="checks">{t("nav.checks")}</TabsTrigger>
          </TabsList>

          <TabsContent value="cashReport">
            <DailyCashReportView onSelectionChange={onSelectionChange} />
          </TabsContent>

          <TabsContent value="checks">
            <AdminChecksView />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
    </>
  );
}
