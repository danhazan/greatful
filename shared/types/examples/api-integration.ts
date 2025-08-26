/**
 * Example of how to integrate shared types into API routes
 * This file demonstrates best practices for using shared types
 */

import { NextRequest, NextResponse } from 'next/server'
import { 
  AddReactionRequest,
  ReactionResponse,
  GetPostReactionsResponse,
  ApiErrorResponse,
  EmojiCode,
  ErrorType,
  HttpStatusCode
} from '../index'

// Example: Type-safe API route with shared types
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ReactionResponse | ApiErrorResponse>> {
  try {
    // Parse and validate request body with type safety
    const body: AddReactionRequest = await request.json()
    
    // Validate emoji code using shared enum
    if (!Object.values(EmojiCode).includes(body.emoji_code)) {
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorType.INVALID_EMOJI_CODE,
          message: `Invalid emoji code. Must be one of: ${Object.values(EmojiCode).join(', ')}`,
          details: {
            provided: body.emoji_code,
            valid_options: Object.values(EmojiCode)
          }
        },
        timestamp: new Date().toISOString()
      }, { status: HttpStatusCode.BAD_REQUEST })
    }

    // Forward to backend with type-safe request
    const response = await fetch(`${process.env.API_BASE_URL}/api/v1/posts/${params.id}/reactions`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorType.EXTERNAL_SERVICE_ERROR,
          message: errorData.detail || 'Failed to add reaction',
          details: errorData
        },
        timestamp: new Date().toISOString()
      }, { status: response.status })
    }

    // Type-safe response parsing
    const reactionData: ReactionResponse = await response.json()

    return NextResponse.json(reactionData, { status: HttpStatusCode.CREATED })

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorType.INTERNAL_ERROR,
        message: 'Internal server error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      },
      timestamp: new Date().toISOString()
    }, { status: HttpStatusCode.INTERNAL_SERVER_ERROR })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<GetPostReactionsResponse | ApiErrorResponse>> {
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/v1/posts/${params.id}/reactions`, {
      method: 'GET',
      headers: {
        'Authorization': request.headers.get('authorization') || '',
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json()
      return NextResponse.json({
        success: false,
        error: {
          code: ErrorType.EXTERNAL_SERVICE_ERROR,
          message: errorData.detail || 'Failed to fetch reactions',
          details: errorData
        },
        timestamp: new Date().toISOString()
      }, { status: response.status })
    }

    // Type-safe response parsing
    const reactions: ReactionResponse[] = await response.json()
    
    const responseData: GetPostReactionsResponse = {
      reactions,
      total_count: reactions.length
    }

    return NextResponse.json(responseData)

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: {
        code: ErrorType.INTERNAL_ERROR,
        message: 'Internal server error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      },
      timestamp: new Date().toISOString()
    }, { status: HttpStatusCode.INTERNAL_SERVER_ERROR })
  }
}

// Example: Type-safe React component using shared types
import React from 'react'

interface ReactionButtonProps {
  postId: string
  currentReaction?: EmojiCode
  onReactionChange: (emoji: EmojiCode | null) => Promise<void>
}

export const ReactionButton: React.FC<ReactionButtonProps> = ({
  postId,
  currentReaction,
  onReactionChange
}) => {
  const handleReactionClick = async (emoji: EmojiCode) => {
    try {
      const request: AddReactionRequest = { emoji_code: emoji }
      
      const response = await fetch(`/api/posts/${postId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorData: ApiErrorResponse = await response.json()
        console.error('Failed to add reaction:', errorData.error.message)
        return
      }

      const reactionData: ReactionResponse = await response.json()
      await onReactionChange(reactionData.emoji_code)
      
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }

  return (
    <div className="flex gap-2">
      {Object.values(EmojiCode).map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReactionClick(emoji)}
          className={`p-2 rounded ${currentReaction === emoji ? 'bg-purple-100' : 'bg-gray-100'}`}
        >
          {/* Emoji display logic */}
        </button>
      ))}
    </div>
  )
}

// Example: Type-safe service class
export class ReactionService {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  async addReaction(postId: string, emojiCode: EmojiCode): Promise<ReactionResponse> {
    const request: AddReactionRequest = { emoji_code: emojiCode }
    
    const response = await fetch(`${this.baseUrl}/posts/${postId}/reactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      const errorData: ApiErrorResponse = await response.json()
      throw new Error(errorData.error.message)
    }

    return response.json()
  }

  async getPostReactions(postId: string): Promise<GetPostReactionsResponse> {
    const response = await fetch(`${this.baseUrl}/posts/${postId}/reactions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (!response.ok) {
      const errorData: ApiErrorResponse = await response.json()
      throw new Error(errorData.error.message)
    }

    return response.json()
  }

  async removeReaction(postId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/posts/${postId}/reactions`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    if (!response.ok) {
      const errorData: ApiErrorResponse = await response.json()
      throw new Error(errorData.error.message)
    }
  }
}