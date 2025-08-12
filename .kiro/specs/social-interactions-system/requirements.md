# Social Interactions System - Requirements Document

## Introduction

This specification defines the implementation of the comprehensive social interactions system for the Grateful platform, including emoji reactions, share functionality, mention system, and enhanced notifications. This system will transform the basic hearts-only interaction into a rich, engaging social experience that promotes positive community building and viral growth.

The system builds upon the existing stable authentication, navbar, and basic post functionality from the reference implementation, following the established purple-themed design patterns and component architecture.

## Requirements

### Requirement 1: Emoji Reaction System

**User Story:** As a user, I want to react to posts with positive emoji expressions beyond just hearts, so I can express different types of appreciation and emotional responses to gratitude posts.

#### Acceptance Criteria

1. WHEN a user views a post THEN they SHALL see a heart button and a reaction button (😊+) 
2. WHEN a user taps the reaction button for the first time THEN the system SHALL display an emoji picker with 8 positive emotions: 😍, 🤗, 🙏, 💪, 🌟, 🔥, 🥰, 👏
3. WHEN a user selects an emoji THEN the system SHALL record their reaction and update the UI to show the selected emoji
4. WHEN a user taps the reaction button after reacting THEN the system SHALL open a reaction viewer modal showing all users and their specific reactions
5. WHEN a user wants to change their reaction THEN they SHALL be able to select a different emoji from the picker
6. WHEN multiple users react to a post THEN the system SHALL display the total reaction count next to the reaction button
7. WHEN a user receives a reaction on their post THEN they SHALL receive an in-app notification
8. IF a user has already reacted with an emoji THEN they SHALL only be able to have one active emoji reaction per post (can change but not duplicate)

### Requirement 2: Share System with URL Generation

**User Story:** As a user, I want to share inspiring gratitude posts via URL copy, so I can spread positivity beyond the app to friends and family on other platforms.

#### Acceptance Criteria

1. WHEN a user clicks the share button on any post THEN the system SHALL display a share popup modal with multiple sharing options
2. WHEN a user selects "Copy Link" THEN the system SHALL generate a public URL in the format `/post/[post-id]` and copy it to clipboard
3. WHEN the URL is copied THEN the system SHALL show success feedback to the user
4. WHEN someone visits a shared URL THEN they SHALL be able to view the post with proper SEO metadata
5. WHEN a private post is shared THEN the URL SHALL require authentication to view
6. WHEN a follower-only post is shared THEN the system SHALL respect existing privacy settings
7. WHEN a user's post is shared THEN they SHALL receive a notification about the share
8. WHEN the system tracks shares THEN it SHALL implement rate limiting of 20 shares per hour per user
9. IF a user has disabled sharing on their posts THEN the share button SHALL not appear on their posts

### Requirement 3: Mention System with User Search

**User Story:** As an engaged community member, I want to send meaningful posts directly to specific users within the app using @username mentions, so I can start conversations and strengthen connections.

#### Acceptance Criteria

1. WHEN a user types @ in a post or message THEN the system SHALL trigger username autocomplete
2. WHEN the autocomplete appears THEN it SHALL show a dropdown with user search results including profile pictures and names
3. WHEN a user selects a mention THEN the system SHALL insert @username into the text and highlight it
4. WHEN a post with mentions is published THEN all mentioned users SHALL receive notifications
5. WHEN a user is mentioned THEN the notification SHALL include the post preview and mention context
6. WHEN a user clicks on a mention THEN they SHALL be navigated to the mentioned user's profile
7. WHEN mentions are displayed THEN they SHALL be visually highlighted with purple styling consistent with the app theme
8. WHEN a user has privacy settings enabled THEN they SHALL be able to control who can mention them
9. IF a mentioned user has blocked the author THEN the mention SHALL not create a notification

### Requirement 4: Share System with Mention Integration

**User Story:** As an engaged community member, I want to send meaningful posts directly to specific users within the app, so I can start conversations and strengthen connections through shared gratitude.

#### Acceptance Criteria

1. WHEN a user clicks share on a post THEN the share modal SHALL include a "Send as Message" section
2. WHEN a user selects "Send to user" THEN they SHALL see an input field with mention autocomplete (@username)
3. WHEN typing in the user search THEN the system SHALL show a dropdown with profile pictures and names
4. WHEN a user is selected THEN they SHALL be able to compose a message (max 200 chars) with the shared post preview
5. WHEN the message is sent THEN the recipient SHALL receive a notification: "[Username] shared a post with you: [Post preview]"
6. WHEN sharing with multiple users THEN the system SHALL support up to 5 users per share
7. WHEN the share modal opens THEN it SHALL show recently messaged users as quick-select options (last 5 interactions)
8. WHEN a post is shared via message THEN it SHALL count toward the share analytics and rate limiting
9. IF the recipient has blocked the sender THEN the share message SHALL not be delivered

### Requirement 5: Enhanced Notification System

**User Story:** As a user, I want to receive timely notifications about social interactions on my posts and mentions, so I can stay engaged with my community and respond to positive interactions.

#### Acceptance Criteria

1. WHEN a user receives a heart on their post THEN they SHALL get a notification: "[Username] hearted your post"
2. WHEN a user receives an emoji reaction THEN they SHALL get a notification: "[Username] reacted with [emoji] to your post"
3. WHEN a user is mentioned in a post THEN they SHALL get a notification: "[Username] mentioned you in a post: [Preview]"
4. WHEN a user's post is shared THEN they SHALL get a notification: "[Username] shared your post" or "Your post was shared [X] times today" (daily digest)
5. WHEN a user receives notifications THEN they SHALL see an unread count in the navbar bell icon
6. WHEN a user clicks the notification bell THEN they SHALL see a dropdown with recent notifications
7. WHEN a user clicks a notification THEN they SHALL be navigated to the relevant post or profile
8. WHEN a user views notifications THEN they SHALL be marked as read automatically
9. WHEN notifications accumulate THEN the system SHALL implement batching to avoid spam (max 5 notifications per hour per interaction type)

### Requirement 6: Follow System Integration

**User Story:** As a user, I want to follow other users whose gratitude posts inspire me, so I can see their content prioritized in my feed and build meaningful connections.

#### Acceptance Criteria

1. WHEN a user visits another user's profile THEN they SHALL see a follow/unfollow button
2. WHEN a user clicks follow THEN the system SHALL create a follow relationship and update the button to "Following"
3. WHEN a user unfollows someone THEN the system SHALL remove the relationship and update the button to "Follow"
4. WHEN a user follows someone THEN the followed user SHALL receive a notification: "[Username] started following you"
5. WHEN a user views their feed THEN posts from followed users SHALL be prioritized higher in the algorithm
6. WHEN a user has privacy settings THEN they SHALL be able to set their account to private (manual approval required)
7. WHEN a private user receives a follow request THEN they SHALL get a notification to approve or deny
8. WHEN viewing a user's profile THEN the system SHALL show follower and following counts
9. IF a user blocks another user THEN all follow relationships SHALL be removed and prevented

### Requirement 7: Content Hierarchy Algorithm Enhancement

**User Story:** As a user, I want my feed to show the most inspiring and relevant gratitude posts based on engagement and relationships, so I can discover quality content and stay motivated.

#### Acceptance Criteria

1. WHEN the system calculates post scores THEN it SHALL use the formula: (Hearts × 1.0) + (Emoji Reactions × 1.5) + (Shares × 4.0) + (Photo Bonus × 2.5) + (Daily Gratitude Multiplier × 3.0) + (Relationship Multiplier × 2.0)
2. WHEN a post has an image THEN it SHALL receive a 2.5 point photo bonus
3. WHEN a post is marked as "Daily Gratitude" THEN it SHALL receive a 3.0x multiplier
4. WHEN a post is from a followed user THEN it SHALL receive a 2.0x relationship multiplier
5. WHEN posts are displayed in the feed THEN they SHALL be ordered by calculated score with recency weighting
6. WHEN a post receives new interactions THEN its score SHALL be recalculated and position updated
7. WHEN the feed loads THEN it SHALL show a mix of high-scoring posts and recent posts (80/20 split)
8. WHEN a user has no followed users THEN the algorithm SHALL prioritize high-engagement posts from the community
9. IF a post receives reports THEN it SHALL receive a -10.0 penalty per report in the scoring

## Technical Implementation Notes

### Database Schema Updates Required

1. **Emoji Reactions Table**: Extend interactions table to support emoji_code field
2. **Shares Table**: New table to track share analytics and rate limiting
3. **Mentions Table**: Track mentions in posts and messages for notifications
4. **User Preferences**: Add privacy settings for mentions and sharing
5. **Notification Enhancements**: Add new notification types for reactions, shares, mentions

### API Endpoints Required

1. **POST /api/v1/posts/{post_id}/reactions** - Add emoji reaction
2. **GET /api/v1/posts/{post_id}/reactions** - Get reaction viewer data
3. **POST /api/v1/posts/{post_id}/share** - Share post (URL or message)
4. **POST /api/v1/users/search** - Search users for mentions
5. **GET /api/v1/notifications** - Get user notifications
6. **POST /api/v1/notifications/mark-read** - Mark notifications as read
7. **POST /api/v1/follows/{user_id}** - Follow user
8. **DELETE /api/v1/follows/{user_id}** - Unfollow user

### Frontend Components Required

1. **EmojiPicker Component** - Modal with 8 positive emoji options
2. **ReactionViewer Component** - Modal showing all users and their reactions
3. **ShareModal Component** - Multi-option sharing interface
4. **MentionAutocomplete Component** - User search dropdown
5. **NotificationDropdown Component** - Notification center in navbar
6. **FollowButton Component** - Follow/unfollow functionality

### Styling Guidelines

- Follow existing purple theme (#7C3AED primary, #A855F7 secondary)
- Use purple heart emoji (💜) for logo and tab icon consistently throughout the app
- Use consistent border-radius (rounded-lg for cards, rounded-full for buttons)
- Maintain visual hierarchy with proper spacing and typography
- Implement hover states with smooth transitions
- Use Lucide React icons consistently
- Follow responsive design patterns from reference implementation

## Success Criteria

1. **User Engagement**: 80% of users use emoji reactions within first week
2. **Viral Growth**: 25% increase in post shares compared to baseline
3. **Community Building**: 60% of users follow at least 3 other users
4. **Notification Engagement**: 70% of notifications are clicked within 24 hours
5. **Content Quality**: Average post score increases by 40% with new algorithm
6. **User Retention**: 15% improvement in 7-day retention due to enhanced social features

## Dependencies

1. Existing authentication system (stable)
2. Existing post creation and display system (stable)
3. Existing navbar and routing system (stable)
4. Database migration system (Alembic)
5. Real-time notification infrastructure (to be implemented)