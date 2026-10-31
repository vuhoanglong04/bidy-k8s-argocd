"use client";

import { Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import OrderCard from "./OrderCard";
import type { OrderItem } from "@/services/orders/orders.service";

interface OrdersListProps {
  orders: OrderItem[];
  selectedOrders: Set<string>;
  onSelectOrder: (orderId: string) => void;
  onSelectAll: () => void;
}

export default function OrdersList({
  orders,
  selectedOrders,
  onSelectOrder,
  onSelectAll
}: OrdersListProps) {
  const pendingOrders = orders.filter(o => o.paymentStatus === "pending");
  const hasPendingOrders = pendingOrders.length > 0;
  const allPendingSelected = hasPendingOrders && 
    pendingOrders.every(o => selectedOrders.has(o.id));

  return (
    <div className="flex flex-col gap-3">
      {/* Select All Checkbox */}
      {hasPendingOrders && (
        <div className="flex items-center gap-2 border border-border bg-card px-4 py-3">
          <Checkbox
            id="select-all-orders"
            checked={allPendingSelected}
            onCheckedChange={onSelectAll}
            className="size-5"
          />
          <label
            htmlFor="select-all-orders"
            className="cursor-pointer text-sm font-medium text-foreground"
          >
            Chọn tất cả ({pendingOrders.length} đơn chờ thanh toán)
          </label>
        </div>
      )}

      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="border border-dashed border-border px-6 py-14 text-center">
          <Package className="mx-auto size-8 text-foreground-secondary" aria-hidden />
          <p className="mt-3 text-base font-medium text-foreground">
            Không có đơn hàng nào
          </p>
          <p className="mt-1 text-sm text-foreground-secondary">
            Đơn sẽ xuất hiện ở đây khi bạn thắng một phiên đấu giá.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map(order => (
            <li key={order.id}>
              <OrderCard
                order={order}
                selected={selectedOrders.has(order.id)}
                onSelect={onSelectOrder}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}