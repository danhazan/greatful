import { Metadata } from 'next'

const API_BASE_URL = process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface PageProps {
  params: { id: string }
}

async function getPostForMetadata(id: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/posts/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      next: { revalidate: 60 }
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching post for metadata:', error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const post = await getPostForMetadata(params.id)

  if (!post) {
    return {
      title: 'Post Not Found - Grateful',
      description: 'The requested gratitude post could not be found.',
    }
  }

  const title = post.title 
    ? `${post.title} - Grateful` 
    : `Gratitude post by ${post.author?.name || post.author?.username} - Grateful`
  
  const description = post.content?.length > 160 
    ? `${post.content.substring(0, 157)}...` 
    : post.content

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      authors: [post.author?.name || post.author?.username],
      publishedTime: post.created_at,
      images: post.image_url ? [
        {
          url: post.image_url,
          width: 1200,
          height: 630,
          alt: `Gratitude post by ${post.author?.name || post.author?.username}`,
        }
      ] : undefined,
    },
    twitter: {
      card: post.image_url ? 'summary_large_image' : 'summary',
      title,
      description,
      images: post.image_url ? [post.image_url] : undefined,
    },
    alternates: {
      canonical: `/post/${post.id}`,
    },
  }
}