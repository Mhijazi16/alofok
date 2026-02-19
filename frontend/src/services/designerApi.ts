import api from "./api";
import type { Product } from "./salesApi";

export type { Product };

export interface ProductCreate {
  name_ar: string;
  name_en: string;
  sku: string;
  price: number;
  image_url?: string | null;
  is_discounted: boolean;
  is_bestseller: boolean;
}

export interface ProductUpdate {
  name_ar?: string;
  name_en?: string;
  sku?: string;
  price?: number;
  image_url?: string | null;
  is_discounted?: boolean;
  is_bestseller?: boolean;
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
};
