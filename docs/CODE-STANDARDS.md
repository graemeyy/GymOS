# Code standards

The one standard for GymOS code. New code follows it; existing code is brought in line area by area (PR 5). When this document and the code disagree, the code is wrong. When this document is wrong, change it in the same pull request as the code, with a line in [DECISIONS.md](DECISIONS.md).

## 1. Architecture

**Layers, top to bottom.** Each layer only calls the one below it.

| Layer | Lives in | Does | Never |
|---|---|---|---|
| Pages and components | `app/**/page.tsx`, `components/` | Render, collect input, call the API (client) or a `lib` query (server) | Import Prisma or `lib/db`; contain business rules |
| Route handlers | `app/api/**/route.ts` | Authenticate, validate input, call one `lib` function, shape the response | Query the database directly; contain business rules |
| Domain modules | `lib/<domain>/` | Business rules and data access for one area | Read request objects or cookies; format for display |
| Data | `lib/db.ts` (Prisma) | The one Prisma client | Be imported outside `lib/` |

- **One data-access layer.** All Prisma calls live in `lib/<domain>/queries.ts` (reads) and `lib/<domain>/service.ts` (writes and rules). Route handlers and server components call those functions. Tests may use Prisma directly to arrange and assert.
- **Server components by default.** A page is a server component unless it needs state, effects or event handlers. Public pages, legal pages, the shop, and print views (invoices) are server components that call `lib` queries directly.
- **Client components for interactive screens.** The staff console and member app are interactive dashboards: their pages are client components that fetch the JSON API through `useResource` and change data through `useMutation` (section 4). Push `"use client"` as far down the tree as possible: a server page can render a client island.
- **Server-only modules.** `lib/db.ts` and `lib/env.ts` start with `import "server-only"`, so anything that reaches them from a client bundle fails the build. Scripts that load them run with `tsx --conditions=react-server`, and Vitest maps the marker to an empty module.
- **Client-safe modules** (`lib/format.ts`, labels, pricing, `lib/plans/perks.ts`, `lib/shop/limits.ts`, `lib/time.ts`, `lib/dates.ts`, `lib/money.ts`) never import server-only code. The browser gets the gym config through `lib/config/client.ts`, the same JSON without Zod; a test checks it matches the validated config.
- **Enforced by lint.** Pages, components and route handlers can't import `@/lib/db` or call `db.<model>` / `db.$transaction`. Client components, and everything in `components/` and `lib/client/`, can't import `@/lib/db`, `@/lib/env`, `@/lib/config`, `@/lib/http/route` or `@prisma/client` (type imports are fine). See `eslint.config.mjs`.
- **No server actions.** Every mutation goes through a route handler, so there is one authorisation path to audit (D-035).

## 2. Folders and names

```
app/                      routes only (pages, layouts, route handlers)
components/ui/            design-system primitives, no domain knowledge
components/<area>/        components for one area (admin, member, shop, public)
lib/<domain>/             schema.ts, queries.ts, service.ts, *.test.ts, small helpers
lib/http/                 route wrappers, errors
lib/client/               browser-only hooks and helpers
tests/integration/        API and database tests
tests/e2e/                Playwright flows
```

- Files and folders: `kebab-case`. React components: `PascalCase` exports from `kebab-case.tsx` files. Hooks: `useThing` in `use-thing.ts`.
- Names say what something is in the gym's words: `cancelMembership`, `memberShopDiscount`, not `handleData` or `processItem`.
- A function that reads is named for what it returns (`listPlans`, `getOrderForMember`); one that writes is a verb (`refundPayment`, `bookClass`).
- Money variables end in `Cents`. Dates end in `At` (instants) or are `Date`-typed local dates named `...Date`. Booleans read as questions (`isActive`, `hasCardOnFile`).
- Database identifiers keep their existing names (D-036); code and copy use Australian spelling.

## 3. TypeScript

- `strict` is on and stays on. No `any`, no `@ts-ignore`, no `as never`, no `as unknown as` outside tests and `lib/db.ts`.
- Non-null assertions (`!`) only right after a check the compiler can't see, with the check on the line above.
- **Zod at every boundary**, with types inferred from the schema (`z.infer<typeof Body>`), never written twice:
  - route bodies, query strings and path parameters, through the route wrappers;
  - environment variables (`lib/env.ts`, checked at startup);
  - the gym config (`lib/config/schema.ts`);
  - forms (the same schema the API uses, imported from `lib/<domain>/schema.ts`);
  - external payloads we rely on (Stripe objects are typed by the SDK and checked for the fields we use).
- Shared types live with their schema. Don't re-declare a type in a component that the API already defines; export it from `lib/<domain>/schema.ts` or `types.ts`.

## 4. Doing common things one way

| Task | The way |
|---|---|
| Read data in a server component | Call a `lib/<domain>/queries.ts` function |
| Read data in a client component | `useResource<T>(url)` from `lib/client/api.ts` (aborts stale requests, shows loading, error and empty states through `AsyncBlock`) |
| Change data from the browser | `useMutation` from `lib/client/api.ts`: one in-flight flag, the button gets `busy`, errors become field errors or a toast |
| API route | `publicRoute`, `memberRoute` or `staffRoute({ permission })` from `lib/http/route.ts`. Nothing else, except the Stripe webhook (raw body) |
| Return an error | `throw new ApiError(code, message, fields?)`. The wrapper turns it into `{ error: { code, message, fields } }` |
| Several writes that belong together | One `db.$transaction`, with `logAction(tx, ...)` inside it |
| Concurrency on one row | `SELECT ... FOR UPDATE` on that row inside the transaction, or a guarded `updateMany` |
| Forms | Controlled inputs with `TextField`/`SelectField`; field errors from the API's `fields`; submit button shows `busy` |
| Dates | `lib/time.ts` for constants and arithmetic, `lib/dates.ts` for gym-time-zone conversion, `lib/format.ts` for display |
| Money | `lib/money.ts` |
| Email | `sendEmail` from `lib/email`, called after the transaction commits |

## 5. Errors and logging

- User-facing messages are plain, specific and say what to do next: "That plan isn't available." not "Error 422".
- Never show or log a stack trace, a SQL statement, a token, a password, a card detail or a request body. Log the error's name and code and a short message of our own.
- Expected failures are `ApiError`s with the right code (`validation_failed`, `not_found`, `conflict`, `forbidden`, `unauthenticated`, `upstream_failed`, `not_configured`). Anything else is a bug and becomes a generic 500.
- Calls to Stripe or Resend that fail stop the change before the database is touched, and say so.
- Background jobs isolate each step: one failure is logged and the next step still runs.

## 6. Money and time

- **Money is integer cents in AUD everywhere**: database, API, functions. It's formatted only at the edge, with `formatAud`.
- Prices are GST-inclusive. GST is `gstFromInclusive` (1/11, rounded once per transaction). Partial refunds take their share of GST cumulatively so the parts add up to the whole.
- Percentages are applied with integer arithmetic.
- **Instants are UTC** in the database and API. A date the person picked (a pause start, a report range) is a local date in the gym's time zone and is converted with `zonedTimeToUtc` on the server.
- Never add 24 hours to get "tomorrow"; add a calendar day and convert, because daylight saving makes some days 23 or 25 hours long.
- No inline `86_400_000`. Use `DAY_MS` and friends from `lib/time.ts`.

## 7. React

- Effects list every dependency. If that causes loops, the design is wrong (move state or use a ref), not the dependency list.
- Every effect that starts something (a timer, a listener, a stream, a request) cleans it up.
- Every data view handles loading, empty and error states.
- Every button that sends a request shows `busy` and can't be pressed twice. Destructive actions ask first with `ConfirmDialog`.
- No `Date.now()`, `window` or `localStorage` during render; read them in effects or through `useSyncExternalStore`.
- Components stay small: a page over about 200 lines is split into sections in `components/<area>/`. One component per concern (a dialog, a panel, a row).
- Accessibility: every control has a label, live regions exist before they're used, focus moves into dialogs and returns afterwards, and the axe checks in the end-to-end suite stay at zero.

## 8. Comments and docs

- Comments explain **why**: a rule from the law, a Stripe quirk, a race being prevented, a decision with its ID. They don't narrate what the next line does or what changed ("now faster").
- No commented-out code. No `TODO` without an owner and reason (`TODO(owner): reason`), and preferably an issue instead.
- A decision that someone might reverse without knowing why goes in `docs/DECISIONS.md` with an ID, and the code comment cites it.

## 9. Tests

- **Tests sit next to the logic they cover**: `lib/<domain>/*.test.ts` for rules (Vitest), `*.test.tsx` beside a component or page for UI behaviour (Vitest in jsdom with Testing Library, `fetch` stubbed), `tests/integration/` for API and database behaviour, `tests/e2e/` for key user flows (Playwright with axe).
- `tests/integration/characterisation.test.ts` pins the shape of every GET response. Update its snapshot only for an intentional API change, and say so in the pull request.
- `tests/integration/atomic-*.test.ts` make the audit write fail and check the change was rolled back with it. A new write that logs an audit entry gets a case there.
- Anything touching money, sign-in or permissions has tests before it counts as done.
- Every bug fix has a regression test that fails without the fix.
- Before refactoring an area, pin its current behaviour with characterisation tests.
- Tests don't depend on each other or on the clock: create the data a test needs, and pass `now` into functions that use time.
- Fakes of external services check the shape of what they're sent (the Stripe fake rejects parameters Stripe would reject).

## 10. Tooling

- `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` and `npm run test:e2e` all pass before a push. CI runs all of them, plus `prisma validate`, a schema drift check and `npm run check:rollback` (every `down.sql` rolled back and re-applied).
- Dependencies are pinned to exact versions. Minor and patch updates go in freely after the checks pass; major updates get their own pull request.
- Database changes are additive migrations with a tested `down.sql`. Rollbacks never drop financial records; they move them to archive tables.
