import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Phone, MapPin, DollarSign, User } from "@/lib/icons";
import { customerApi } from "@/services/customerApi";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileView as SharedProfileView } from "@/components/shared/ProfileView";
import { useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";
import { formatCurrency } from "@/lib/format";

export function ProfileView() {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["customer-profile"],
    queryFn: customerApi.getProfile,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <SharedProfileView
      identitySlot={
        <CardContent className="p-5">
          {isLoading ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <Skeleton variant="circle" className="h-16 w-16" />
                <div className="flex-1 space-y-2">
                  <Skeleton variant="text" className="h-5 w-32" />
                  <Skeleton variant="text" className="h-4 w-24" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Avatar + Name */}
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.name}
                      className="h-full w-full rounded-2xl object-cover"
                    />
                  ) : (
                    <User className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-h3 font-bold text-foreground truncate">
                    {profile?.name ?? t("portal.customer")}
                  </p>
                  <Badge variant="default" dot className="mt-1">
                    {t("portal.portalRole")}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Detail rows */}
              <div className="space-y-3">
                {profile?.phone && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/15">
                      <Phone className="h-4 w-4 text-info" />
                    </div>
                    <div className="flex-1">
                      <p className="text-caption text-muted-foreground">
                        {t("customer.phone")}
                      </p>
                      <p className="text-body-sm font-medium text-foreground">
                        {profile.phone}
                      </p>
                    </div>
                  </div>
                )}

                {profile?.city && (
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15">
                      <MapPin className="h-4 w-4 text-violet-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-caption text-muted-foreground">
                        {t("customer.city")}
                      </p>
                      <p className="text-body-sm font-medium text-foreground">
                        {profile.city}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-caption text-muted-foreground">
                      {t("portal.currentBalance")}
                    </p>
                    <p className="text-body-sm font-bold text-foreground">
                      {formatCurrency(profile?.balance ?? 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      }
      onLogout={() => dispatch(logout())}
    />
  );
}
