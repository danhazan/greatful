import { transformApiResponse } from '@/lib/caseTransform'
import { assertNoSnakeCaseInTest } from '@/utils/contractAssertion'

describe('caseTransform contract', () => {
  it('normalizes nested snake_case response payloads', () => {
    const backendPayload = {
      data: {
        access_token: 'abc',
        is_new_user: false,
        user: {
          profile_image_url: '/uploads/p.png',
          display_name: 'Alice'
        }
      }
    }

    const transformed = transformApiResponse(backendPayload)

    assertNoSnakeCaseInTest(transformed, 'transformApiResponse nested payload')
    expect(transformed).toEqual({
      data: {
        accessToken: 'abc',
        isNewUser: false,
        user: {
          profileImageUrl: '/uploads/p.png',
          displayName: 'Alice'
        }
      }
    })
  })
})
