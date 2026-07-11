import type { NextRequest } from "next/server";
import { DELETE as deleteContent, GET as getContent, POST as postContent, PUT as putContent } from "../content/[resource]/route";

const context = { params: Promise.resolve({ resource: "events" }) };

export function GET(request: NextRequest) {
  return getContent(request, context);
}

export function POST(request: NextRequest) {
  return postContent(request, context);
}

export function PUT(request: NextRequest) {
  return putContent(request, context);
}

export function DELETE(request: NextRequest) {
  return deleteContent(request, context);
}
