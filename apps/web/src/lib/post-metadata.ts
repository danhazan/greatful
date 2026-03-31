import type { Metadata } from 'next'

interface PreviewImage {
  url: string
  width?: number
  height?: number
}

function getAppBaseUrl(): string {
  return (process.env['NEXT_PUBLIC_APP_URL'] || 'http://localhost:3000').replace(/\/$/, '')
}

function getAbsolutePostUrl(postId: string): string {
  return `${getAppBaseUrl()}/post/${postId}`
}

function getPostTitle(post: any): string {
  return post.title
    ? `${post.title} - Grateful`
    : `Gratitude post by ${post.author?.displayName || post.author?.name || post.author?.username} - Grateful`
}

function getPostDescription(post: any): string {
  if (!post?.content) {
    return 'View this gratitude post on Grateful.'
  }

  return post.content.length > 160
    ? `${post.content.substring(0, 157)}...`
    : post.content
}

export function getPostPreviewImage(post: any): PreviewImage | undefined {
  if (Array.isArray(post?.images) && post.images.length > 0) {
    const allImagesHavePosition = post.images.every((image: any) => typeof image?.position === 'number')
    const primaryImage = allImagesHavePosition
      ? [...post.images].sort((left: any, right: any) => left.position - right.position)[0]
      : post.images[0]
    const url = primaryImage?.mediumUrl || primaryImage?.originalUrl || primaryImage?.thumbnailUrl

    if (url) {
      return {
        url,
        width: primaryImage?.width,
        height: primaryImage?.height,
      }
    }
  }

  if (post?.imageUrl) {
    return { url: post.imageUrl }
  }

  return undefined
}

export function buildPostMetadata(post: any | null, postId: string): Metadata {
  if (!post) {
    return {
      title: 'Post Not Found - Grateful',
      description: 'The requested gratitude post could not be found.',
      metadataBase: new URL(getAppBaseUrl()),
      alternates: {
        canonical: getAbsolutePostUrl(postId),
      },
      openGraph: {
        title: 'Post Not Found - Grateful',
        description: 'The requested gratitude post could not be found.',
        url: getAbsolutePostUrl(postId),
        type: 'article',
      },
      twitter: {
        card: 'summary',
        title: 'Post Not Found - Grateful',
        description: 'The requested gratitude post could not be found.',
      },
    }
  }

  const title = getPostTitle(post)
  const description = getPostDescription(post)
  const postUrl = getAbsolutePostUrl(post.id || postId)
  const previewImage = getPostPreviewImage(post)
  const publishedTime = post.createdAt

  return {
    metadataBase: new URL(getAppBaseUrl()),
    title,
    description,
    alternates: {
      canonical: postUrl,
    },
    openGraph: {
      title,
      description,
      url: postUrl,
      type: 'article',
      authors: [post.author?.displayName || post.author?.name || post.author?.username],
      publishedTime,
      images: previewImage ? [
        {
          url: previewImage.url,
          width: previewImage.width,
          height: previewImage.height,
          alt: `Gratitude post by ${post.author?.displayName || post.author?.name || post.author?.username}`,
        }
      ] : undefined,
    },
    twitter: {
      card: previewImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: previewImage ? [previewImage.url] : undefined,
    },
  }
}
