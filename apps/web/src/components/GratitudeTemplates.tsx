"use client"

import { useState } from "react"
import { FileText, Heart, Users, Trophy, Leaf, Clock, Sparkles, ChevronRight } from "lucide-react"

export interface GratitudeTemplate {
  id: string
  name: string
  category: 'daily' | 'relationships' | 'achievements' | 'nature' | 'mindfulness' | 'moments'
  description: string
  prompt: string
  placeholders: string[]
  example: string
  icon: React.ComponentType<{ className?: string }>
}

interface GratitudeTemplatesProps {
  isOpen: boolean
  onClose: () => void
  onTemplateSelect: (template: GratitudeTemplate) => void
  position?: { x: number, y: number }
  className?: string
}

// Comprehensive gratitude templates
const GRATITUDE_TEMPLATES: GratitudeTemplate[] = [
  // Daily Gratitude
  {
    id: 'daily-simple',
    name: 'Simple Daily Gratitude',
    category: 'daily',
    description: 'A simple way to express daily appreciation',
    prompt: 'Today I\'m grateful for {thing} because {reason}.',
    placeholders: ['thing', 'reason'],
    example: 'Today I\'m grateful for my morning coffee because it gives me energy and a moment of peace.',
    icon: Heart
  },
  {
    id: 'daily-three-things',
    name: 'Three Things',
    category: 'daily',
    description: 'List three things you\'re grateful for today',
    prompt: 'Three things I\'m grateful for today:\n1. {first_thing}\n2. {second_thing}\n3. {third_thing}',
    placeholders: ['first_thing', 'second_thing', 'third_thing'],
    example: 'Three things I\'m grateful for today:\n1. A sunny morning walk\n2. A call from an old friend\n3. A delicious homemade dinner',
    icon: FileText
  },
  {
    id: 'daily-moment',
    name: 'Grateful Moment',
    category: 'daily',
    description: 'Focus on a specific moment that brought joy',
    prompt: 'I felt most grateful today when {moment} happened. It made me feel {emotion} because {reason}.',
    placeholders: ['moment', 'emotion', 'reason'],
    example: 'I felt most grateful today when my child hugged me unexpectedly. It made me feel loved because it reminded me of the pure joy in simple gestures.',
    icon: Clock
  },

  // Relationships
  {
    id: 'relationship-appreciation',
    name: 'Person Appreciation',
    category: 'relationships',
    description: 'Express gratitude for someone special',
    prompt: 'I\'m grateful for {person} because they {action_or_quality}. They make my life better by {impact}.',
    placeholders: ['person', 'action_or_quality', 'impact'],
    example: 'I\'m grateful for my partner because they always listen without judgment. They make my life better by creating a safe space where I can be myself.',
    icon: Users
  },
  {
    id: 'relationship-memory',
    name: 'Shared Memory',
    category: 'relationships',
    description: 'Appreciate a memory with someone',
    prompt: 'I\'m grateful for the time when {person} and I {shared_experience}. It meant so much because {significance}.',
    placeholders: ['person', 'shared_experience', 'significance'],
    example: 'I\'m grateful for the time when my sister and I watched the sunrise together. It meant so much because we rarely get quiet moments to just be present with each other.',
    icon: Heart
  },

  // Achievements
  {
    id: 'achievement-progress',
    name: 'Personal Progress',
    category: 'achievements',
    description: 'Celebrate your growth and achievements',
    prompt: 'I\'m grateful for my progress in {area}. Looking back, I\'ve grown by {growth} and I\'m proud that {accomplishment}.',
    placeholders: ['area', 'growth', 'accomplishment'],
    example: 'I\'m grateful for my progress in learning guitar. Looking back, I\'ve grown by practicing consistently and I\'m proud that I can now play my favorite song.',
    icon: Trophy
  },
  {
    id: 'achievement-challenge',
    name: 'Overcoming Challenges',
    category: 'achievements',
    description: 'Appreciate lessons from difficult times',
    prompt: 'I\'m grateful for overcoming {challenge} because it taught me {lesson} and made me {stronger_quality}.',
    placeholders: ['challenge', 'lesson', 'stronger_quality'],
    example: 'I\'m grateful for overcoming my fear of public speaking because it taught me that courage grows with practice and made me more confident in expressing my ideas.',
    icon: Sparkles
  },

  // Nature & Environment
  {
    id: 'nature-beauty',
    name: 'Natural Beauty',
    category: 'nature',
    description: 'Appreciate the beauty of nature around you',
    prompt: 'I\'m grateful for {natural_element} because it reminds me of {feeling_or_truth}. Today it made me feel {emotion}.',
    placeholders: ['natural_element', 'feeling_or_truth', 'emotion'],
    example: 'I\'m grateful for the changing leaves because they remind me that change can be beautiful. Today they made me feel peaceful and connected to the seasons.',
    icon: Leaf
  },

  // Mindfulness & Present Moment
  {
    id: 'mindfulness-senses',
    name: 'Sensory Gratitude',
    category: 'mindfulness',
    description: 'Focus on what you can see, hear, feel, taste, or smell',
    prompt: 'Right now, I\'m grateful for what I can {sense}: {sensory_experience}. It brings me {feeling} and reminds me to {mindful_awareness}.',
    placeholders: ['sense', 'sensory_experience', 'feeling', 'mindful_awareness'],
    example: 'Right now, I\'m grateful for what I can hear: birds singing outside my window. It brings me peace and reminds me to pause and appreciate the present moment.',
    icon: Sparkles
  },
  {
    id: 'mindfulness-breath',
    name: 'Breath & Being',
    category: 'mindfulness',
    description: 'Appreciate the simple act of being alive',
    prompt: 'I\'m grateful for this breath, this moment, and {simple_thing}. It reminds me that {profound_truth}.',
    placeholders: ['simple_thing', 'profound_truth'],
    example: 'I\'m grateful for this breath, this moment, and the warmth of sunlight on my face. It reminds me that joy can be found in the simplest experiences.',
    icon: Heart
  },

  // Special Moments
  {
    id: 'moments-unexpected',
    name: 'Unexpected Joy',
    category: 'moments',
    description: 'Capture surprising moments of happiness',
    prompt: 'I wasn\'t expecting to feel grateful today, but then {unexpected_event} happened and it {impact}. It reminded me that {insight}.',
    placeholders: ['unexpected_event', 'impact', 'insight'],
    example: 'I wasn\'t expecting to feel grateful today, but then a stranger smiled at me on the street and it brightened my entire morning. It reminded me that small acts of kindness create ripples of joy.',
    icon: Sparkles
  }
]

// Category information
const CATEGORIES = {
  daily: { name: 'Daily', icon: Heart, color: 'purple' },
  relationships: { name: 'Relationships', icon: Users, color: 'pink' },
  achievements: { name: 'Achievements', icon: Trophy, color: 'yellow' },
  nature: { name: 'Nature', icon: Leaf, color: 'green' },
  mindfulness: { name: 'Mindfulness', icon: Sparkles, color: 'blue' },
  moments: { name: 'Moments', icon: Clock, color: 'indigo' }
}

export default function GratitudeTemplates({
  isOpen,
  onClose,
  onTemplateSelect,
  position = { x: 0, y: 0 },
  className = ""
}: GratitudeTemplatesProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof CATEGORIES>('daily')
  const [selectedTemplate, setSelectedTemplate] = useState<GratitudeTemplate | null>(null)

  if (!isOpen) return null

  const filteredTemplates = GRATITUDE_TEMPLATES.filter(
    template => template.category === activeCategory
  )

  const handleTemplateSelect = (template: GratitudeTemplate) => {
    setSelectedTemplate(template)
  }

  const handleUseTemplate = () => {
    if (selectedTemplate) {
      onTemplateSelect(selectedTemplate)
      onClose()
    }
  }

  // Calculate position to keep picker in viewport
  const pickerStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 500), // 500px is picker width
    top: Math.min(position.y, window.innerHeight - 600), // 600px is picker height
    zIndex: 1000
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Template Picker */}
      <div
        style={pickerStyle}
        className={`bg-white border border-gray-200 rounded-xl shadow-xl w-[500px] h-[600px] flex flex-col template-picker ${className}`}
        data-templates-modal
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Gratitude Templates</h3>
          <p className="text-sm text-gray-600">Choose a template to help structure your gratitude post</p>
        </div>

        {/* Category Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-100">
          {Object.entries(CATEGORIES).map(([key, category]) => {
            const IconComponent = category.icon
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveCategory(key as keyof typeof CATEGORIES)
                  setSelectedTemplate(null)
                }}
                className={`flex-shrink-0 flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeCategory === key
                    ? 'text-purple-700 border-b-2 border-purple-500 bg-purple-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <IconComponent className="h-4 w-4" />
                <span>{category.name}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Template List */}
          <div className="w-1/2 border-r border-gray-100 overflow-y-auto">
            <div className="p-3 space-y-2">
              {filteredTemplates.map((template) => {
                const IconComponent = template.icon
                return (
                  <button
                    key={template.id}
                    onClick={() => handleTemplateSelect(template)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedTemplate?.id === template.id
                        ? 'border-purple-300 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <IconComponent className="h-5 w-5 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 text-sm">{template.name}</h4>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{template.description}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Template Preview */}
          <div className="w-1/2 overflow-y-auto">
            {selectedTemplate ? (
              <div className="p-4">
                <div className="flex items-start space-x-3 mb-4">
                  <selectedTemplate.icon className="h-6 w-6 text-purple-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-gray-900">{selectedTemplate.name}</h4>
                    <p className="text-sm text-gray-600 mt-1">{selectedTemplate.description}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Template Structure */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Template Structure:</h5>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 font-mono">
                      {selectedTemplate.prompt}
                    </div>
                  </div>

                  {/* Placeholders */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Fill in these parts:</h5>
                    <div className="space-y-1">
                      {selectedTemplate.placeholders.map((placeholder) => (
                        <div key={placeholder} className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                          <span className="text-sm text-gray-700 font-mono">{placeholder}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Example */}
                  <div>
                    <h5 className="text-sm font-medium text-gray-900 mb-2">Example:</h5>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-gray-700">
                      {selectedTemplate.example}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Select a template to see preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-between items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUseTemplate}
            disabled={!selectedTemplate}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Use Template
          </button>
        </div>
      </div>
    </>
  )
}

// Export templates for use in other components
export { GRATITUDE_TEMPLATES, CATEGORIES }