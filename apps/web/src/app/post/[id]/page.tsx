import type { Metadata } from 'next'
import PostPageClient from './PostPageClient'
import { fetchPublicPost } from '@/lib/post-data'
import { buildPostMetadata } from '@/lib/post-metadata'

export const dynamic = 'force-dynamic'

interface PostPageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const post = await fetchPublicPost(params.id)
  return buildPostMetadata(post, params.id)
}

export default async function PostPage({ params }: PostPageProps) {
  const post = await fetchPublicPost(params.id)

  return <PostPageClient postId={params.id} bootstrapPost={post} />
}
