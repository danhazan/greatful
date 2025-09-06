# Post Type Detection and Categorization System

## Overview

The Grateful platform uses an intelligent post type detection system that automatically categorizes user content into three distinct post types based on content characteristics. This system ensures optimal display hierarchy and user experience while maintaining the platform's focus on gratitude expression.

## Post Types

### 1. Daily Gratitude Posts
- **Character Limit**: 5,000 characters
- **Display Prominence**: 3x larger display in feed
- **Purpose**: Thoughtful, reflective gratitude expressions
- **Typical Content**: Detailed reflections, meaningful experiences, deep appreciation

### 2. Photo Gratitude Posts  
- **Character Limit**: 0 characters (image only)
- **Display Prominence**: 2x boost display in feed
- **Purpose**: Visual gratitude expression through images
- **Typical Content**: Pure visual content without text

### 3. Spontaneous Text Posts
- **Character Limit**: 200 characters
- **Display Prominence**: Compact display in feed
- **Purpose**: Quick appreciation notes and brief gratitude moments
- **Typical Content**: Short, immediate gratitude expressions

## Detection Algorithm

### Classification Rules

The system uses a simple, reliable rule-based approach for post type detection:

```
1. Photo Only (has image, no meaningful text) → Photo Gratitude
2. Short Text (< 20 words, no image) → Spontaneous Text  
3. All Others (longer text, or any text + image) → Daily Gratitude
```

### Implementation Details

#### Backend Logic (`ContentAnalysisService`)
```python
def _determine_post_type(self, content: str, word_count: int, has_image: bool) -> PostType:
    # Rule 1: Photo only - has image and no meaningful text content
    if has_image and word_count == 0:
        return PostType.photo
    
    # Rule 2: Short text - use word count threshold for spontaneous posts
    if not has_image and word_count < SPONTANEOUS_WORD_THRESHOLD:  # 20 words
        return PostType.spontaneous
    
    # Rule 3: All others - longer text, or any text+image combination
    return PostType.daily
```

#### Frontend Logic (`CreatePostModal`)
```typescript
const analyzeContent = (content: string, hasImage: boolean) => {
  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length
  
  if (hasImage && wordCount === 0) {
    return { type: 'photo', limit: CHARACTER_LIMITS.photo }
  } else if (!hasImage && wordCount < 20) {
    return { type: 'spontaneous', limit: CHARACTER_LIMITS.spontaneous }
  } else {
    return { type: 'daily', limit: CHARACTER_LIMITS.daily }
  }
}
```

### Word Count Threshold

- **Spontaneous Threshold**: 20 words
- **Rationale**: Allows for meaningful short expressions while preventing very brief content from being classified as daily gratitude
- **Examples**:
  - "Grateful for coffee this morning!" (5 words) → Spontaneous
  - "Today I'm incredibly grateful for the opportunity to spend quality time with my family" (14 words) → Spontaneous  
  - "Today I'm incredibly grateful for the opportunity to spend quality time with my family and share meaningful conversations together" (20+ words) → Daily

## Character Limits Rationale

### Daily Gratitude: 5,000 Characters
- **Purpose**: Allow for deep, thoughtful reflection
- **Equivalent**: ~750-1,000 words of meaningful content
- **Database Safety**: Well within PostgreSQL TEXT limits (1GB capacity)
- **Performance**: Negligible impact on modern systems (~5KB per post)
- **User Experience**: Sufficient space for detailed gratitude journaling

### Photo Gratitude: 0 Characters
- **Purpose**: Pure visual gratitude expression
- **Philosophy**: Images should speak for themselves in photo posts
- **Clarity**: Clear distinction between post types
- **User Behavior**: Encourages intentional image selection

### Spontaneous Text: 200 Characters
- **Purpose**: Quick, immediate gratitude expressions
- **Equivalent**: ~30-40 words of brief content
- **Social Media Standard**: Similar to Twitter's original limit philosophy
- **User Experience**: Encourages concise, impactful expressions

## Confidence Scoring

The system calculates confidence scores for type detection to help with edge cases and future improvements:

### High Confidence Cases (0.85+)
- Image with no text → Photo (0.95)
- Very short text (≤10 words) → Spontaneous (0.9)
- Long text (≥30 words) → Daily (0.9)

### Medium Confidence Cases (0.7-0.85)
- Image with minimal text (≤5 words) → Photo (0.85)
- Short text (11-15 words) → Spontaneous (0.8)
- Medium text (20-29 words) → Daily (0.85)

### Lower Confidence Cases (0.7)
- Edge cases near thresholds
- Content that exceeds character limits
- Ambiguous content patterns

## User Experience

### Real-Time Detection
- Content is analyzed as users type
- Post type is displayed automatically: "Auto-detected as [Type]"
- Character limits update dynamically based on detected type
- Users can see the visual hierarchy their post will have

### Visual Feedback
- **Daily Gratitude**: "Thoughtful reflective content - 3x larger display"
- **Photo Gratitude**: "Image with caption - 2x boost display"  
- **Spontaneous Text**: "Quick appreciation note - Compact display"

### Character Count Display
- Shows current character count vs. limit: "150/5000"
- Color coding: Green (normal), Yellow (approaching limit), Red (over limit)
- Dynamic updates as content changes and type detection occurs

## Technical Implementation

### Backend Components
- `ContentAnalysisService`: Core analysis logic
- `PostType` enum: Type definitions
- Character limit constants and validation
- Confidence calculation algorithms

### Frontend Components  
- `CreatePostModal`: Real-time analysis and UI updates
- Character limit enforcement and display
- Visual feedback for detected post types
- Dynamic UI adaptation based on type

### Database Storage
- `post_type` field stores the final determined type
- Content analysis results can be cached for performance
- Character limits enforced at both client and server levels

## Future Enhancements

### Planned Improvements
- **Content Quality Scoring**: Analyze gratitude expression quality
- **Sentiment Analysis**: Detect emotional tone and positivity
- **Keyword Detection**: Identify gratitude-specific language patterns
- **User Pattern Learning**: Adapt to individual user posting patterns
- **Dynamic Limits**: Adjust limits based on user engagement and content quality

### Advanced Features
- **Multi-language Support**: Detection logic for different languages
- **Emoji Analysis**: Consider emoji content in type detection
- **Time-based Patterns**: Detect daily routine vs. spontaneous moments
- **Community Feedback**: Use engagement data to improve detection accuracy

## Testing and Validation

### Automated Testing
- Unit tests for all detection logic scenarios
- Edge case testing (empty content, special characters, etc.)
- Performance testing for real-time analysis
- Cross-platform consistency validation

### Content Analysis Accuracy
- Regular analysis of detection accuracy
- User feedback integration for improvements
- A/B testing for algorithm refinements
- Monitoring of edge cases and misclassifications

## Migration and Backward Compatibility

### Existing Posts
- Automatic analysis and type assignment for existing posts
- Preservation of original user intent where possible
- Gradual rollout with monitoring and adjustment
- Fallback to safe defaults for ambiguous cases

### Character Limit Migration
- Existing posts remain valid regardless of new limits
- No retroactive enforcement of new character limits
- Graceful handling of legacy content
- Clear communication to users about new capabilities

This post type detection system ensures that users can express their gratitude in the most appropriate format while maintaining the platform's visual hierarchy and user experience goals.