import type { NextRequest } from "next/server";
import { GET as getContent, PUT as putContent } from "../content/[resource]/route";

const context = { params: Promise.resolve({ resource: "contact_submissions" }) };

export function GET(request: NextRequest) {
  return getContent(request, context);
}

export function PUT(request: NextRequest) {
  return putContent(request, context);
}
