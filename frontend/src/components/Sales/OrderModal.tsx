import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2, Undo2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { salesApi, type OrderWithCustomer } from "@/services/salesApi";
import { getImageUrl } from "@/lib/image";

interface OrderModalProps {
  order: OrderWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formatCurrency = (val: number) =>
  val.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function OrderModal({
  order,
  open,
  onOpenChange,
}: OrderModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editTab, setEditTab] = useState("view");

  // Edit state
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [editDeliveryDate, setEditDeliveryDate] = useState<Date | undefined>();
  const [editNotes, setEditNotes] = useState("");

  // Initialize edit state when modal opens
  useEffect(() => {
    if (open && order) {
      setEditCustomerId(order.customer_id);
      setEditItems((order.data as any)?.items || []);
      setEditDeliveryDate(order.delivery_date ? new Date(order.delivery_date) : undefined);
      setEditNotes(order.notes || "");
    }
  }, [open, order]);

  // Fetch all customers for picker
  const { data: allCustomers = [] } = useQuery({
    queryKey: ["my-customers"],
    queryFn: salesApi.getMyCustomers,
    enabled: open,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (payload: any) =>
      salesApi.updateOrder(order!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });


  // Delete mutation
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteMutation = useMutation({
    mutationFn: () => salesApi.deleteOrder(order!.id),
    onSuccess: () => {
      setConfirmDeleteOpen(false);
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  // Undeliver mutation
  const [confirmUndeliverOpen, setConfirmUndeliverOpen] = useState(false);
  const undeliverMutation = useMutation({
    mutationFn: () => salesApi.undeliverOrder(order!.id),
    onSuccess: () => {
      setConfirmUndeliverOpen(false);
      queryClient.invalidateQueries({ queryKey: ["delivery-orders"] });
      toast({ title: t("toast.success"), variant: "success" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: t("toast.error"), variant: "error" });
    },
  });

  const handleSaveChanges = async () => {
    if (!order || !editItems.length) {
      toast({ title: "Order must have at least one item", variant: "warning" });
      return;
    }

    const payload = {
      customer_id: editCustomerId ?? undefined,
      items: editItems,
      delivery_date: editDeliveryDate
        ? editDeliveryDate.toISOString().split("T")[0]
        : null,
      notes: editNotes || undefined,
    };

    updateMutation.mutate(payload);
  };


  if (!order) return null;

  const isDelivered = !!(order as any).delivered_date;
  const canEdit = !isDelivered;
  const items = ((order.data as any)?.items || []) as any[];
  const total = items.reduce(
    (sum, item) => sum + (item.quantity * item.unit_price),
    0
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order.customer_name}</DialogTitle>
        </DialogHeader>

        <Tabs value={editTab} onValueChange={setEditTab}>
          <TabsList className="w-full">
            <TabsTrigger value="view" className="flex-1">
              {t("order.viewProducts")}
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex-1" disabled={!canEdit}>
              {t("order.editOrder")}
            </TabsTrigger>
          </TabsList>

          {/* View Products Tab */}
          <TabsContent value="view" className="space-y-3">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                {t("catalog.noResults")}
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <Card key={idx} variant="glass" className="p-3">
                    <div className="flex gap-3">
                      <img
                        src={getImageUrl(item.image_url) ?? ""}
                        alt={item.name}
                        className="h-16 w-16 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-semibold truncate">
                          {item.name}
                        </p>
                        <p className="text-caption text-muted-foreground">
                          {item.quantity} × {formatCurrency(item.unit_price)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-body-sm font-semibold">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            <div className="border-t pt-3 flex justify-between">
              <p className="font-semibold">{t("cart.total")}</p>
              <p className="font-semibold">{formatCurrency(total)}</p>
            </div>
          </TabsContent>

          {/* Edit Order Tab */}
          <TabsContent value="edit" className="space-y-4">
            {canEdit ? (
              <>
                <FormField label={t("nav.customers")}>
                  <select
                    value={editCustomerId ?? ""}
                    onChange={(e) => setEditCustomerId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="">Select a customer</option>
                    {allCustomers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label={t("catalog.deliveryDate")}>
                  <DatePicker
                    value={editDeliveryDate}
                    onChange={setEditDeliveryDate}
                  />
                </FormField>

                <FormField label={t("order.notes") || "Notes"}>
                  <Textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder={t("order.addNotes") || "Add order notes..."}
                  />
                </FormField>

                <FormField label={t("catalog.items")}>
                  <div className="space-y-2">
                    {editItems.map((item, idx) => (
                      <Card key={idx} variant="glass" className="p-3">
                        <div className="flex gap-3">
                          <img
                            src={getImageUrl(item.image_url) ?? ""}
                            alt={item.name}
                            className="h-16 w-16 rounded object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-body-sm font-semibold truncate">
                              {item.name}
                            </p>
                            <div className="flex gap-2 mt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newItems = editItems.map((i, j) =>
                                    j === idx ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i
                                  );
                                  setEditItems(newItems);
                                }}
                              >
                                −
                              </Button>
                              <span className="px-2 py-1 text-sm">
                                {item.quantity}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const newItems = editItems.map((i, j) =>
                                    j === idx ? { ...i, quantity: i.quantity + 1 } : i
                                  );
                                  setEditItems(newItems);
                                }}
                              >
                                +
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditItems(editItems.filter((_, j) => j !== idx));
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </FormField>
              </>
            ) : (
              <p className="text-center text-muted-foreground py-4">
                {t("order.deliveredLocked")}
              </p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            {t("order.deleteOrder")}
          </Button>
          {isDelivered ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmUndeliverOpen(true)}
            >
              <Undo2 className="h-4 w-4" />
              {t("order.undeliver")}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                {t("actions.cancel")}
              </Button>
              {editTab === "edit" && (
                <Button
                  onClick={handleSaveChanges}
                  isLoading={updateMutation.isPending}
                >
                  {t("actions.save")}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>

      <ConfirmationDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title={t("order.deleteOrder")}
        description={t("order.deleteOrderMessage")}
        confirmLabel={t("actions.delete")}
        cancelLabel={t("actions.cancel")}
        onConfirm={() => deleteMutation.mutate()}
        variant="destructive"
        isLoading={deleteMutation.isPending}
      />

      <ConfirmationDialog
        open={confirmUndeliverOpen}
        onOpenChange={setConfirmUndeliverOpen}
        title={t("order.undeliver")}
        description={t("order.undeliverMessage")}
        confirmLabel={t("actions.confirm")}
        cancelLabel={t("actions.cancel")}
        onConfirm={() => undeliverMutation.mutate()}
        isLoading={undeliverMutation.isPending}
      />
    </Dialog>
  );
}
