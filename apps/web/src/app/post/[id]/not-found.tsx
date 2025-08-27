import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center px-4">
        <div className="mb-8">
          <span className="text-6xl">💜</span>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Post Not Found
        </h1>
        
        <p className="text-gray-600 mb-8">
          The gratitude post you're looking for doesn't exist or may have been removed.
        </p>
        
        <div className="space-y-4">
          <Link
            href="/feed"
            className="block bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
          >
            Explore Gratitude Posts
          </Link>
          
          <Link
            href="/"
            className="block text-purple-600 hover:text-purple-700 font-medium"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  )
}