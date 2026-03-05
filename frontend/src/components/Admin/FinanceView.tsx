import { useTranslation } from "react-i18next";

import { PageContainer } from "@/components/layout/page-container";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AdminChecksView } from "./AdminChecksView";
import { DailyCashReportView } from "./DailyCashReportView";

export function FinanceView() {
  const { t, i18n } = useTranslation();

  return (
    <PageContainer>
      <div className="space-y-4" dir={i18n.language === "ar" ? "rtl" : "ltr"}>
        <h1 className="text-h2 font-bold text-foreground">{t("nav.finance")}</h1>

        <Tabs defaultValue="cashReport">
          <TabsList variant="segment" className="w-full">
            <TabsTrigger value="cashReport">{t("cash.title")}</TabsTrigger>
            <TabsTrigger value="checks">{t("nav.checks")}</TabsTrigger>
          </TabsList>

          <TabsContent value="cashReport">
            <DailyCashReportView />
          </TabsContent>

          <TabsContent value="checks">
            <AdminChecksView />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
