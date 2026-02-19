import { useState } from "react";
import { type Product } from "@/services/designerApi";
import ProductList from "./ProductList";
import ProductForm from "./ProductForm";

type Screen =
  | { name: "list" }
  | { name: "create" }
  | { name: "edit"; product: Product };

export default function DesignerRoot() {
  const [screen, setScreen] = useState<Screen>({ name: "list" });

  return (
    <div className="flex flex-col h-screen bg-background">
      {screen.name === "list" && (
        <ProductList
          onAdd={() => setScreen({ name: "create" })}
          onEdit={(p) => setScreen({ name: "edit", product: p })}
        />
      )}

      {screen.name === "create" && (
        <ProductForm
          onBack={() => setScreen({ name: "list" })}
          onSaved={() => setScreen({ name: "list" })}
        />
      )}

      {screen.name === "edit" && (
        <ProductForm
          product={screen.product}
          onBack={() => setScreen({ name: "list" })}
          onSaved={() => setScreen({ name: "list" })}
        />
      )}
    </div>
  );
}
