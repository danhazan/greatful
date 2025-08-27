import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PostCard from '@/components/PostCard'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface Post {
  id: string
  content: string
  title?: string
  author: {
    id: string
    name: string
    image?: string
  }
  createdAt: string
  postType: "daily" | "photo" | "spontaneous"
  imageUrl?: string
  location?: string
  heartsCount?: number
  isHearted?: boolean
  reactionsCount?: number
  currentUserReaction?: string
}

interface PageProps {
  params: { id: string }
}

async function getPost(id: string): Promise<Post | null> {
  try {
    // Fetch post from backend without authentication for public viewing
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add cache control for better performance
      next: { revalidate: 60 } // Revalidate every minute
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error('Failed to fetch post')
    }

    const post = await response.json()

    // Transform the post to match the frontend format
    return {
      id: post.id,
      content: post.content,
      title: post.title,
      author: {
        id: post.author.id.toString(),
        name: post.author.name || post.author.username,
        image: post.author.profile_image_url
      },
      createdAt: post.created_at,
      postType: post.post_type,
      imageUrl: post.image_url,
      location: post.location,
      heartsCount: post.hearts_count || 0,
      isHearted: false, // Not authenticated, so can't be hearted
      reactionsCount: post.reactions_count || 0,
      currentUserReaction: undefined // Not authenticated, so no user reaction
    }
  } catch (error) {
    console.error('Error fetching post:', error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPost(params.id)

  if (!post) {
    return {
      title: 'Post Not Found - Grateful',
      description: 'The requested gratitude post could not be found.',
    }
  }

  // Create SEO-friendly metadata
  const title = post.title 
    ? `${post.title} - Grateful` 
    : `Gratitude post by ${post.author.name} - Grateful`
  
  const description = post.content.length > 160 
    ? `${post.content.substring(0, 157)}...` 
    : post.content

  const metadata: Metadata = {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      authors: [post.author.name],
      publishedTime: post.createdAt,
      images: post.imageUrl ? [
        {
          url: post.imageUrl,
          width: 1200,
          height: 630,
          alt: `Gratitude post by ${post.author.name}`,
        }
      ] : undefined,
    },
    twitter: {
      card: post.imageUrl ? 'summary_large_image' : 'summary',
      title,
      description,
      images: post.imageUrl ? [post.imageUrl] : undefined,
    },
    alternates: {
      canonical: `/post/${post.id}`,
    },
  }

  return metadata
}

export default async function PostPage({ params }: PageProps) {
  const post = await getPost(params.id)

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">💜</span>
              <h1 className="text-xl font-bold text-gray-900">Grateful</h1>
            </div>
            <div className="text-sm text-gray-600">
              Shared gratitude post
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <PostCard 
            post={post}
            // No currentUserId since this is public viewing
            // No interaction handlers since user is not authenticated
          />
        </div>

        {/* Call to Action */}
        <div className="mt-8 text-center">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Join the Grateful Community
            </h2>
            <p className="text-gray-600 mb-4">
              Share your own gratitude and connect with others spreading positivity.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="/auth/signup"
                className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition-colors"
              >
                Sign Up
              </a>
              <a
                href="/auth/login"
                className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors"
              >
                Log In
              </a>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-600">
            <p>© 2025 Grateful. Spreading positivity, one gratitude at a time.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}