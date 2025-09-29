"use client"

import OptimizedPostImage from "./OptimizedPostImage"

// Test images with different dimensions
const testImages = [
  {
    name: "Very Wide (Panoramic)",
    src: "https://picsum.photos/1200/300", // 4:1 aspect ratio
    postType: "daily" as const
  },
  {
    name: "Very Tall (Portrait)",
    src: "https://picsum.photos/300/1200", // 1:4 aspect ratio
    postType: "photo" as const
  },
  {
    name: "Square",
    src: "https://picsum.photos/600/600", // 1:1 aspect ratio
    postType: "spontaneous" as const
  },
  {
    name: "Small Image",
    src: "https://picsum.photos/200/150", // Small dimensions
    postType: "daily" as const
  },
  {
    name: "Large Image",
    src: "https://picsum.photos/1600/1200", // Large dimensions
    postType: "photo" as const
  },
  {
    name: "Standard Landscape",
    src: "https://picsum.photos/800/600", // 4:3 aspect ratio
    postType: "spontaneous" as const
  }
]

export default function ImageSizingTest() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        PostCard Image Sizing Test
      </h1>
      
      {testImages.map((image, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-lg text-gray-900">
              {image.name}
            </h3>
            <p className="text-sm text-gray-500">
              Post Type: {image.postType} | Source: {image.src}
            </p>
          </div>
          
          <div className="p-4">
            <OptimizedPostImage
              src={image.src}
              alt={`Test image: ${image.name}`}
              postType={image.postType}
            />
          </div>
        </div>
      ))}
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          Testing Instructions
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Very wide images should be cropped to fit container height</li>
          <li>• Very tall images should be cropped to fit container width</li>
          <li>• Square images should maintain aspect ratio with appropriate sizing</li>
          <li>• Small images should be centered without excessive scaling</li>
          <li>• Large images should be cropped intelligently to fill container</li>
          <li>• All images should load lazily and show loading states</li>
        </ul>
      </div>
    </div>
  )
}