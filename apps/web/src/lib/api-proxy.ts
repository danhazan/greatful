import { NextResponse } from "next/server";
import { transformApiResponse } from './caseTransform';

const API_BASE_URL = (process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

type ProxyOptions = {
  requireAuth?: boolean;       // if true -> return 401 early when no auth header
  forwardCookies?: boolean;    // forward Cookie header if present
  passthroughOn401?: boolean;  // if true -> forward backend 401 instead of returning early
  transform?: boolean;         // if true -> transform snake_case to camelCase (default: true)
};

function readHeader(request: any, key: string): string | undefined {
  // Support multiple request shapes (NextRequest Headers API or plain object)
  try {
    if (request?.headers?.get) {
      return request.headers.get(key) ?? request.headers.get(key.toLowerCase()) ?? undefined;
    }
    // fallback: request.headers could be a plain object
    if (request?.headers && typeof request.headers === "object") {
      // header keys sometimes lowercased
      return request.headers[key] ?? request.headers[key.toLowerCase()];
    }
  } catch (e) {
    // ignore
  }
  return undefined;
}

export async function proxyApiRequest(request: any, backendPath: string, opts: ProxyOptions = {}) {
  const { requireAuth = false, forwardCookies = true, passthroughOn401 = false, transform = true } = opts;

  // read incoming headers robustly
  const incomingAuth = readHeader(request, "authorization");
  const incomingCookie = readHeader(request, "cookie");
  const incomingContentType = readHeader(request, "content-type") || "application/json";



  // if we require auth for this proxy call, enforce it early (unless passthroughOn401 is desired)
  if (requireAuth && !incomingAuth) {
    return NextResponse.json({ error: "Authorization header required" }, { status: 401 });
  }

  // Build outgoing headers carefully. Use Headers to avoid accidental undefined values.
  const outgoingHeaders = new Headers();

  // Copy relevant incoming headers to outgoing (avoid Host / Connection)
  try {
    if (request?.headers?.forEach) {
      // NextRequest Headers-like
      request.headers.forEach((value: string, key: string) => {
        const k = key.toLowerCase();
        if (k === "host" || k === "connection" || k === "content-length") return;
        outgoingHeaders.set(key, value);
      });
    } else if (request?.headers && typeof request.headers === "object") {
      // plain object
      Object.entries(request.headers).forEach(([k, v]) => {
        const key = k.toLowerCase();
        if (key === "host" || key === "connection" || key === "content-length") return;
        if (typeof v === "string") outgoingHeaders.set(k, v);
      });
    }
  } catch (e) {
    console.warn("[proxyApiRequest] header copy failed", e);
  }

  // Ensure essential headers are set/normalized:
  outgoingHeaders.set("Content-Type", incomingContentType);

  // Explicitly set Authorization if present (ensures casing is "Authorization")
  if (incomingAuth) {
    outgoingHeaders.set("Authorization", incomingAuth);
  }

  // Forward cookies if requested
  if (forwardCookies && incomingCookie) {
    outgoingHeaders.set("Cookie", incomingCookie);
  }

  // Build backend URL
  const url = `${API_BASE_URL}${backendPath.startsWith("/") ? backendPath : `/${backendPath}`}`;

  // Prepare request body for non-GET/HEAD
  let body: BodyInit | undefined = undefined;
  try {
    // For NextRequest, request.text() is available; for Node request, request.body may be present
    if ((request.method || "GET").toUpperCase() !== "GET" && (request.method || "GET").toUpperCase() !== "HEAD") {
      if (request.text) {
        body = await request.text();
      } else if (request.body) {
        body = request.body;
      }
    }
  } catch (e) {
    // ignore
  }

  // Make the backend call
  const resp = await fetch(url, {
    method: request.method ?? "GET",
    headers: outgoingHeaders,
    body: body || undefined,
    // don't use credentials: 'include' — we explicitly forwarded Cookie if needed
  });

  // Optional: if backend returns 401 and we want to pass it through to client, do it
  if (resp.status === 401 && passthroughOn401) {
    const text = await resp.text();
    return new NextResponse(text, {
      status: 401,
      headers: { "content-type": resp.headers.get("content-type") ?? "application/json" },
    });
  }

  // Return backend response body and status back to client
  const respText = await resp.text();
  
  // Transform response if requested
  if (transform) {
    try {
      const respData = JSON.parse(respText);
      const transformedData = transformApiResponse(respData);
      return new NextResponse(JSON.stringify(transformedData), {
        status: resp.status,
        headers: { "content-type": "application/json" },
      });
    } catch (e) {
      // If JSON parsing fails, return as-is
      return new NextResponse(respText, {
        status: resp.status,
        headers: { "content-type": resp.headers.get("content-type") ?? "application/json" },
      });
    }
  }
  
  return new NextResponse(respText, {
    status: resp.status,
    headers: { "content-type": resp.headers.get("content-type") ?? "application/json" },
  });
}

// Legacy compatibility - keep the old function name but use new implementation
export async function handleApiProxy(
  request: any, 
  backendPath: string,
  options: { requireAuth?: boolean; method?: string } = {}
) {
  return proxyApiRequest(request, backendPath, {
    requireAuth: options.requireAuth,
    forwardCookies: true,
    passthroughOn401: true
  });
}