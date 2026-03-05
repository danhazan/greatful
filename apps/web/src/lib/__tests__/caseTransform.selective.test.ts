
import { transformApiResponse } from '../caseTransform'

describe('Selective Case Transformation', () => {
    it('should camelize standard fields but preserve protected dictionary keys', () => {
        const apiPayload = {
            hearts_count: 5,
            reaction_summary: {
                total_count: 1,
                emoji_counts: {
                    heart_eyes: 1,
                    partying_face: 2
                },
                user_reaction: 'heart_eyes'
            }
        };

        const transformed = transformApiResponse(apiPayload);

        // Standard fields should be camelized
        expect(transformed.heartsCount).toBe(5);
        expect(transformed.reactionSummary.totalCount).toBe(1);
        expect(transformed.reactionSummary.userReaction).toBe('heart_eyes');

        // emojiCounts keys should be PRESERVED
        expect(transformed.reactionSummary.emojiCounts.heart_eyes).toBe(1);
        expect(transformed.reactionSummary.emojiCounts.partying_face).toBe(2);

        // Check that we didn't inject camelCase versions
        expect(transformed.reactionSummary.emojiCounts.heartEyes).toBeUndefined();
    });

    it('should preserve strings in reactionEmojiCodes array', () => {
        const apiPayload = {
            id: '123',
            reaction_emoji_codes: ['heart_eyes', 'partying_face']
        };

        const transformed = transformApiResponse(apiPayload);

        expect(transformed.id).toBe('123');
        expect(transformed.reactionEmojiCodes).toEqual(['heart_eyes', 'partying_face']);
    });

    it('should handle nested arrays and objects', () => {
        const apiPayload = {
            posts: [
                {
                    post_id: 'p1',
                    reaction_summary: {
                        emoji_counts: { test_key: 1 }
                    }
                }
            ]
        };

        const transformed = transformApiResponse(apiPayload);

        expect(transformed.posts[0].postId).toBe('p1');
        expect(transformed.posts[0].reactionSummary.emojiCounts.test_key).toBe(1);
    });
});
