import { staffRoute, json } from "@/lib/http/route";
import { OrderListQuery } from "@/lib/shop/schema";
import { listOrders } from "@/lib/shop/queries";

export const GET = staffRoute({ permission: "orders.manage", query: OrderListQuery }, async ({ query, db }) => json(await listOrders(db, query)));
