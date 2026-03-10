import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X, GripVertical } from "lucide-react";

import {
  designerApi,
  type Product,
  type ProductCreate,
  type ProductUpdate,
  type ProductOptionInput,
} from "@/services/designerApi";
import { getImageUrl } from "@/lib/image";
import { useToast } from "@/hooks/useToast";
import { PageContainer } from "@/components/layout/page-container";
import { TopBar } from "@/components/ui/top-bar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

const UNIT_OPTIONS = ["piece", "box", "carton", "kg", "liter"] as const;
const MAX_IMAGES = 5;

// ── Combobox sub-component ───────────────────────────────────────────────────

function Combobox({
  value,
  onChange,
  suggestions,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = suggestions.filter(
    (s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value
  );

  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-40 overflow-y-auto">
          {filtered.map((s) => (
            <Button
              key={s}
              variant="ghost"
              type="button"
              className="w-full px-3 py-2 text-start text-body-sm h-auto justify-start rounded-none"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              {s}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Option value type ────────────────────────────────────────────────────────

interface OptionGroup {
  name: string;
  values: { label: string; price: number; cost: number; quantity: number }[];
}

// ── Props ────────────────────────────────────────────────────────────────────

interface ProductFormProps {
  product?: Product;
  onBack: () => void;
  onDone: () => void;
  embedded?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProductForm({
  product,
  onBack,
  onDone,
  embedded,
}: ProductFormProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = Boolean(product);

  // ── Autocomplete data ────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ["distinct-categories"],
    queryFn: () => designerApi.getDistinctValues("category"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: trademarks = [] } = useQuery({
    queryKey: ["distinct-trademarks"],
    queryFn: () => designerApi.getDistinctValues("trademark"),
    staleTime: 5 * 60 * 1000,
  });

  // ── Form state ───────────────────────────────────────────────────────────

  // Section 1: Basic Info
  const [nameAr, setNameAr] = useState(product?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(product?.name_en ?? "");
  const [descriptionAr, setDescriptionAr] = useState(
    product?.description_ar ?? ""
  );
  const [descriptionEn, setDescriptionEn] = useState(
    product?.description_en ?? ""
  );

  // Section 2: Pricing
  const [price, setPrice] = useState<string>(
    product?.price != null ? String(product.price) : ""
  );
  const [purchasePrice, setPurchasePrice] = useState<string>(
    product?.purchase_price != null ? String(product.purchase_price) : ""
  );
  const [isDiscounted, setIsDiscounted] = useState(
    product?.is_discounted ?? false
  );
  const [discountType, setDiscountType] = useState<"percent" | "fixed">(
    (product?.discount_type as "percent" | "fixed") ?? "percent"
  );
  const [discountValue, setDiscountValue] = useState<string>(
    product?.discount_value != null ? String(product.discount_value) : ""
  );

  // Section 3: Inventory
  const [stockQty, setStockQty] = useState<string>(
    product?.stock_qty != null ? String(product.stock_qty) : ""
  );
  const [unit, setUnit] = useState<string>(product?.unit ?? "piece");
  const [weight, setWeight] = useState<string>(
    product?.weight != null ? String(product.weight) : ""
  );

  // Section 4: Attributes
  const [category, setCategory] = useState(product?.category ?? "");
  const [trademark, setTrademark] = useState(product?.trademark ?? "");

  // Section 5: Options
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>(() => {
    if (product?.options && product.options.length > 0) {
      return product.options.map((o) => ({
        name: o.name,
        values: o.values.map((v) => ({
          label: v.label,
          price: v.price, cost: v.cost, quantity: v.quantity,
        })),
      }));
    }
    return [];
  });

  // Section 6: Media
  const [imageUrls, setImageUrls] = useState<string[]>(
    product?.image_urls ?? []
  );
  const [isUploading, setIsUploading] = useState(false);

  // Section 7: Flags
  const [isBestseller, setIsBestseller] = useState(
    product?.is_bestseller ?? false
  );

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // ── Computed discount price ──────────────────────────────────────────────

  const parsedPrice = parseFloat(price);
  const parsedDiscountValue = parseFloat(discountValue);

  const computedFinalPrice = useMemo(() => {
    if (isNaN(parsedPrice) || parsedPrice <= 0) return undefined;
    if (
      !isDiscounted ||
      isNaN(parsedDiscountValue) ||
      parsedDiscountValue <= 0
    )
      return undefined;
    if (discountType === "percent") {
      return +(parsedPrice * (1 - parsedDiscountValue / 100)).toFixed(2);
    }
    return +(parsedPrice - parsedDiscountValue).toFixed(2);
  }, [parsedPrice, parsedDiscountValue, discountType, isDiscounted]);

  // ── Track dirty state ────────────────────────────────────────────────────

  const initialSnapshot = useRef(
    JSON.stringify({
      nameAr: product?.name_ar ?? "",
      nameEn: product?.name_en ?? "",
      descriptionAr: product?.description_ar ?? "",
      descriptionEn: product?.description_en ?? "",
      price: product?.price != null ? String(product.price) : "",
      purchasePrice:
        product?.purchase_price != null
          ? String(product.purchase_price)
          : "",
      isDiscounted: product?.is_discounted ?? false,
      discountType: product?.discount_type ?? "percent",
      discountValue:
        product?.discount_value != null
          ? String(product.discount_value)
          : "",
      stockQty: product?.stock_qty != null ? String(product.stock_qty) : "",
      unit: product?.unit ?? "piece",
      weight: product?.weight != null ? String(product.weight) : "",
      category: product?.category ?? "",
      trademark: product?.trademark ?? "",
      isBestseller: product?.is_bestseller ?? false,
      imageUrls: product?.image_urls ?? [],
      optionGroups: product?.options?.map((o) => ({
        name: o.name,
        values: o.values.map((v) => ({
          label: v.label,
          price: v.price, cost: v.cost, quantity: v.quantity,
        })),
      })) ?? [],
    })
  );

  const isDirty = useCallback(() => {
    const current = JSON.stringify({
      nameAr,
      nameEn,
      descriptionAr,
      descriptionEn,
      price,
      purchasePrice,
      isDiscounted,
      discountType,
      discountValue,
      stockQty,
      unit,
      weight,
      category,
      trademark,
      isBestseller,
      imageUrls,
      optionGroups,
    });
    return current !== initialSnapshot.current;
  }, [
    nameAr,
    nameEn,
    descriptionAr,
    descriptionEn,
    price,
    purchasePrice,
    isDiscounted,
    discountType,
    discountValue,
    stockQty,
    unit,
    weight,
    category,
    trademark,
    isBestseller,
    imageUrls,
    optionGroups,
  ]);

  // Reset form when product changes
  useEffect(() => {
    setNameAr(product?.name_ar ?? "");
    setNameEn(product?.name_en ?? "");
    setDescriptionAr(product?.description_ar ?? "");
    setDescriptionEn(product?.description_en ?? "");
    setPrice(product?.price != null ? String(product.price) : "");
    setPurchasePrice(
      product?.purchase_price != null ? String(product.purchase_price) : ""
    );
    setIsDiscounted(product?.is_discounted ?? false);
    setDiscountType(
      (product?.discount_type as "percent" | "fixed") ?? "percent"
    );
    setDiscountValue(
      product?.discount_value != null ? String(product.discount_value) : ""
    );
    setStockQty(product?.stock_qty != null ? String(product.stock_qty) : "");
    setUnit(product?.unit ?? "piece");
    setWeight(product?.weight != null ? String(product.weight) : "");
    setCategory(product?.category ?? "");
    setTrademark(product?.trademark ?? "");
    setIsBestseller(product?.is_bestseller ?? false);
    setImageUrls(product?.image_urls ?? []);
    setOptionGroups(
      product?.options?.map((o) => ({
        name: o.name,
        values: o.values.map((v) => ({
          label: v.label,
          price: v.price, cost: v.cost, quantity: v.quantity,
        })),
      })) ?? []
    );
    initialSnapshot.current = JSON.stringify({
      nameAr: product?.name_ar ?? "",
      nameEn: product?.name_en ?? "",
      descriptionAr: product?.description_ar ?? "",
      descriptionEn: product?.description_en ?? "",
      price: product?.price != null ? String(product.price) : "",
      purchasePrice:
        product?.purchase_price != null
          ? String(product.purchase_price)
          : "",
      isDiscounted: product?.is_discounted ?? false,
      discountType: product?.discount_type ?? "percent",
      discountValue:
        product?.discount_value != null
          ? String(product.discount_value)
          : "",
      stockQty: product?.stock_qty != null ? String(product.stock_qty) : "",
      unit: product?.unit ?? "piece",
      weight: product?.weight != null ? String(product.weight) : "",
      category: product?.category ?? "",
      trademark: product?.trademark ?? "",
      isBestseller: product?.is_bestseller ?? false,
      imageUrls: product?.image_urls ?? [],
      optionGroups: product?.options?.map((o) => ({
        name: o.name,
        values: o.values.map((v) => ({
          label: v.label,
          price: v.price, cost: v.cost, quantity: v.quantity,
        })),
      })) ?? [],
    });
  }, [product]);

  // ── Back handler ─────────────────────────────────────────────────────────

  const handleBack = () => {
    if (isDirty()) {
      setShowDiscardDialog(true);
    } else {
      onBack();
    }
  };

  // ── Image upload ─────────────────────────────────────────────────────────

  const handleImageSelect = async (file: File) => {
    if (imageUrls.length >= MAX_IMAGES) return;
    try {
      setIsUploading(true);
      const url = await designerApi.uploadImage(file);
      setImageUrls((prev) => [...prev, url]);
    } catch {
      toast({ title: t("toast.error"), variant: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  // ── Options helpers ──────────────────────────────────────────────────────

  const addOptionGroup = () => {
    setOptionGroups((prev) => [
      ...prev,
      { name: "", values: [{ label: "", price: 0, cost: 0, quantity: 0 }] },
    ]);
  };

  const removeOptionGroup = (idx: number) => {
    setOptionGroups((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateOptionGroupName = (idx: number, name: string) => {
    setOptionGroups((prev) =>
      prev.map((g, i) => (i === idx ? { ...g, name } : g))
    );
  };

  const addOptionValue = (groupIdx: number) => {
    setOptionGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, values: [...g.values, { label: "", price: 0, cost: 0, quantity: 0 }] }
          : g
      )
    );
  };

  const removeOptionValue = (groupIdx: number, valueIdx: number) => {
    setOptionGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? { ...g, values: g.values.filter((_, j) => j !== valueIdx) }
          : g
      )
    );
  };

  const updateOptionValue = (
    groupIdx: number,
    valueIdx: number,
    field: "label" | "price" | "cost" | "quantity",
    val: string
  ) => {
    setOptionGroups((prev) =>
      prev.map((g, i) =>
        i === groupIdx
          ? {
              ...g,
              values: g.values.map((v, j) =>
                j === valueIdx
                  ? {
                      ...v,
                      [field]:
                        field === "label" ? val : field === "quantity" ? parseInt(val) || 0 : parseFloat(val) || 0,
                    }
                  : v
              ),
            }
          : g
      )
    );
  };

  // ── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (body: ProductCreate) => designerApi.createProduct(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("product.savedSuccess"), variant: "success" });
      onDone();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductUpdate }) =>
      designerApi.updateProduct(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: t("product.savedSuccess"), variant: "success" });
      onDone();
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedPrice) || parsedPrice < 0) return;

    const options: ProductOptionInput[] = optionGroups
      .filter((g) => g.name.trim())
      .map((g, i) => ({
        name: g.name,
        values: g.values.filter((v) => v.label.trim()),
        sort_order: i,
      }));

    const payload = {
      name_ar: nameAr,
      name_en: nameEn,
      description_ar: descriptionAr || null,
      description_en: descriptionEn || null,
      price: parsedPrice,
      purchase_price:
        purchasePrice !== "" && !isNaN(parseFloat(purchasePrice))
          ? parseFloat(purchasePrice)
          : null,
      is_discounted: isDiscounted,
      discount_type: isDiscounted ? discountType : null,
      discount_value:
        isDiscounted &&
        !isNaN(parsedDiscountValue) &&
        parsedDiscountValue > 0
          ? parsedDiscountValue
          : null,
      is_bestseller: isBestseller,
      category: category || null,
      trademark: trademark || null,
      stock_qty:
        stockQty !== "" && !isNaN(parseInt(stockQty))
          ? parseInt(stockQty)
          : null,
      unit,
      weight:
        weight !== "" && !isNaN(parseFloat(weight))
          ? parseFloat(weight)
          : null,
      image_urls: imageUrls.length > 0 ? imageUrls : null,
      options: options.length > 0 ? options : null,
    };

    if (isEdit && product) {
      updateMutation.mutate({ id: product.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const formContent = (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* ── Section 1: Basic Info ──────────────────────────────── */}
      <Card variant="glass">
        <CardContent className="space-y-4 p-5">
          <h3 className="text-heading-sm text-foreground">
            {t("product.basicInfo")}
          </h3>
          <FormField label={t("product.nameAr")} required htmlFor="name_ar">
            <Input
              id="name_ar"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder={t("product.nameAr")}
              dir="rtl"
              required
            />
          </FormField>
          <FormField label={t("product.nameEn")} required htmlFor="name_en">
            <Input
              id="name_en"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder={t("product.nameEn")}
              dir="ltr"
              required
            />
          </FormField>
          <FormField
            label={t("product.descriptionAr")}
            htmlFor="description_ar"
          >
            <Textarea
              id="description_ar"
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              placeholder={t("product.descriptionAr")}
              dir="rtl"
              autoResize
            />
          </FormField>
          <FormField
            label={t("product.descriptionEn")}
            htmlFor="description_en"
          >
            <Textarea
              id="description_en"
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              placeholder={t("product.descriptionEn")}
              dir="ltr"
              autoResize
            />
          </FormField>
        </CardContent>
      </Card>

      {/* ── Section 2: Pricing ─────────────────────────────────── */}
      <Card variant="glass">
        <CardContent className="space-y-4 p-5">
          <h3 className="text-heading-sm text-foreground">
            {t("product.pricing")}
          </h3>
          <FormField label={t("product.price")} required htmlFor="price">
            <Input
              id="price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              dir="ltr"
              required
            />
          </FormField>
          <FormField
            label={t("product.purchasePrice")}
            htmlFor="purchase_price"
          >
            <Input
              id="purchase_price"
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0.00"
              dir="ltr"
            />
          </FormField>

          {/* Discount toggle */}
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-medium text-foreground">
              {t("product.isDiscounted")}
            </span>
            <Switch
              checked={isDiscounted}
              onCheckedChange={setIsDiscounted}
            />
          </div>

          {isDiscounted && (
            <>
              <FormField
                label={t("product.discountType")}
                htmlFor="discount_type"
              >
                <Select
                  value={discountType}
                  onValueChange={(v) =>
                    setDiscountType(v as "percent" | "fixed")
                  }
                >
                  <SelectTrigger id="discount_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">
                      {t("product.discountPercent")}
                    </SelectItem>
                    <SelectItem value="fixed">
                      {t("product.discountFixed")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField
                label={t("product.discountValue")}
                htmlFor="discount_value"
              >
                <Input
                  id="discount_value"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder="0"
                  dir="ltr"
                />
              </FormField>
              {computedFinalPrice != null && (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 px-3 py-2">
                  <span className="text-body-sm text-muted-foreground">
                    {t("product.finalPrice")}:
                  </span>
                  <span className="text-body-sm font-bold text-success">
                    {formatPrice(computedFinalPrice)}
                  </span>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Inventory ───────────────────────────────── */}
      <Card variant="glass">
        <CardContent className="space-y-4 p-5">
          <h3 className="text-heading-sm text-foreground">
            {t("product.inventory")}
          </h3>
          <FormField label={t("product.stockQty")} htmlFor="stock_qty">
            <Input
              id="stock_qty"
              type="number"
              min="0"
              value={stockQty}
              onChange={(e) => setStockQty(e.target.value)}
              placeholder="0"
              dir="ltr"
            />
          </FormField>
          <FormField label={t("product.unit")} htmlFor="unit">
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger id="unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNIT_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {t(`product.unitOptions.${opt}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label={t("product.weight")} htmlFor="weight">
            <Input
              id="weight"
              type="number"
              min="0"
              step="0.01"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.00"
              dir="ltr"
            />
          </FormField>
        </CardContent>
      </Card>

      {/* ── Section 4: Attributes ──────────────────────────────── */}
      <Card variant="glass">
        <CardContent className="space-y-4 p-5">
          <h3 className="text-heading-sm text-foreground">
            {t("product.attributes")}
          </h3>
          <FormField label={t("product.category")} htmlFor="category">
            <Combobox
              id="category"
              value={category}
              onChange={setCategory}
              suggestions={categories}
              placeholder={t("product.category")}
            />
          </FormField>
          <FormField label={t("product.trademark")} htmlFor="trademark">
            <Combobox
              id="trademark"
              value={trademark}
              onChange={setTrademark}
              suggestions={trademarks}
              placeholder={t("product.trademark")}
            />
          </FormField>
        </CardContent>
      </Card>

      {/* ── Section 5: Options ─────────────────────────────────── */}
      <Card variant="glass">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-heading-sm text-foreground">
              {t("product.options")}
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addOptionGroup}
            >
              <Plus className="h-3.5 w-3.5 me-1" />
              {t("product.addOptionGroup")}
            </Button>
          </div>

          {optionGroups.map((group, gIdx) => (
            <div
              key={gIdx}
              className="rounded-xl border border-border bg-card/50 p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={group.name}
                  onChange={(e) =>
                    updateOptionGroupName(gIdx, e.target.value)
                  }
                  placeholder={t("product.optionName")}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive shrink-0"
                  onClick={() => removeOptionGroup(gIdx)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Values */}
              <div className="space-y-2 ps-6">
                {group.values.map((val, vIdx) => (
                  <div key={vIdx} className="flex items-center gap-2">
                    <Input
                      value={val.label}
                      onChange={(e) =>
                        updateOptionValue(gIdx, vIdx, "label", e.target.value)
                      }
                      placeholder={t("product.optionValue")}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={val.price || ""}
                      onChange={(e) =>
                        updateOptionValue(gIdx, vIdx, "price", e.target.value)
                      }
                      placeholder={t("product.price")}
                      className="w-20"
                      dir="ltr"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={val.cost || ""}
                      onChange={(e) =>
                        updateOptionValue(gIdx, vIdx, "cost", e.target.value)
                      }
                      placeholder={t("product.cost")}
                      className="w-20"
                      dir="ltr"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={val.quantity || ""}
                      onChange={(e) =>
                        updateOptionValue(gIdx, vIdx, "quantity", e.target.value)
                      }
                      placeholder={t("product.qty")}
                      className="w-16"
                      dir="ltr"
                    />
                    {group.values.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground shrink-0"
                        onClick={() => removeOptionValue(gIdx, vIdx)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => addOptionValue(gIdx)}
                >
                  <Plus className="h-3 w-3 me-1" />
                  {t("product.addValue")}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ── Section 6: Media ───────────────────────────────────── */}
      <Card variant="glass">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-heading-sm text-foreground">
              {t("product.media")}
            </h3>
            <span className="text-caption text-muted-foreground">
              {imageUrls.length}/{MAX_IMAGES} · {t("product.maxImages")}
            </span>
          </div>

          {/* Image grid */}
          <div className="grid grid-cols-3 gap-3">
            {imageUrls.map((url, idx) => (
              <div
                key={idx}
                className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
              >
                <img
                  src={getImageUrl(url) ?? ""}
                  alt={`${idx + 1}`}
                  className="h-full w-full object-cover"
                />
                {idx === 0 && (
                  <Badge
                    variant="default"
                    size="sm"
                    className="absolute start-1.5 top-1.5"
                  >
                    {t("product.coverImage")}
                  </Badge>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute end-1.5 top-1.5 h-6 w-6 rounded-full bg-black/60 text-white hover:bg-black/80"
                  onClick={() => removeImage(idx)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}

            {imageUrls.length < MAX_IMAGES && (
              <div className="aspect-square">
                <FileUpload
                  accept="image/*"
                  maxSize={5 * 1024 * 1024}
                  onUpload={handleImageSelect}
                  isUploading={isUploading}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 7: Flags ───────────────────────────────────── */}
      <Card variant="glass">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-body-sm font-medium text-foreground">
              {t("product.isBestseller")}
            </span>
            <Switch
              checked={isBestseller}
              onCheckedChange={setIsBestseller}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <Button
        type="submit"
        variant="gradient"
        size="xl"
        className="w-full"
        isLoading={isSaving || isUploading}
      >
        {t("actions.save")}
      </Button>
    </form>
  );

  const discardDialog = (
    <ConfirmationDialog
      open={showDiscardDialog}
      onOpenChange={setShowDiscardDialog}
      title={t("product.discardChanges")}
      confirmLabel={t("actions.confirm")}
      cancelLabel={t("actions.cancel")}
      variant="destructive"
      onConfirm={() => {
        setShowDiscardDialog(false);
        onBack();
      }}
    />
  );

  if (embedded) {
    return (
      <>
        {formContent}
        {discardDialog}
      </>
    );
  }

  return (
    <>
      <TopBar
        title={isEdit ? t("product.edit") : t("product.addNew")}
        backButton={{ onBack: handleBack }}
      />
      <PageContainer>{formContent}</PageContainer>
      {discardDialog}
    </>
  );
}
