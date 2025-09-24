import { proxyApiRequest } from "./api-proxy";

export async function handleUserPostsRequest(request: any, userId?: string) {
  const requireAuth = typeof userId === "undefined" || userId === null;
  const path = userId ? `/api/v1/users/${userId}/posts` : `/api/v1/users/me/posts`;
  return proxyApiRequest(request, path, { requireAuth, forwardCookies: true, passthroughOn401: true });
}