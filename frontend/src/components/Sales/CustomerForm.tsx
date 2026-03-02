import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { salesApi, type Customer } from "@/services/salesApi";
import { useToast } from "@/hooks/useToast";
import { TopBar } from "@/components/ui/top-bar";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";

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
}

export function CustomerForm({ customer, onDone, onBack }: CustomerFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEdit = !!customer;

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [city, setCity] = useState(customer?.city ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [position, setPosition] = useState<[number, number] | null>(
    customer?.latitude != null && customer?.longitude != null
      ? [customer.latitude, customer.longitude]
      : null
  );

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

  const uploadMutation = useMutation({
    mutationFn: salesApi.uploadAvatar,
  });

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadMutation.isPending;

  const isValid = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || isPending) return;

    let avatarUrl: string | undefined;

    if (avatarFile) {
      try {
        const result = await uploadMutation.mutateAsync(avatarFile);
        avatarUrl = result.url;
      } catch {
        toast({ title: t("toast.error"), variant: "error" });
        return;
      }
    }

    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      city: city.trim(),
      address: address.trim() || null,
      notes: notes.trim() || null,
      latitude: position?.[0] ?? null,
      longitude: position?.[1] ?? null,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate({
        ...payload,
        assigned_day: new Date()
          .toLocaleDateString("en-US", { weekday: "long" })
          .toLowerCase(),
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
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder={t("customer.city")}
          />
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

        {/* Avatar Upload */}
        <FormField label={t("customer.avatar")}>
          <FileUpload
            accept="image/*"
            maxSize={5 * 1024 * 1024}
            onUpload={(file) => setAvatarFile(file)}
            isUploading={uploadMutation.isPending}
          />
        </FormField>

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
