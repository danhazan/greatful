import { NextResponse } from "next/server";
import { proxyApiRequest } from "./api-proxy";
import { normalizeUserData } from "@/utils/userDataMapping";

export async function handleUserProfileGetRequest(request: any, userId?: string) {
  // userId present => public profile endpoint -> do NOT require auth
  // userId absent => /me/profile -> require auth
  const requireAuth = typeof userId === "undefined" || userId === null;

  const path = userId ? `/api/v1/users/${userId}/profile` : `/api/v1/users/me/profile`;

  const response = await proxyApiRequest(request, path, { requireAuth, forwardCookies: true, passthroughOn401: true });
  
  // If the response is successful, normalize the user data
  if (response.ok) {
    try {
      // Clone the response to avoid consuming it twice
      const responseClone = response.clone();
      const responseData = await responseClone.json();
      
      // Check if response has the expected structure with 'data' field
      if (responseData && responseData.data) {
        const normalizedUserData = normalizeUserData(responseData.data);
        const normalizedResponse = {
          ...responseData,
          data: normalizedUserData
        };
        
        // Debug logging in development
        if (process.env.NODE_ENV === 'development') {
          console.log('User profile API - Original user data:', responseData.data);
          console.log('User profile API - Normalized user data:', normalizedUserData);
        }
        
        return NextResponse.json(normalizedResponse, { 
          status: response.status,
          headers: response.headers 
        });
      } else {
        // If no 'data' field, normalize the entire response (fallback)
        const normalizedData = normalizeUserData(responseData);
        
        if (process.env.NODE_ENV === 'development') {
          console.log('User profile API - Fallback normalization:', normalizedData);
        }
        
        return NextResponse.json(normalizedData, { 
          status: response.status,
          headers: response.headers 
        });
      }
    } catch (error) {
      console.error('Error normalizing user profile data:', error);
      // If JSON parsing fails, return the original response
      return response;
    }
  }
  
  return response;
}

/**
 * Shared handler for user profile PUT requests
 * Only supports /me/profile endpoint (always requires auth)
 */
export async function handleUserProfilePutRequest(request: any) {
  return proxyApiRequest(request, `/api/v1/users/me/profile`, { requireAuth: true, forwardCookies: true, passthroughOn401: true });
}