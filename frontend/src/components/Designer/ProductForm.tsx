import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ImagePlus, Loader2 } from "lucide-react";
import {
  designerApi,
  type Product,
  type ProductCreate,
} from "@/services/designerApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProductFormProps {
  product?: Product; // undefined = create mode
  onBack: () => void;
  onSaved: () => void;
}

export default function ProductForm({
  product,
  onBack,
  onSaved,
}: ProductFormProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const editing = !!product;

  const [nameAr, setNameAr] = useState(product?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(product?.name_en ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? "");
  const [isDiscounted, setIsDiscounted] = useState(
    product?.is_discounted ?? false
  );
  const [isBestseller, setIsBestseller] = useState(
    product?.is_bestseller ?? false
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      const payload: ProductCreate = {
        name_ar: nameAr,
        name_en: nameEn,
        sku,
        price: parseFloat(price),
        image_url: imageUrl || null,
        is_discounted: isDiscounted,
        is_bestseller: isBestseller,
      };
      if (editing) {
        return designerApi.updateProduct(product.id, payload);
      }
      return designerApi.createProduct(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      onSaved();
    },
    onError: () => setFormError(t("errors.generic")),
  });

  async function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const url = await designerApi.uploadImage(file);
      setImageUrl(url);
    } catch {
      setFormError(t("errors.generic"));
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <button
          onClick={onBack}
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-bold">
          {editing ? t("product.edit") : t("product.addNew")}
        </h2>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFormError(null);
          save.mutate();
        }}
        className="flex-1 overflow-y-auto flex flex-col gap-4 p-4"
      >
        {/* Image */}
        <div className="flex flex-col items-center gap-3">
          <div
            onClick={() => fileRef.current?.click()}
            className="relative w-full h-44 rounded-2xl border-2 border-dashed border-border bg-muted flex items-center justify-center cursor-pointer overflow-hidden"
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : uploadingImage ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <ImagePlus className="h-8 w-8" />
                <span className="text-sm">{t("product.uploadImage")}</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
        </div>

        {/* Fields */}
        <Field label={t("product.nameAr")}>
          <Input
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            required
            dir="rtl"
          />
        </Field>

        <Field label={t("product.nameEn")}>
          <Input
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            required
            dir="ltr"
          />
        </Field>

        <Field label={t("product.sku")}>
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            required
            dir="ltr"
          />
        </Field>

        <Field label={t("product.price")}>
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            dir="ltr"
          />
        </Field>

        {/* Toggles */}
        <div className="flex flex-col gap-3">
          <Toggle
            checked={isDiscounted}
            onChange={setIsDiscounted}
            label={t("product.isDiscounted")}
          />
          <Toggle
            checked={isBestseller}
            onChange={setIsBestseller}
            label={t("product.isBestseller")}
          />
        </div>

        {formError && (
          <p className="text-sm text-destructive text-center">{formError}</p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={save.isPending || uploadingImage}
        >
          {save.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("actions.save")
          )}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 cursor-pointer"
      onClick={() => onChange(!checked)}
    >
      <span className="text-sm font-medium">{label}</span>
      <div
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <div
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "start-[22px]" : "start-0.5"
          }`}
        />
      </div>
    </div>
  );
}
