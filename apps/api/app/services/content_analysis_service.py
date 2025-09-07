"""
Content Analysis Service for automatic post type detection.
"""

import logging
import re
from typing import Dict, Any, Optional
from app.core.service_base import BaseService
from app.models.post import PostType

logger = logging.getLogger(__name__)


class ContentAnalysisResult:
    """Result of content analysis with suggested post type and metadata."""
    
    def __init__(
        self,
        suggested_type: PostType,
        confidence: float,
        word_count: int,
        character_count: int,
        has_image: bool,
        character_limit: int,
        analysis_metadata: Dict[str, Any]
    ):
        self.suggested_type = suggested_type
        self.confidence = confidence
        self.word_count = word_count
        self.character_count = character_count
        self.has_image = has_image
        self.character_limit = character_limit
        self.analysis_metadata = analysis_metadata


class ContentAnalysisService(BaseService):
    """Service for analyzing post content and determining optimal post type."""
    
    # Character limits for each post type
    CHARACTER_LIMITS = {
        PostType.daily: 5000,  # Generous limit for thoughtful daily gratitudes
        PostType.photo: 0,     # Photo gratitude has no text - image only
        PostType.spontaneous: 200  # Quick appreciation notes
    }
    
    # Word count thresholds for type detection
    SPONTANEOUS_WORD_THRESHOLD = 20
    
    def analyze_content(
        self, 
        content: str, 
        has_image: bool = False
    ) -> ContentAnalysisResult:
        """
        Analyze post content and determine the optimal post type.
        
        Rules:
        1. If has_image and no text content -> photo gratitude
        2. If text content < 20 words -> spontaneous
        3. All others -> daily gratitude
        
        Args:
            content: The post content text
            has_image: Whether the post includes an image
            
        Returns:
            ContentAnalysisResult with suggested type and metadata
        """
        try:
            # Clean and analyze content
            cleaned_content = self._clean_content(content)
            word_count = self._count_words(cleaned_content)
            character_count = len(cleaned_content)
            
            # Determine post type based on rules
            suggested_type = self._determine_post_type(
                content=cleaned_content,
                word_count=word_count,
                has_image=has_image
            )
            
            # Calculate confidence based on how clearly the content fits the type
            confidence = self._calculate_confidence(
                suggested_type=suggested_type,
                word_count=word_count,
                has_image=has_image,
                character_count=character_count
            )
            
            # Get character limit for the suggested type
            character_limit = self.CHARACTER_LIMITS[suggested_type]
            
            # Create analysis metadata
            analysis_metadata = {
                "word_count": word_count,
                "character_count": character_count,
                "has_image": has_image,
                "content_length_category": self._get_content_length_category(word_count),
                "detection_rules_applied": self._get_applied_rules(
                    word_count, has_image, cleaned_content
                )
            }
            
            return ContentAnalysisResult(
                suggested_type=suggested_type,
                confidence=confidence,
                word_count=word_count,
                character_count=character_count,
                has_image=has_image,
                character_limit=character_limit,
                analysis_metadata=analysis_metadata
            )
            
        except Exception as e:
            logger.error(f"Error analyzing content: {e}")
            # Return safe default on error
            return ContentAnalysisResult(
                suggested_type=PostType.daily,
                confidence=0.5,
                word_count=0,
                character_count=len(content),
                has_image=has_image,
                character_limit=self.CHARACTER_LIMITS[PostType.daily],
                analysis_metadata={"error": str(e)}
            )
    
    def _clean_content(self, content: str) -> str:
        """Clean content for analysis by removing extra whitespace and mentions."""
        if not content:
            return ""
        
        # Remove extra whitespace
        cleaned = re.sub(r'\s+', ' ', content.strip())
        
        # Note: We keep mentions in the content for word counting
        # as they are part of the user's expression
        
        return cleaned
    
    def _count_words(self, content: str) -> int:
        """Count words in content, excluding mentions from word count."""
        if not content:
            return 0
        
        # Split by whitespace and filter out empty strings
        words = [word for word in content.split() if word.strip()]
        
        # Count words, treating mentions as single words
        # This gives a more accurate representation of content complexity
        return len(words)
    
    def _determine_post_type(
        self, 
        content: str, 
        word_count: int, 
        has_image: bool
    ) -> PostType:
        """
        Determine post type based on simplified content analysis rules.
        
        Simple Rules:
        1. Photo only (has image, no meaningful text) -> photo gratitude
        2. Just text under limit (< 20 words, no image) -> spontaneous
        3. All others -> daily gratitude (large text, or text+image)
        """
        
        # Rule 1: Photo only - has image and no meaningful text content
        if has_image and word_count == 0:
            return PostType.photo
        
        # Rule 2: Just text under limit - short text content without image
        if not has_image and word_count < self.SPONTANEOUS_WORD_THRESHOLD:
            return PostType.spontaneous
        
        # Rule 3: All others - large text, or any text+image combination
        return PostType.daily
    
    def _calculate_confidence(
        self,
        suggested_type: PostType,
        word_count: int,
        has_image: bool,
        character_count: int
    ) -> float:
        """
        Calculate confidence score for the suggested post type.
        
        Higher confidence for clear-cut cases, lower for edge cases.
        """
        confidence = 0.8  # Base confidence
        
        if suggested_type == PostType.photo:
            # High confidence for image posts with minimal text
            if has_image and word_count <= 3:
                confidence = 0.95
            elif has_image and word_count <= 5:
                confidence = 0.85
            else:
                confidence = 0.7
                
        elif suggested_type == PostType.spontaneous:
            # High confidence for very short text
            if word_count <= 10:
                confidence = 0.9
            elif word_count <= 15:
                confidence = 0.8
            else:
                confidence = 0.7  # Edge case near threshold
                
        elif suggested_type == PostType.daily:
            # High confidence for longer content
            if word_count >= 30:
                confidence = 0.9
            elif word_count >= self.SPONTANEOUS_WORD_THRESHOLD + 5:
                confidence = 0.85
            else:
                confidence = 0.75  # Just above spontaneous threshold
        
        # Adjust confidence based on character limits
        char_limit = self.CHARACTER_LIMITS[suggested_type]
        if character_count > char_limit:
            confidence *= 0.8  # Lower confidence if content exceeds limit
        
        return min(confidence, 1.0)
    
    def _get_content_length_category(self, word_count: int) -> str:
        """Categorize content length for metadata."""
        if word_count == 0:
            return "empty"
        elif word_count <= 5:
            return "very_short"
        elif word_count <= 15:
            return "short"
        elif word_count <= 30:
            return "medium"
        elif word_count <= 60:
            return "long"
        else:
            return "very_long"
    
    def _get_applied_rules(
        self, 
        word_count: int, 
        has_image: bool, 
        content: str
    ) -> list:
        """Get list of detection rules that were applied."""
        rules = []
        
        if has_image:
            rules.append("has_image_detected")
            if word_count <= 5:
                rules.append("minimal_text_with_image")
        
        if word_count < self.SPONTANEOUS_WORD_THRESHOLD:
            rules.append("short_text_content")
        
        if word_count >= self.SPONTANEOUS_WORD_THRESHOLD:
            rules.append("substantial_text_content")
        
        return rules
    
    def validate_content_for_type(
        self, 
        content: str, 
        post_type: PostType
    ) -> Dict[str, Any]:
        """
        Validate if content fits within the character limits for the given post type.
        
        Returns:
            Dict with validation result and details
        """
        character_count = len(content.strip())
        character_limit = self.CHARACTER_LIMITS[post_type]
        
        is_valid = character_count <= character_limit
        
        return {
            "is_valid": is_valid,
            "character_count": character_count,
            "character_limit": character_limit,
            "characters_over": max(0, character_count - character_limit),
            "characters_remaining": max(0, character_limit - character_count)
        }