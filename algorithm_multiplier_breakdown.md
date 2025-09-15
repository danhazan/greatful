# Algorithm Multiplier Breakdown & Real-World Examples

## Current Configuration (Development Environment)

### Base Scoring Weights
- **Hearts**: 1.2 points each
- **Reactions**: 1.8 points each  
- **Shares**: 5.0 points each
- **Photo bonus**: +1.5 points
- **Daily gratitude bonus**: +2.0 points

### Time Multipliers
- **Very recent (0-1 hour)**: 5.0x
- **Recent (1-6 hours)**: 2.0x
- **Older posts**: Gradual decay over 48 hours

### Own Post Multipliers
- **Very recent (0-5 minutes)**: 79.0x (75 + 4)
- **Decay period (5-15 minutes)**: 22.75x (exponential decay)
- **Older own posts (15+ minutes)**: 8.0x (4 + 4)

### Follow Relationship Multipliers (AFTER FIX)
- **Base multiplier**: 2.0x
- **New follow bonus**: 2.5x
- **Established follow bonus**: 2.0x
- **Mutual follow bonus**: 3.0x
- **Recent follow boost**: +0.5x (so 1.5x total)
- **High engagement bonus**: +1.0x (so 2.0x total)

## Real-World Examples

### Example 1: User's Own Post (Just Posted)
**Scenario**: Ruhama just posted "Grateful for morning coffee ☕"
- Base score: 0 (no engagement yet)
- Content bonus: 0 (spontaneous post, no photo)
- Own post base: +1.0 (minimum for own posts)
- Time multiplier: 6.0x (very recent)
- Own post multiplier: 79.0x (maximum visibility window)
- **Final Score**: (0 + 0 + 1) × 1.0 × 6.0 × 79.0 = **474 points**

### Example 2: User's Own Post (30 minutes old)
**Scenario**: Same post, but 30 minutes later with some engagement
- Base score: 3.6 (2 hearts × 1.2 + 1 reaction × 1.8)
- Content bonus: 0
- Own post base: +1.0
- Time multiplier: 2.0x (still recent)
- Own post multiplier: 8.0x (permanent advantage)
- **Final Score**: (3.6 + 0 + 1) × 1.0 × 2.0 × 8.0 = **73.6 points**

### Example 3: Followed User's Engaging Post
**Scenario**: Lisa's daily gratitude post with photo, posted 18 hours ago
- Base score: 18.0 (1 heart × 1.2 + 1 reaction × 1.8 + 3 shares × 5.0)
- Content bonus: 3.5 (photo +1.5 + daily +2.0)
- Follow relationship multiplier: 7.5x (2.5 base × 1.5 recency × 2.0 engagement)
- Time multiplier: 2.0x (still within recent window)
- **Final Score**: (18.0 + 3.5) × 7.5 × 2.0 = **322.5 points**

### Example 4: Non-Followed User's Viral Post
**Scenario**: Stranger's post with lots of engagement
- Base score: 50.0 (10 hearts × 1.2 + 20 reactions × 1.8 + 4 shares × 5.0)
- Content bonus: 3.5 (photo + daily gratitude)
- Relationship multiplier: 1.0x (no relationship)
- Time multiplier: 1.5x (older post)
- **Final Score**: (50.0 + 3.5) × 1.0 × 1.5 = **80.25 points**

## Ranking Analysis

Based on these examples, the feed order would be:
1. **Own post (just posted)**: 474 points ✅
2. **Followed user's engaging post**: 322.5 points ✅
3. **Non-followed viral post**: 80.25 points ✅
4. **Own post (30 min old)**: 73.6 points ✅

This creates the desired behavior:
- Recent own posts get highest priority
- Engaging content from followed users ranks well
- Viral content from strangers gets moderate visibility
- Older own posts still get some advantage

## Multiplier Impact Comparison

### Before Fix (Problematic)
- Follow relationship: **48.0x** (6.0 × 2.0 × 4.0)
- Own post (old): **8.0x**
- **Result**: Follow posts overpowered own posts

### After Fix (Balanced)
- Follow relationship: **7.5x** (2.5 × 1.5 × 2.0)
- Own post (recent): **79.0x**
- Own post (old): **8.0x**
- **Result**: Own posts get proper priority, follow posts reasonably boosted

## Edge Cases

### Very Active User
If someone has 100 hearts, 50 reactions, 10 shares:
- Base score: 100×1.2 + 50×1.8 + 10×5.0 = 260 points
- Even with no relationship bonus, this could score 260×2.0 = 520 points
- This would outrank older own posts (73.6) but not recent own posts (474)
- **This is reasonable** - truly viral content should be visible

### Mutual Follow with High Engagement
- Base multiplier: 3.0x (mutual follow)
- Recency boost: 1.5x
- Engagement bonus: 2.0x
- **Total**: 3.0 × 1.5 × 2.0 = **9.0x**
- Still much lower than recent own posts (79x) ✅

## Recommendations

The current multipliers create a good hierarchy:
1. **Recent own posts (0-15 min)**: 79x → 22x (highest priority)
2. **Mutual follows with engagement**: ~9x (good visibility)
3. **Regular follows**: ~5-7.5x (moderate boost)
4. **Older own posts**: 8x (permanent advantage)
5. **No relationship**: 1x (base visibility)

This ensures users see their content first while maintaining feed quality.