import { NextResponse } from "next/server";

export type BazaarErrorCode =
  | "BAZAAR_UNAUTHENTICATED"
  | "BAZAAR_FORBIDDEN"
  | "BAZAAR_VALIDATION"
  | "BAZAAR_INVALID_DATES"
  | "BAZAAR_INVALID_QUANTITY"
  | "BAZAAR_NOT_FOUND"
  | "BAZAAR_ITEM_NOT_FOUND"
  | "BAZAAR_INVALID_STATE"
  | "BAZAAR_INSUFFICIENT_STOCK"
  | "BAZAAR_LIMIT_REACHED"
  | "BAZAAR_DUPLICATE"
  | "BAZAAR_INTERNAL";

export class BazaarError extends Error {
  code: BazaarErrorCode;
  status: number;
  details?: unknown;

  constructor(code: BazaarErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "BazaarError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function jsonError(
  code: BazaarErrorCode,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details,
      },
    },
    { status }
  );
}

export function mapDbError(err: unknown): { code: BazaarErrorCode; message: string; status: number } {
  if (!err || typeof err !== "object") {
    return { code: "BAZAAR_INTERNAL", message: "An unexpected error occurred", status: 500 };
  }

  const errorObj = err as { code?: string; message?: string; details?: string };
  const msg = errorObj.message || "";

  if (msg.includes("BAZAAR_ITEM_NOT_FOUND")) {
    return { code: "BAZAAR_ITEM_NOT_FOUND", message: "Item not found or inactive", status: 404 };
  }
  if (msg.includes("BAZAAR_NOT_FOUND")) {
    return { code: "BAZAAR_NOT_FOUND", message: "Requested record not found", status: 404 };
  }
  if (msg.includes("BAZAAR_INSUFFICIENT_STOCK")) {
    return { code: "BAZAAR_INSUFFICIENT_STOCK", message: "Not enough available units in stock", status: 409 };
  }
  if (msg.includes("BAZAAR_INVALID_STATE")) {
    return { code: "BAZAAR_INVALID_STATE", message: "Action is not permitted in the current request status", status: 409 };
  }
  if (msg.includes("BAZAAR_LIMIT_REACHED")) {
    return { code: "BAZAAR_LIMIT_REACHED", message: "Maximum active requests limit reached", status: 409 };
  }
  if (msg.includes("BAZAAR_INVALID_DATES")) {
    return { code: "BAZAAR_INVALID_DATES", message: "Invalid loan dates provided", status: 400 };
  }
  if (msg.includes("BAZAAR_INVALID_QUANTITY")) {
    return { code: "BAZAAR_INVALID_QUANTITY", message: "Invalid quantity provided", status: 400 };
  }

  // Postgres SQLSTATE codes
  if (errorObj.code === "23505") {
    return { code: "BAZAAR_DUPLICATE", message: "A record with this name or key already exists", status: 409 };
  }
  if (errorObj.code === "23503") {
    return { code: "BAZAAR_NOT_FOUND", message: "Referenced resource does not exist", status: 404 };
  }
  if (errorObj.code === "23514") {
    return { code: "BAZAAR_INVALID_QUANTITY", message: "Stock quantity constraints violated", status: 400 };
  }

  return { code: "BAZAAR_INTERNAL", message: "Database operation failed", status: 500 };
}
