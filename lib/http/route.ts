import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z, type ZodType } from "zod";
import { prisma, type Db } from "@/lib/db";
import { requireMember, requireStaff, type MemberActor, type StaffActor } from "@/lib/auth/session";
import type { Permission } from "@/lib/auth/permissions";
import { enforceRateLimit, clientIp, type RateLimitRule } from "@/lib/rate-limit";
import { ApiError, type ApiErrorBody } from "./errors";

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

async function readJsonBody<B>(request: Request, schema: ZodType<B> | undefined): Promise<B> {
  if (!schema) return undefined as B;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError("bad_request", "Send the request body as JSON.");
  }
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) throw new ApiError("payload_too_large", "Request body is too large.");
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
  }
  console.error("Unhandled route error:", error instanceof Error ? error.message : error);
  return errorResponse(new ApiError("internal", "Something went wrong. Please try again."));
}

async function prepare<B, Q>(request: Request, context: RouteContext, opts: RouteOptions<B, Q>) {
  assertSameOrigin(request);
  if (opts.rateLimit) await enforceRateLimit(opts.rateLimit, clientIp(request));
  const params = context?.params ? await context.params : {};
  const query = opts.query
    ? parseWith(opts.query, Object.fromEntries(new URL(request.url).searchParams.entries()))
    : (undefined as Q);
  return { params, query };
}

export function publicRoute<B = undefined, Q = undefined>(
  opts: RouteOptions<B, Q>,
  handler: (args: BaseArgs<B, Q>) => Promise<unknown>
) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const { params, query } = await prepare(request, context, opts);
      const body = await readJsonBody(request, opts.body);
      return toResponse(await handler({ request, params, body, query, db: prisma }));
    } catch (error) {
      return handleError(error);
    }
  };
}

export function staffRoute<B = undefined, Q = undefined>(
  opts: RouteOptions<B, Q> & { permission: Permission },
  handler: (args: BaseArgs<B, Q> & { staff: StaffActor }) => Promise<unknown>
) {
  return async (request: Request, context: RouteContext): Promise<Response> => {
    try {
      const { params, query } = await prepare(request, context, opts);
      // Authorise before reading the body, so unauthorised callers learn
      // nothing from validation errors.
      const staff = await requireStaff(request, opts.permission);
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
      const { params, query } = await prepare(request, context, opts);
      const member = await requireMember(request);
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
