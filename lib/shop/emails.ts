import { appUrl } from "@/lib/app-url";
import type { Db } from "@/lib/db";
import { gym } from "@/lib/config";
import { formatAud } from "@/lib/money";
import { sendEmail, signature } from "@/lib/email";

export type OrderEmailKind = "confirmed" | "ready" | "shipped" | "refunded";

// Order emails are transactional (Spam Act exempt), so they go to every
// customer regardless of marketing preferences. With no email key they are
// skipped, like every other email.
export async function sendOrderEmail(db: Db, orderId: string, kind: OrderEmailKind) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.email.endsWith("@deleted.invalid")) return;
  const first = order.customerName.split(" ")[0] || "there";
  const link = appUrl(`/member/orders/${order.id}`);
  const lines = order.items.map((i) => `  ${i.quantity} x ${i.productName} (${i.variantLabel})  ${formatAud(i.lineTotalCents)}`).join("\n");
  const totals = [
    order.discountCents > 0 ? `Member discount: -${formatAud(order.discountCents)}` : null,
    order.shippingCents > 0 ? `Shipping: ${formatAud(order.shippingCents)}` : null,
    `Total: ${formatAud(order.totalCents)}${gym.business.gstRegistered ? ` (includes ${formatAud(order.gstCents)} GST)` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
  const pickup = `Collect it from the front desk at ${gym.business.address.line1}, ${gym.business.address.suburb}.`;
  const messages: Record<OrderEmailKind, { subject: string; body: string }> = {
    confirmed: {
      subject: `Order ${order.number} confirmed`,
      body: `Thanks for your order. We'll ${order.fulfilment === "PICKUP" ? "let you know when it's ready to collect" : "let you know when it ships"}.\n\n${lines}\n\n${totals}\n\nYour tax invoice and order status: ${link}`,
    },
    ready: { subject: `Order ${order.number} is ready to collect`, body: `Your order is ready. ${pickup}\n\n${lines}\n\nOrder details: ${link}` },
    shipped: {
      subject: `Order ${order.number} has shipped`,
      body: `Your order is on its way.${order.trackingNumber ? ` Tracking number: ${order.trackingNumber}.` : ""}\n\n${lines}\n\nOrder details: ${link}`,
    },
    refunded: { subject: `Order ${order.number} refunded`, body: `We've refunded order ${order.number}. Card refunds usually take 5 to 10 business days to appear.\n\nOrder details: ${link}` },
  };
  const message = messages[kind];
  await sendEmail({ to: order.email, subject: message.subject, text: `Hi ${first},\n\n${message.body}${signature()}` });
  if (kind === "confirmed") await db.order.update({ where: { id: order.id }, data: { confirmationSentAt: new Date() } });
}
