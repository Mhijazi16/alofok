import api from "./api";
import type { Product, ProductOption } from "./salesApi";

export type { Product, ProductOption };

export interface ProductOptionInput {
  name: string;
  values: { label: string; price_modifier: number }[];
  sort_order: number;
}

export interface ProductCreate {
  name_ar: string;
  name_en: string;
  description_ar?: string | null;
  description_en?: string | null;
  price: number;
  purchase_price?: number | null;
  is_discounted: boolean;
  is_bestseller: boolean;
  discount_type?: "percent" | "fixed" | null;
  discount_value?: number | null;
  category?: string | null;
  trademark?: string | null;
  stock_qty?: number | null;
  unit?: string;
  weight?: number | null;
  image_urls?: string[] | null;
  options?: ProductOptionInput[] | null;
}

export interface ProductUpdate {
  name_ar?: string;
  name_en?: string;
  description_ar?: string | null;
  description_en?: string | null;
  price?: number;
  purchase_price?: number | null;
  is_discounted?: boolean;
  is_bestseller?: boolean;
  discount_type?: "percent" | "fixed" | null;
  discount_value?: number | null;
  category?: string | null;
  trademark?: string | null;
  stock_qty?: number | null;
  unit?: string;
  weight?: number | null;
  image_urls?: string[] | null;
  options?: ProductOptionInput[] | null;
}

export const designerApi = {
  getProducts: () => api.get<Product[]>("/products").then((r) => r.data),

  createProduct: (body: ProductCreate) =>
    api.post<Product>("/products", body).then((r) => r.data),

  updateProduct: (id: string, body: ProductUpdate) =>
    api.put<Product>(`/products/${id}`, body).then((r) => r.data),

  uploadImage: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<{ url: string }>("/products/upload-image", form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data.url);
  },

  deleteProduct: (id: string) =>
    api.delete(`/products/${id}`).then((r) => r.data),

  duplicateProduct: (id: string) =>
    api.post<Product>(`/products/${id}/duplicate`).then((r) => r.data),

  getDistinctValues: (field: string) =>
    api
      .get<string[]>("/products/distinct-values", { params: { field } })
      .then((r) => r.data),
};
