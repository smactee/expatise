// middleware.ts (project root)
import type { NextRequest } from "next/server";
import { proxy } from "./proxy";

export async function middleware(req: NextRequest) {
  return proxy(req);
}

export { config } from "./proxy";
