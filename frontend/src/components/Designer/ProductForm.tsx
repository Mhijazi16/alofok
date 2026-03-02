import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Package } from "lucide-react";

import {
  designerApi,
  type Product,
  type ProductCreate,
  type ProductUpdate,
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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

// ── Props ────────────────────────────────────────────────────────────────────

interface ProductFormProps {
  product?: Product;
  onBack: () => void;
  onDone: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ProductForm({ product, onBack, onDone }: ProductFormProps) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEdit = Boolean(product);

  // ── Form state ─────────────────────────────────────────────────────────────

  // Section 1: Basic Info
  const [nameAr, setNameAr] = useState(product?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(product?.name_en ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
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
  const [discountPercentage, setDiscountPercentage] = useState<string>(
    product?.discount_percentage != null
      ? String(product.discount_percentage)
      : ""
  );
  const [isDiscounted, setIsDiscounted] = useState(
    product?.is_discounted ?? false
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
  const [brand, setBrand] = useState(product?.brand ?? "");
  const [colorOptionsStr, setColorOptionsStr] = useState(
    product?.color_options?.join(", ") ?? ""
  );

  // Section 5: Media
  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.image_url ?? null
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Section 6: Flags
  const [isBestseller, setIsBestseller] = useState(
    product?.is_bestseller ?? false
  );

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // ── Computed discount price ────────────────────────────────────────────────

  const parsedPrice = parseFloat(price);
  const parsedDiscount = parseFloat(discountPercentage);

  const computedDiscountedPrice = useMemo(() => {
    if (
      !isNaN(parsedPrice) &&
      parsedPrice > 0 &&
      !isNaN(parsedDiscount) &&
      parsedDiscount > 0 &&
      parsedDiscount <= 100
    ) {
      return +(parsedPrice * (1 - parsedDiscount / 100)).toFixed(2);
    }
    return undefined;
  }, [parsedPrice, parsedDiscount]);

  // ── Track dirty state ──────────────────────────────────────────────────────

  const initialSnapshot = useRef({
    nameAr: product?.name_ar ?? "",
    nameEn: product?.name_en ?? "",
    sku: product?.sku ?? "",
    descriptionAr: product?.description_ar ?? "",
    descriptionEn: product?.description_en ?? "",
    price: product?.price != null ? String(product.price) : "",
    discountPercentage:
      product?.discount_percentage != null
        ? String(product.discount_percentage)
        : "",
    isDiscounted: product?.is_discounted ?? false,
    stockQty: product?.stock_qty != null ? String(product.stock_qty) : "",
    unit: product?.unit ?? "piece",
    weight: product?.weight != null ? String(product.weight) : "",
    category: product?.category ?? "",
    brand: product?.brand ?? "",
    colorOptionsStr: product?.color_options?.join(", ") ?? "",
    isBestseller: product?.is_bestseller ?? false,
    imageUrl: product?.image_url ?? null,
  });

  const isDirty = useCallback(() => {
    const s = initialSnapshot.current;
    return (
      nameAr !== s.nameAr ||
      nameEn !== s.nameEn ||
      sku !== s.sku ||
      descriptionAr !== s.descriptionAr ||
      descriptionEn !== s.descriptionEn ||
      price !== s.price ||
      discountPercentage !== s.discountPercentage ||
      isDiscounted !== s.isDiscounted ||
      stockQty !== s.stockQty ||
      unit !== s.unit ||
      weight !== s.weight ||
      category !== s.category ||
      brand !== s.brand ||
      colorOptionsStr !== s.colorOptionsStr ||
      isBestseller !== s.isBestseller ||
      imageUrl !== s.imageUrl ||
      imageFile !== null
    );
  }, [
    nameAr,
    nameEn,
    sku,
    descriptionAr,
    descriptionEn,
    price,
    discountPercentage,
    isDiscounted,
    stockQty,
    unit,
    weight,
    category,
    brand,
    colorOptionsStr,
    isBestseller,
    imageUrl,
    imageFile,
  ]);

  // Reset form when product prop changes (e.g. switching from create to edit)
  useEffect(() => {
    setNameAr(product?.name_ar ?? "");
    setNameEn(product?.name_en ?? "");
    setSku(product?.sku ?? "");
    setDescriptionAr(product?.description_ar ?? "");
    setDescriptionEn(product?.description_en ?? "");
    setPrice(product?.price != null ? String(product.price) : "");
    setDiscountPercentage(
      product?.discount_percentage != null
        ? String(product.discount_percentage)
        : ""
    );
    setIsDiscounted(product?.is_discounted ?? false);
    setStockQty(product?.stock_qty != null ? String(product.stock_qty) : "");
    setUnit(product?.unit ?? "piece");
    setWeight(product?.weight != null ? String(product.weight) : "");
    setCategory(product?.category ?? "");
    setBrand(product?.brand ?? "");
    setColorOptionsStr(product?.color_options?.join(", ") ?? "");
    setIsBestseller(product?.is_bestseller ?? false);
    setImageUrl(product?.image_url ?? null);
    setImageFile(null);
    initialSnapshot.current = {
      nameAr: product?.name_ar ?? "",
      nameEn: product?.name_en ?? "",
      sku: product?.sku ?? "",
      descriptionAr: product?.description_ar ?? "",
      descriptionEn: product?.description_en ?? "",
      price: product?.price != null ? String(product.price) : "",
      discountPercentage:
        product?.discount_percentage != null
          ? String(product.discount_percentage)
          : "",
      isDiscounted: product?.is_discounted ?? false,
      stockQty: product?.stock_qty != null ? String(product.stock_qty) : "",
      unit: product?.unit ?? "piece",
      weight: product?.weight != null ? String(product.weight) : "",
      category: product?.category ?? "",
      brand: product?.brand ?? "",
      colorOptionsStr: product?.color_options?.join(", ") ?? "",
      isBestseller: product?.is_bestseller ?? false,
      imageUrl: product?.image_url ?? null,
    };
  }, [product]);

  // ── Back handler with dirty check ──────────────────────────────────────────

  const handleBack = () => {
    if (isDirty()) {
      setShowDiscardDialog(true);
    } else {
      onBack();
    }
  };

  // ── Image handling ─────────────────────────────────────────────────────────

  const handleImageSelect = (file: File) => {
    setImageFile(file);
    // Show local preview immediately
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  // ── Mutations ──────────────────────────────────────────────────────────────

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

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isNaN(parsedPrice) || parsedPrice < 0) return;

    let finalImageUrl = imageUrl;

    // Upload image if a new file was selected
    if (imageFile) {
      try {
        setIsUploading(true);
        finalImageUrl = await designerApi.uploadImage(imageFile);
      } catch {
        toast({ title: t("toast.error"), variant: "error" });
        setIsUploading(false);
        return;
      } finally {
        setIsUploading(false);
      }
    }

    // Parse color options from comma-separated string
    const colorOptions = colorOptionsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name_ar: nameAr,
      name_en: nameEn,
      description_ar: descriptionAr || null,
      description_en: descriptionEn || null,
      sku,
      price: parsedPrice,
      discount_percentage:
        !isNaN(parsedDiscount) && parsedDiscount > 0
          ? parsedDiscount
          : null,
      discounted_price: computedDiscountedPrice ?? null,
      image_url: finalImageUrl,
      is_discounted: isDiscounted,
      is_bestseller: isBestseller,
      category: category || null,
      brand: brand || null,
      stock_qty:
        stockQty !== "" && !isNaN(parseInt(stockQty))
          ? parseInt(stockQty)
          : null,
      unit,
      weight:
        weight !== "" && !isNaN(parseFloat(weight))
          ? parseFloat(weight)
          : null,
      color_options: colorOptions.length > 0 ? colorOptions : null,
    };

    if (isEdit && product) {
      updateMutation.mutate({ id: product.id, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ── Computed preview values ────────────────────────────────────────────────

  const previewName = isAr
    ? nameAr || t("product.nameAr")
    : nameEn || t("product.nameEn");

  const previewDescription = isAr
    ? descriptionAr
    : descriptionEn;

  const previewColors = colorOptionsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const parsedStockQty =
    stockQty !== "" && !isNaN(parseInt(stockQty)) ? parseInt(stockQty) : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <TopBar
        title={isEdit ? t("product.edit") : t("product.addNew")}
        backButton={{ onBack: handleBack }}
      />

      <PageContainer>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 lg:grid-cols-5">
            {/* ── Left: Form fields ──────────────────────────────────────── */}
            <div className="space-y-5 lg:col-span-3">
              {/* ── Section 1: Basic Info ──────────────────────────────── */}
              <Card variant="glass">
                <CardContent className="space-y-4 p-5">
                  <h3 className="text-heading-sm text-foreground mb-3">
                    {t("product.basicInfo")}
                  </h3>

                  {/* Name AR */}
                  <FormField
                    label={t("product.nameAr")}
                    required
                    htmlFor="name_ar"
                  >
                    <Input
                      id="name_ar"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder={t("product.nameAr")}
                      dir="rtl"
                      required
                    />
                  </FormField>

                  {/* Name EN */}
                  <FormField
                    label={t("product.nameEn")}
                    required
                    htmlFor="name_en"
                  >
                    <Input
                      id="name_en"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      placeholder={t("product.nameEn")}
                      dir="ltr"
                      required
                    />
                  </FormField>

                  {/* SKU */}
                  <FormField label={t("product.sku")} required htmlFor="sku">
                    <Input
                      id="sku"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      placeholder={t("product.sku")}
                      dir="ltr"
                      required
                    />
                  </FormField>

                  {/* Description AR */}
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

                  {/* Description EN */}
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
                  <h3 className="text-heading-sm text-foreground mb-3 mt-6">
                    {t("product.pricing")}
                  </h3>

                  {/* Price */}
                  <FormField
                    label={t("product.price")}
                    required
                    htmlFor="price"
                  >
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

                  {/* Discount percentage */}
                  <FormField
                    label={t("product.discountPercentage")}
                    htmlFor="discount_percentage"
                  >
                    <Input
                      id="discount_percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(e.target.value)}
                      placeholder="0"
                      dir="ltr"
                    />
                  </FormField>

                  {/* Discounted price (computed, read-only) */}
                  <FormField
                    label={t("product.discountedPrice")}
                    htmlFor="discounted_price"
                  >
                    <Input
                      id="discounted_price"
                      type="number"
                      value={
                        computedDiscountedPrice != null
                          ? String(computedDiscountedPrice)
                          : ""
                      }
                      readOnly
                      dir="ltr"
                      className="opacity-70 cursor-not-allowed"
                      placeholder="--"
                    />
                  </FormField>

                  {/* Is discounted toggle */}
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm font-medium text-foreground">
                      {t("product.isDiscounted")}
                    </span>
                    <Switch
                      checked={isDiscounted}
                      onCheckedChange={setIsDiscounted}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── Section 3: Inventory ───────────────────────────────── */}
              <Card variant="glass">
                <CardContent className="space-y-4 p-5">
                  <h3 className="text-heading-sm text-foreground mb-3 mt-6">
                    {t("product.inventory")}
                  </h3>

                  {/* Stock quantity */}
                  <FormField
                    label={t("product.stockQty")}
                    htmlFor="stock_qty"
                  >
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

                  {/* Unit */}
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

                  {/* Weight */}
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
                  <h3 className="text-heading-sm text-foreground mb-3 mt-6">
                    {t("product.attributes")}
                  </h3>

                  {/* Category */}
                  <FormField
                    label={t("product.category")}
                    htmlFor="category"
                  >
                    <Input
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder={t("product.category")}
                    />
                  </FormField>

                  {/* Brand */}
                  <FormField label={t("product.brand")} htmlFor="brand">
                    <Input
                      id="brand"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder={t("product.brand")}
                    />
                  </FormField>

                  {/* Color options */}
                  <FormField
                    label={t("product.colorOptions")}
                    htmlFor="color_options"
                    description={isAr ? "افصل الألوان بفاصلة" : "Separate colors with commas"}
                  >
                    <Input
                      id="color_options"
                      value={colorOptionsStr}
                      onChange={(e) => setColorOptionsStr(e.target.value)}
                      placeholder={isAr ? "أحمر, أزرق, أخضر" : "Red, Blue, Green"}
                    />
                  </FormField>
                </CardContent>
              </Card>

              {/* ── Section 5: Media ───────────────────────────────────── */}
              <Card variant="glass">
                <CardContent className="p-5">
                  <h3 className="text-heading-sm text-foreground mb-3 mt-6">
                    {t("product.image")}
                  </h3>
                  <FormField label={t("product.uploadImage")}>
                    <FileUpload
                      accept="image/*"
                      maxSize={5 * 1024 * 1024}
                      onUpload={handleImageSelect}
                      isUploading={isUploading}
                    />
                  </FormField>
                </CardContent>
              </Card>

              {/* ── Section 6: Flags ───────────────────────────────────── */}
              <Card variant="glass">
                <CardContent className="space-y-4 p-5">
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
            </div>

            {/* ── Right: Live preview ────────────────────────────────── */}
            <div className="lg:col-span-2">
              <div className="sticky top-20">
                <Card variant="glass">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-body-sm text-muted-foreground">
                      {t("product.preview")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pb-5">
                    {/* Preview card mimics how it looks in the catalog */}
                    <Card variant="default" className="overflow-hidden">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
                        {imageUrl ? (
                          <img
                            src={getImageUrl(imageUrl)!}
                            alt={previewName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted-foreground/10">
                              <Package className="h-7 w-7 text-muted-foreground" />
                            </div>
                          </div>
                        )}

                        {/* Badges */}
                        <div className="absolute start-2 top-2 flex flex-col gap-1">
                          {isBestseller && (
                            <Badge variant="warning" size="sm">
                              {t("catalog.bestSellers")}
                            </Badge>
                          )}
                          {isDiscounted && (
                            <Badge variant="success" size="sm">
                              {t("catalog.discounted")}
                            </Badge>
                          )}
                        </div>

                        {/* Unit badge */}
                        {unit && (
                          <div className="absolute end-2 top-2">
                            <Badge variant="default" size="sm">
                              {t(`product.unitOptions.${unit}`)}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <CardContent className="p-3 pt-3">
                        <p className="truncate text-body-sm font-semibold text-foreground">
                          {previewName}
                        </p>
                        <p className="mt-0.5 truncate text-caption text-muted-foreground">
                          {sku || t("product.sku")}
                        </p>

                        {/* Description (truncated) */}
                        {previewDescription && (
                          <p className="mt-1 line-clamp-2 text-caption text-muted-foreground">
                            {previewDescription}
                          </p>
                        )}

                        {/* Price display with discount */}
                        <div className="mt-1.5 flex items-center gap-2">
                          {computedDiscountedPrice != null &&
                          isDiscounted ? (
                            <>
                              <span className="text-body-sm font-bold text-primary">
                                {formatPrice(computedDiscountedPrice)}
                              </span>
                              <span className="text-caption text-muted-foreground line-through">
                                {!isNaN(parsedPrice) && parsedPrice >= 0
                                  ? formatPrice(parsedPrice)
                                  : formatPrice(0)}
                              </span>
                            </>
                          ) : (
                            <span className="text-body-sm font-bold text-primary">
                              {!isNaN(parsedPrice) && parsedPrice >= 0
                                ? formatPrice(parsedPrice)
                                : formatPrice(0)}
                            </span>
                          )}
                        </div>

                        {/* Color dots */}
                        {previewColors.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {previewColors.map((color, i) => (
                              <span
                                key={i}
                                className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[8px] font-medium text-muted-foreground"
                                style={{
                                  backgroundColor: isValidCssColor(color)
                                    ? color.toLowerCase()
                                    : undefined,
                                }}
                                title={color}
                              >
                                {!isValidCssColor(color)
                                  ? color.charAt(0).toUpperCase()
                                  : ""}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Stock indicator */}
                        {parsedStockQty != null && (
                          <div className="mt-2">
                            <span
                              className={`text-caption font-medium ${
                                parsedStockQty > 10
                                  ? "text-green-500"
                                  : parsedStockQty > 0
                                    ? "text-yellow-500"
                                    : "text-destructive"
                              }`}
                            >
                              {parsedStockQty > 0
                                ? `${parsedStockQty} ${t(`product.unitOptions.${unit}`)}`
                                : isAr
                                  ? "غير متوفر"
                                  : "Out of stock"}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </form>
      </PageContainer>

      {/* Discard changes dialog */}
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
    </>
  );
}

// ── Utility: check if a string is a valid CSS color name or hex ──────────────

const CSS_COLOR_NAMES = new Set([
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "pink",
  "black",
  "white",
  "gray",
  "grey",
  "brown",
  "cyan",
  "magenta",
  "lime",
  "maroon",
  "navy",
  "olive",
  "teal",
  "aqua",
  "silver",
  "gold",
  "coral",
  "salmon",
  "khaki",
  "ivory",
  "beige",
  "turquoise",
  "indigo",
  "violet",
]);

function isValidCssColor(value: string): boolean {
  const lower = value.toLowerCase().trim();
  if (CSS_COLOR_NAMES.has(lower)) return true;
  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(lower)) return true;
  return false;
}
