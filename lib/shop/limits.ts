// Shop limits shared by the server and the cart in the browser.

/** Shown as "Only a few left" at or below this many in stock. */
export const LOW_STOCK_AT = 3;
/** The most of one item a cart or order can hold. */
export const MAX_PER_ITEM = 20;
/** Stripe won't take a card payment under 50 cents. */
export const STRIPE_MINIMUM_CENTS = 50;
