import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { salesApi, type Customer } from "@/services/salesApi";
import type { SalesRep, AdminCustomerCreate } from "@/services/adminApi";
import { useToast } from "@/hooks/useToast";
import { TopBar } from "@/components/ui/top-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";

const PALESTINIAN_CITIES = [
  { ar: "الخليل", en: "Hebron" },
  { ar: "رام الله والبيرة", en: "Ramallah & Al-Bireh" },
  { ar: "نابلس", en: "Nablus" },
  { ar: "بيت لحم", en: "Bethlehem" },
  { ar: "القدس", en: "Jerusalem" },
  { ar: "أريحا", en: "Jericho" },
  { ar: "جنين", en: "Jenin" },
  { ar: "طولكرم", en: "Tulkarm" },
  { ar: "قلقيلية", en: "Qalqilya" },
  { ar: "سلفيت", en: "Salfit" },
  { ar: "طوباس", en: "Tubas" },
  { ar: "غزة", en: "Gaza" },
  { ar: "خان يونس", en: "Khan Yunis" },
  { ar: "رفح", en: "Rafah" },
  { ar: "دير البلح", en: "Deir al-Balah" },
  { ar: "شمال غزة", en: "North Gaza" },
];
import { AvatarPicker } from "@/components/ui/avatar-picker";
import { Button } from "@/components/ui/button";

const VISIT_DAYS = [
  { value: "Sun", ar: "الأحد", en: "Sunday" },
  { value: "Mon", ar: "الاثنين", en: "Monday" },
  { value: "Tue", ar: "الثلاثاء", en: "Tuesday" },
  { value: "Wed", ar: "الأربعاء", en: "Wednesday" },
  { value: "Thu", ar: "الخميس", en: "Thursday" },
  { value: "Fri", ar: "الجمعة", en: "Friday" },
  { value: "Sat", ar: "السبت", en: "Saturday" },
];

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

function LocationPicker({
  position,
  onChange,
}: {
  position: [number, number] | null;
  onChange: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return position ? <Marker position={position} /> : null;
}

interface CustomerFormProps {
  customer?: Customer;
  onDone: () => void;
  onBack: () => void;
  salesReps?: SalesRep[];
  createFn?: (body: AdminCustomerCreate) => Promise<Customer>;
}

export function CustomerForm({ customer, onDone, onBack, salesReps, createFn }: CustomerFormProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEdit = !!customer;

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [avatarSeed, setAvatarSeed] = useState(
    customer?.avatar_url?.startsWith("dicebear:")
      ? customer.avatar_url.slice(9)
      : customer?.name ?? ""
  );
  const [position, setPosition] = useState<[number, number] | null>(
    customer?.latitude != null && customer?.longitude != null
      ? [customer.latitude, customer.longitude]
      : null
  );
  const [assignedDay, setAssignedDay] = useState(customer?.assigned_day ?? "");
  const [portalEnabled, setPortalEnabled] = useState(false);
  const [portalPassword, setPortalPassword] = useState("");
  const [selectedRepId, setSelectedRepId] = useState<string>(customer?.assigned_to ?? "");

  const createMutation = useMutation({
    mutationFn: salesApi.createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-route"] });
      toast({ title: t("customer.savedSuccess"), variant: "success" });
      onDone();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof salesApi.updateCustomer>[1]) =>
      salesApi.updateCustomer(customer!.id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-route"] });
      toast({ title: t("customer.savedSuccess"), variant: "success" });
      onDone();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending;

  const isValid = name.trim().length > 0 && (isEdit || assignedDay.length > 0) && (!salesReps || selectedRepId !== "");

  const handleSubmit = async () => {
    if (!isValid || isPending) return;

    // Ensure avatar_url is always set (fallback to name if seed is empty)
    const finalAvatarSeed = avatarSeed.trim() || name.trim() || "default";

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      city: city.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      latitude: position?.[0] ?? null,
      longitude: position?.[1] ?? null,
      avatar_url: `dicebear:${finalAvatarSeed}`,
    };

    if (createFn && salesReps) {
      try {
        await createFn({
          ...payload,
          assigned_day: assignedDay,
          assigned_to: selectedRepId,
        });
        toast({ title: t("customer.savedSuccess"), variant: "success" });
        onDone();
      } catch {
        toast({ title: t("toast.error"), variant: "error" });
      }
    } else if (isEdit) {
      updateMutation.mutate({ ...payload, ...(assignedDay ? { assigned_day: assignedDay } : {}) });
    } else {
      createMutation.mutate({
        ...payload,
        assigned_day: assignedDay,
        portal_password: portalEnabled && portalPassword.trim() ? portalPassword.trim() : null,
      });
    }
  };

  return (
    <div className="animate-fade-in">
      <TopBar
        title={isEdit ? t("customer.editCustomer") : t("customer.addNew")}
        backButton={{ onBack }}
      />

      <div className="space-y-5 p-4">
        {/* Avatar Picker */}
        <div className="flex justify-center">
          <AvatarPicker currentSeed={avatarSeed} onSelect={setAvatarSeed} />
        </div>

        {/* Sales Rep Picker (admin only) */}
        {salesReps && salesReps.length > 0 && (
          <FormField label={t("customer.assignedRep") || "Assigned Rep"}>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
              {salesReps.map((rep) => (
                <button
                  key={rep.id}
                  onClick={() => setSelectedRepId(rep.id)}
                  className={`flex flex-col items-center gap-2 flex-shrink-0 p-2 rounded-lg transition-all ${
                    selectedRepId === rep.id
                      ? "border-2 border-primary ring-2 ring-primary/30 bg-primary/5"
                      : "border border-border/50 hover:border-border"
                  }`}
                >
                  <Avatar name={rep.username} size="sm" />
                  <span className="text-caption text-foreground font-medium text-center max-w-12 truncate">
                    {rep.username}
                  </span>
                </button>
              ))}
            </div>
          </FormField>
        )}

        {/* Name */}
        <FormField label={t("customer.customerDetails")} required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("customer.customerDetails")}
          />
        </FormField>

        {/* Phone */}
        <FormField label={t("customer.phone")}>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder={t("customer.phone")}
          />
        </FormField>

        {/* City */}
        <FormField label={t("customer.city")}>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger>
              <SelectValue placeholder={t("customer.city")} />
            </SelectTrigger>
            <SelectContent>
              {PALESTINIAN_CITIES.map((c) => (
                <SelectItem key={c.ar} value={c.ar}>{i18n.language === "ar" ? c.ar : `${c.en} — ${c.ar}`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {/* Visit Day */}
        <FormField label={t("customer.assignedDay")} required={!isEdit}>
          <Select value={assignedDay} onValueChange={setAssignedDay}>
            <SelectTrigger>
              <SelectValue placeholder={t("customer.assignedDay")} />
            </SelectTrigger>
            <SelectContent>
              {VISIT_DAYS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {i18n.language === "ar" ? d.ar : d.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {/* Address */}
        <FormField label={t("customer.address")}>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={t("customer.address")}
          />
        </FormField>

        {/* Notes */}
        <FormField label={t("customer.notes")}>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("customer.notes")}
            autoResize
          />
        </FormField>

        {/* Portal Account (create only) */}
        {!isEdit && (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-4">
              <div>
                <p className="text-body-sm font-medium text-foreground">
                  {t("portal.activateAccount")}
                </p>
                <p className="text-caption text-muted-foreground">
                  {t("portal.activateAccountDesc")}
                </p>
              </div>
              <Switch checked={portalEnabled} onCheckedChange={setPortalEnabled} />
            </div>
            {portalEnabled && (
              <FormField label={t("portal.portalPassword")}>
                <Input
                  type="password"
                  value={portalPassword}
                  onChange={(e) => setPortalPassword(e.target.value)}
                  placeholder={t("portal.portalPassword")}
                />
              </FormField>
            )}
          </div>
        )}

        {/* Map Picker */}
        <FormField label={t("customer.location")}>
          <MapContainer
            center={position ?? [31.9, 35.2]}
            zoom={10}
            className="h-48 w-full rounded-xl overflow-hidden border border-border"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationPicker
              position={position}
              onChange={(lat, lng) => setPosition([lat, lng])}
            />
          </MapContainer>
          <p className="mt-1 text-caption text-muted-foreground">
            {position
              ? t("customer.locationSet")
              : t("customer.tapToSetLocation")}
          </p>
        </FormField>

        {/* Submit */}
        <Button
          variant="gradient"
          size="xl"
          className="w-full"
          disabled={!isValid || isPending}
          onClick={handleSubmit}
        >
          {t("actions.save")}
        </Button>
      </div>
    </div>
  );
}
