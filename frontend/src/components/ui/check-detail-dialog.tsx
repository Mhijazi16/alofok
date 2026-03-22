import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Banknote, RotateCcw, X } from "@/lib/icons";
import { getImageUrl } from "@/lib/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckPreview } from "@/components/Sales/CheckPreview";
import type { CheckOut } from "@/services/adminApi";

interface CheckDetailNavigation {
  onPrev?: () => void;
  onNext?: () => void;
  current: number;
  total: number;
}

interface CheckDetailDialogProps {
  check: CheckOut | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeposit?: (id: string) => void;
  onUndeposit?: (id: string) => void;
  onReturn?: (id: string) => void;
  navigation?: CheckDetailNavigation;
}

const statusVariant = (status: string | null) => {
  if (status === "Pending") return "warning" as const;
  if (status === "Deposited") return "success" as const;
  if (status === "Returned") return "destructive" as const;
  return "outline" as const;
};

export function CheckDetailDialog({
  check,
  open,
  onOpenChange,
  onDeposit,
  onUndeposit,
  onReturn,
  navigation,
}: CheckDetailDialogProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === "ar";
  const [zoomed, setZoomed] = useState(false);
  const [photoZoomed, setPhotoZoomed] = useState(false);

  if (!check) return null;

  const data = check.data;
  const PrevIcon = isRTL ? ChevronRight : ChevronLeft;
  const NextIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{check.customer_name}</DialogTitle>
            <Badge variant={statusVariant(check.status)} size="sm">
              {check.status
                ? t(`checks.status.${check.status}`, check.status)
                : "—"}
            </Badge>
          </div>
        </DialogHeader>

        {/* SVG Check Preview — click to zoom */}
        <div
          className="rounded-lg border border-border/50 overflow-hidden cursor-zoom-in"
          onClick={() => setZoomed(true)}
        >
          <CheckPreview
            amount={Math.abs(check.amount).toString()}
            currency={(check.currency as "ILS" | "USD" | "JOD") ?? "ILS"}
            bankName={data?.bank ?? ""}
            bankNumber={data?.bank_number ?? ""}
            branchNumber={data?.branch_number ?? ""}
            accountNumber={data?.account_number ?? ""}
            holderName={data?.holder_name ?? ""}
            dueDate={data?.due_date ?? ""}
          />
        </div>

        {/* Fullscreen zoom overlay */}
        {zoomed && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
            onClick={() => setZoomed(false)}
          >
            <button
              className="absolute top-4 end-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              onClick={() => setZoomed(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="w-[95vw] max-w-3xl">
              <CheckPreview
                amount={Math.abs(check.amount).toString()}
                currency={(check.currency as "ILS" | "USD" | "JOD") ?? "ILS"}
                bankName={data?.bank ?? ""}
                bankNumber={data?.bank_number ?? ""}
                branchNumber={data?.branch_number ?? ""}
                accountNumber={data?.account_number ?? ""}
                holderName={data?.holder_name ?? ""}
                dueDate={data?.due_date ?? ""}
              />
            </div>
          </div>
        )}

        {/* Check Photo */}
        {data?.image_url && getImageUrl(data.image_url) && (
          <div className="space-y-1.5">
            <p className="text-caption text-muted-foreground font-medium">
              {t("checkDetail.photo")}
            </p>
            <div
              className="rounded-lg border border-border/50 overflow-hidden cursor-zoom-in"
              onClick={() => setPhotoZoomed(true)}
            >
              <img
                src={getImageUrl(data.image_url)!}
                alt={t("checkDetail.photo")}
                className="w-full h-auto object-contain max-h-48"
              />
            </div>
          </div>
        )}

        {/* Check Photo Zoom Overlay */}
        {photoZoomed && data?.image_url && getImageUrl(data.image_url) && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-zoom-out"
            onClick={() => setPhotoZoomed(false)}
          >
            <button
              className="absolute top-4 end-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              onClick={() => setPhotoZoomed(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={getImageUrl(data.image_url)!}
              alt={t("checkDetail.photo")}
              className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
            />
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3 text-body-sm">
          <div>
            <p className="text-caption text-muted-foreground">{t("checkDetail.amount")}</p>
            <p className="font-semibold text-foreground">
              {Math.abs(check.amount).toFixed(2)} {check.currency}
            </p>
          </div>
          {data?.bank && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.bank")}</p>
              <p className="font-medium text-foreground">{data.bank}</p>
            </div>
          )}
          {data?.branch_number && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.branch")}</p>
              <p className="font-medium text-foreground">{data.branch_number}</p>
            </div>
          )}
          {data?.account_number && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.account")}</p>
              <p className="font-medium text-foreground">{data.account_number}</p>
            </div>
          )}
          {data?.holder_name && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.holder")}</p>
              <p className="font-medium text-foreground">{data.holder_name}</p>
            </div>
          )}
          {data?.due_date && (
            <div>
              <p className="text-caption text-muted-foreground">{t("checkDetail.dueDate")}</p>
              <p className="font-medium text-foreground">{data.due_date}</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        {navigation && navigation.total > 1 && (
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={navigation.onPrev}
              disabled={!navigation.onPrev}
            >
              <PrevIcon className="h-4 w-4" />
            </Button>
            <span className="text-caption text-muted-foreground">
              {navigation.current} {t("checkDetail.of")} {navigation.total}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={navigation.onNext}
              disabled={!navigation.onNext}
            >
              <NextIcon className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Action buttons */}
        {(onDeposit || onUndeposit || onReturn) && (
          <div className="flex items-center gap-2 pt-2">
            {onDeposit && check.status === "Pending" && (
              <Button className="flex-1" onClick={() => onDeposit(check.id)}>
                <Banknote className="h-4 w-4" />
                {t("checks.deposit")}
              </Button>
            )}
            {onUndeposit && check.status === "Deposited" && (
              <Button variant="outline" className="flex-1" onClick={() => onUndeposit(check.id)}>
                <RotateCcw className="h-4 w-4" />
                {t("checks.undeposit")}
              </Button>
            )}
            {onReturn &&
              (check.status === "Pending" || check.status === "Deposited") && (
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => onReturn(check.id)}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("checks.return")}
                </Button>
              )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
