import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z, type ZodType } from "zod";
import { prisma, type Db } from "@/lib/db";
import { requireMember, requireStaff, type MemberActor, type StaffActor } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { enforceRateLimit, clientIp, type RateLimitRule } from "@/lib/rate-limit";
import { ApiError, type ApiErrorBody } from "./errors";
import { gym } from "@/lib/config";
import { addCalendarDays, zonedTimeToUtc } from "@/lib/dates";

const MAX_BODY_BYTES = 64 * 1024;
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type Params = Record<string, string>;
type RouteContext = { params: Promise<Params> };

interface BaseArgs<B, Q> {
  request: Request;
  params: Params;
  body: B;
  query: Q;
  db: Db;
}

interface RouteOptions<B, Q> {
  body?: ZodType<B>;
  query?: ZodType<Q>;
  rateLimit?: RateLimitRule;
}

export function json<T>(data: T, status = 200, headers?: HeadersInit) {
  return NextResponse.json(data, { status, headers });
}

export function errorResponse(error: ApiError) {
  const body: ApiErrorBody = { error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } };
  return NextResponse.json(body, { status: error.status });
}

// Blocks cross-site form posts: a mutating request from a browser must come
// from this site's origin, and must send JSON (which a plain HTML form or a
// no-preflight fetch from another site cannot do).
export function assertSameOrigin(request: Request) {
  if (!MUTATING.has(request.method)) return;
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") throw new ApiError("forbidden", "Cross-site request blocked.");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new ApiError("forbidden", "Cross-site request blocked.");
    }
    if (originHost !== host) throw new ApiError("forbidden", "Cross-site request blocked.");
  }
}

// The request's media type, exactly: "text/plain; x=application/json" isn't
// JSON (R-80).
function isJson(request: Request) {
  return (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() === "application/json";
}

function hasBody(request: Request) {
  const length = request.headers.get("content-length");
  return length !== null ? Number(length) > 0 : request.body !== null;
}

// Reads the body as text, refusing it as soon as it passes `limit` bytes
// rather than after reading it all (R-79).
export async function readBodyText(request: Request, limit = MAX_BODY_BYTES): Promise<string> {
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new ApiError("payload_too_large", "Request body is too large.");
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new ApiError("payload_too_large", "Request body is too large.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readJsonBody<B>(request: Request, schema: ZodType<B> | undefined): Promise<B> {
  if (!schema) return undefined as B;
  if (!isJson(request)) throw new ApiError("bad_request", "Send the request body as JSON.");
  const text = await readBodyText(request);
  let raw: unknown;
  try {
    raw = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("bad_request", "Request body isn't valid JSON.");
  }
  return parseWith(schema, raw);
}

export function parseWith<T>(schema: ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    throw new ApiError("validation_failed", "Some fields need attention.", fields);
  }
  return result.data;
}

function toResponse(result: unknown): Response {
  if (result instanceof Response) return result;
  return json(result ?? { ok: true });
}

function handleError(error: unknown): Response {
  if (error instanceof ApiError) return errorResponse(error);
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return errorResponse(new ApiError("not_found", "That record doesn't exist."));
    if (error.code === "P2002") return errorResponse(new ApiError("conflict", "That already exists."));
    if (error.code === "P2003") return errorResponse(new ApiError("validation_failed", "Something this refers to doesn't exist. Reload and try again."));
  }
  // Only the error's name and Prisma code: messages can contain personal
  // data from the query (R-81).
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? ` ${error.code}` : "";
  console.error(`Unhandled route error: ${error instanceof Error ? error.name : "unknown"}${code}`);
  return errorResponse(new ApiError("internal", "Something went wrong. Please try again."));
}

// Path segments are IDs or slugs; anything else can't match a record.
const PARAM = /^[A-Za-z0-9_-]{1,64}$/;

// Checks that don't depend on who is calling: origin, rate limit, path
// parameters, and that a mutating request with a body sends JSON even when
// the route takes no body (R-80, R-83).
async function prepare(request: Request, context: RouteContext, opts: RouteOptions<unknown, unknown>) {
  assertSameOrigin(request);
  if (opts.rateLimit) await enforceRateLimit(opts.rateLimit, clientIp(request));
  if (MUTATING.has(request.method) && !opts.body && hasBody(request) && !isJson(request)) {
    throw new ApiError("bad_request", "Send the request body as JSON.");
  }
  const params = context?.params ? await context.params : {};
  if (Object.values(params).some((v) => !PARAM.test(v))) throw new ApiError("not_found", "That record doesn't exist.");
  return params;
}

function parseQuery<Q>(request: Request, schema: ZodType<Q> | undefined): Q {
  return schema ? parseWith(schema, Object.fromEntries(new URL(request.url).searchParams.entries())) : (undefined as Q);
}

export function publicRoute<B = undefined, Q = undefined>(
  opts: RouteOptions<B, Q>,
  handler: (args: BaseArgs<B, Q>) => Promise<unknown>
) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const params = await prepare(request, context, opts);
      const query = parseQuery(request, opts.query);
      const body = await readJsonBody(request, opts.body);
      return toResponse(await handler({ request, params, body, query, db: prisma }));
    } catch (error) {
      return handleError(error);
    }
  };
}

// Staff and member routes authenticate before validating the query or body,
// so callers who aren't allowed learn nothing from validation errors (R-83).
export function staffRoute<B = undefined, Q = undefined>(
  opts: RouteOptions<B, Q> & { permission: Permission },
  handler: (args: BaseArgs<B, Q> & { staff: StaffActor }) => Promise<unknown>
) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const params = await prepare(request, context, opts);
      const staff = await requireStaff(request, opts.permission);
      const query = parseQuery(request, opts.query);
      const body = await readJsonBody(request, opts.body);
      return toResponse(await handler({ request, params, body, query, db: prisma, staff }));
    } catch (error) {
      return handleError(error);
    }
  };
}

export function memberRoute<B = undefined, Q = undefined>(
  opts: RouteOptions<B, Q>,
  handler: (args: BaseArgs<B, Q> & { member: MemberActor }) => Promise<unknown>
) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const params = await prepare(request, context, opts);
      const member = await requireMember(request);
      const query = parseQuery(request, opts.query);
      const body = await readJsonBody(request, opts.body);
      return toResponse(await handler({ request, params, body, query, db: prisma, member }));
    } catch (error) {
      return handleError(error);
    }
  };
}

// Shared field schemas.
export const zId = z.string().min(1).max(64);
export const zEmail = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address").max(254));
export const zName = z.string().trim().min(1, "Required").max(120);
export const zPassword = z.string().min(10, "Use at least 10 characters").max(200);
export const zCents = z.number().int().nonnegative().max(100_000_00);

// A date someone picked (YYYY-MM-DD) means midnight at the gym, not midnight
// UTC (R-13). A full timestamp with an offset is taken as given.
export const zGymDate = z.union([
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((d) => zonedTimeToUtc(d, "00:00", gym.business.timezone)),
  z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
]);

// The exclusive end of a gym-local day: a plain YYYY-MM-DD becomes the next
// day's gym-local midnight, so "to 3 October" includes all of 3 October in
// the gym's time zone, not the server's (R-108).
export const zGymDateEnd = z.union([
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .transform((d) => zonedTimeToUtc(addCalendarDays(d, 1), "00:00", gym.business.timezone)),
  z.iso.datetime({ offset: true }).transform((s) => new Date(s)),
]);
