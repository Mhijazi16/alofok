import { useTranslation } from "react-i18next";
import { Landmark, CalendarDays, Hash, Plus, Trash2, User } from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { Separator } from "@/components/ui/separator";
import { BankAutocomplete } from "@/components/ui/bank-autocomplete";
import { CheckCapture } from "../../CheckCapture";
import { cn } from "@/lib/utils";
import { bankDetailsValid, type ChequeBankDetails, type ChequeRow } from "../types";

interface NormalChequesStepProps {
  rows: ChequeRow[];
  /** Details from the shared step — the default for every cheque. */
  shared: ChequeBankDetails;
  userId: string;
  onUpdateRow: (id: string, patch: Partial<ChequeRow>) => void;
  onAddRow: () => void;
  onRemoveRow: (id: string) => void;
  onRowCapture: (id: string, blob: Blob, previewUrl: string) => void;
  onRowRemovePhoto: (id: string) => void;
}

export function NormalChequesStep({
  rows,
  shared,
  userId,
  onUpdateRow,
  onAddRow,
  onRemoveRow,
  onRowCapture,
  onRowRemovePhoto,
}: NormalChequesStepProps) {
  const { t } = useTranslation();

  /** Toggling on seeds the override from the shared details so the rep only
   *  edits what actually differs; toggling off falls back to shared. */
  function toggleOverride(row: ChequeRow, on: boolean) {
    onUpdateRow(row.id, { override: on ? { ...shared } : null });
  }

  function patchOverride(row: ChequeRow, patch: Partial<ChequeBankDetails>) {
    if (!row.override) return;
    onUpdateRow(row.id, { override: { ...row.override, ...patch } });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row, idx) => {
          const rowOk =
            row.checkNumber.trim().length > 0 &&
            (parseFloat(row.amount) || 0) > 0 &&
            (!row.override || bankDetailsValid(row.override));
          return (
            <Card key={row.id} variant="glass" className="space-y-3 p-3">
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-body-sm font-bold",
                    rowOk ? "text-success" : "text-muted-foreground"
                  )}
                >
                  {t("payment.batch.chequeNumber", { n: idx + 1 })}
                </span>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-7 w-7 border-destructive/50 text-destructive hover:bg-destructive/10"
                    onClick={() => onRemoveRow(row.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <FormField label={t("payment.checkNumber")} required>
                <Input
                  value={row.checkNumber}
                  onChange={(e) => onUpdateRow(row.id, { checkNumber: e.target.value })}
                  placeholder={t("payment.checkNumber")}
                  inputMode="numeric"
                  dir="ltr"
                  startIcon={<Hash className="h-4 w-4" />}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-2">
                <FormField label={t("payment.amount")} required>
                  <Input
                    type="number"
                    inputMode="decimal"
                    dir="ltr"
                    value={row.amount}
                    onChange={(e) => onUpdateRow(row.id, { amount: e.target.value })}
                    placeholder="0.00"
                    min={0}
                    step="0.01"
                  />
                </FormField>
                <FormField label={t("payment.dueDate")}>
                  <Input
                    type="date"
                    value={row.dueDate}
                    onChange={(e) => onUpdateRow(row.id, { dueDate: e.target.value })}
                    startIcon={<CalendarDays className="h-4 w-4" />}
                  />
                </FormField>
              </div>

              {/* Cheques from the same customer can be drawn on different banks
                  or accounts — let this one break away from the shared details. */}
              <div className="rounded-lg border border-border/60 bg-background-subtle/50 p-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-foreground">
                      {t("payment.normal.differentBank")}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {row.override
                        ? t("payment.normal.differentBankOn")
                        : t("payment.normal.differentBankOff")}
                    </p>
                  </div>
                  <Switch
                    checked={row.override !== null}
                    onCheckedChange={(on) => toggleOverride(row, on)}
                  />
                </div>

                {row.override && (
                  <div className="mt-3 space-y-3">
                    <Separator />
                    <FormField label={t("payment.bank")}>
                      <BankAutocomplete
                        value={row.override.bank}
                        onChange={(v) => patchOverride(row, { bank: v })}
                        userId={userId}
                        placeholder={t("payment.bank")}
                      />
                    </FormField>
                    <FormField label={t("payment.bankNumber")} required>
                      <Input
                        value={row.override.bankNumber}
                        onChange={(e) => patchOverride(row, { bankNumber: e.target.value })}
                        placeholder={t("payment.bankNumber")}
                        inputMode="numeric"
                        dir="ltr"
                        startIcon={<Landmark className="h-4 w-4" />}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-2">
                      <FormField label={t("payment.branchNumber")} required>
                        <Input
                          value={row.override.branchNumber}
                          onChange={(e) => patchOverride(row, { branchNumber: e.target.value })}
                          placeholder={t("payment.branchNumber")}
                          inputMode="numeric"
                          dir="ltr"
                        />
                      </FormField>
                      <FormField label={t("payment.accountNumber")} required>
                        <Input
                          value={row.override.accountNumber}
                          onChange={(e) => patchOverride(row, { accountNumber: e.target.value })}
                          placeholder={t("payment.accountNumber")}
                          inputMode="numeric"
                          dir="ltr"
                        />
                      </FormField>
                    </div>
                    <FormField label={t("payment.holderName")}>
                      <Input
                        value={row.override.holderName}
                        onChange={(e) => patchOverride(row, { holderName: e.target.value })}
                        placeholder={t("payment.holderName")}
                        startIcon={<User className="h-4 w-4" />}
                      />
                    </FormField>
                  </div>
                )}
              </div>

              <CheckCapture
                imageBlob={row.imageBlob}
                imagePreviewUrl={row.imagePreviewUrl}
                onCapture={(blob, url) => onRowCapture(row.id, blob, url)}
                onRemove={() => onRowRemovePhoto(row.id)}
              />
            </Card>
          );
        })}
      </div>

      <Button type="button" variant="outline" className="w-full" onClick={onAddRow}>
        <Plus className="h-4 w-4 me-1.5" />
        {t("payment.batch.addCheque")}
      </Button>
    </div>
  );
}
