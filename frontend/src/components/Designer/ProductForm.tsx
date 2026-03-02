import { useState, useEffect, useCallback, useRef } from "react";
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
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/ui/form-field";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
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

  const [nameAr, setNameAr] = useState(product?.name_ar ?? "");
  const [nameEn, setNameEn] = useState(product?.name_en ?? "");
  const [sku, setSku] = useState(product?.sku ?? "");
  const [price, setPrice] = useState<string>(
    product?.price != null ? String(product.price) : ""
  );
  const [isDiscounted, setIsDiscounted] = useState(
    product?.is_discounted ?? false
  );
  const [isBestseller, setIsBestseller] = useState(
    product?.is_bestseller ?? false
  );
  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.image_url ?? null
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // Track whether the form has been changed
  const initialSnapshot = useRef({
    nameAr: product?.name_ar ?? "",
    nameEn: product?.name_en ?? "",
    sku: product?.sku ?? "",
    price: product?.price != null ? String(product.price) : "",
    isDiscounted: product?.is_discounted ?? false,
    isBestseller: product?.is_bestseller ?? false,
    imageUrl: product?.image_url ?? null,
  });

  const isDirty = useCallback(() => {
    const s = initialSnapshot.current;
    return (
      nameAr !== s.nameAr ||
      nameEn !== s.nameEn ||
      sku !== s.sku ||
      price !== s.price ||
      isDiscounted !== s.isDiscounted ||
      isBestseller !== s.isBestseller ||
      imageUrl !== s.imageUrl ||
      imageFile !== null
    );
  }, [nameAr, nameEn, sku, price, isDiscounted, isBestseller, imageUrl, imageFile]);

  // Reset form when product prop changes (e.g. switching from create to edit)
  useEffect(() => {
    setNameAr(product?.name_ar ?? "");
    setNameEn(product?.name_en ?? "");
    setSku(product?.sku ?? "");
    setPrice(product?.price != null ? String(product.price) : "");
    setIsDiscounted(product?.is_discounted ?? false);
    setIsBestseller(product?.is_bestseller ?? false);
    setImageUrl(product?.image_url ?? null);
    setImageFile(null);
    initialSnapshot.current = {
      nameAr: product?.name_ar ?? "",
      nameEn: product?.name_en ?? "",
      sku: product?.sku ?? "",
      price: product?.price != null ? String(product.price) : "",
      isDiscounted: product?.is_discounted ?? false,
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

    const parsedPrice = parseFloat(price);
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

    if (isEdit && product) {
      updateMutation.mutate({
        id: product.id,
        body: {
          name_ar: nameAr,
          name_en: nameEn,
          sku,
          price: parsedPrice,
          image_url: finalImageUrl,
          is_discounted: isDiscounted,
          is_bestseller: isBestseller,
        },
      });
    } else {
      createMutation.mutate({
        name_ar: nameAr,
        name_en: nameEn,
        sku,
        price: parsedPrice,
        image_url: finalImageUrl,
        is_discounted: isDiscounted,
        is_bestseller: isBestseller,
      });
    }
  };

  // ── Computed preview values ────────────────────────────────────────────────

  const previewName = isAr
    ? nameAr || t("product.nameAr")
    : nameEn || t("product.nameEn");
  const previewPrice = parseFloat(price);

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
              <Card variant="glass">
                <CardContent className="space-y-4 p-5">
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
                </CardContent>
              </Card>

              {/* Image upload */}
              <Card variant="glass">
                <CardContent className="p-5">
                  <FormField label={t("product.image")}>
                    <FileUpload
                      accept="image/*"
                      maxSize={5 * 1024 * 1024}
                      onUpload={handleImageSelect}
                      isUploading={isUploading}
                    />
                  </FormField>
                </CardContent>
              </Card>

              {/* Toggles */}
              <Card variant="glass">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-body-sm font-medium text-foreground">
                      {t("product.isDiscounted")}
                    </span>
                    <Switch
                      checked={isDiscounted}
                      onCheckedChange={setIsDiscounted}
                    />
                  </div>
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

            {/* ── Right: Live preview ────────────────────────────────────── */}
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
                      </div>

                      <CardContent className="p-3 pt-3">
                        <p className="truncate text-body-sm font-semibold text-foreground">
                          {previewName}
                        </p>
                        <p className="mt-0.5 truncate text-caption text-muted-foreground">
                          {sku || t("product.sku")}
                        </p>
                        <p className="mt-1.5 text-body-sm font-bold text-primary">
                          {!isNaN(previewPrice) && previewPrice >= 0
                            ? formatPrice(previewPrice)
                            : formatPrice(0)}
                        </p>
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
