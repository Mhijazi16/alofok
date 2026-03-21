import { CardContent } from "@/components/ui/card";
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Badge } from "@/components/ui/badge";
import { ProfileView } from "@/components/shared/ProfileView";
import { SyncStatusCard } from "@/components/shared/SyncStatusCard";
import { useAppDispatch } from "@/store";
import { logout } from "@/store/authSlice";

interface SalesProfileViewProps {
  userId: string | null;
  username: string | null;
  role: string | null;
  avatarSeed: string;
  onAvatarChange: (seed: string) => void;
}

export function SalesProfileView({
  userId,
  username,
  role,
  avatarSeed,
  onAvatarChange,
}: SalesProfileViewProps) {
  const dispatch = useAppDispatch();

  return (
    <ProfileView
      identitySlot={
        <CardContent className="flex items-center gap-4 p-5">
          <AvatarPicker
            currentSeed={avatarSeed}
            onSelect={onAvatarChange}
          />
          <div className="min-w-0 flex-1">
            <p className="text-h3 font-bold text-foreground truncate">
              {username ?? userId ?? "Sales"}
            </p>
            <Badge variant="default" dot className="mt-1">
              {role ?? "Sales"}
            </Badge>
          </div>
        </CardContent>
      }
      extraSlot={<SyncStatusCard />}
      onLogout={() => dispatch(logout())}
    />
  );
}
