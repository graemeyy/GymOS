import { staffRoute, json } from "@/lib/http/route";
import { OrderListQuery } from "@/lib/shop/schema";
import { listOrders } from "@/lib/shop/queries";
import { locationWhere } from "@/lib/locations/scope";

// One location's orders, or every location the person's role covers (D-128).
export const GET = staffRoute({ permission: "orders.manage", query: OrderListQuery }, async ({ query, db, staff }) => json(await listOrders(db, query, locationWhere(staff, query.locationId))));
