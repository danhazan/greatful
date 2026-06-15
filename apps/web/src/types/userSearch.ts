export interface UserSearchResult {
  id: number
  username: string | null
  displayName?: string | null
  profileImageUrl?: string | null
  bio?: string | null
  image?: string | null
  createdAt?: string
  email?: string
  isDeleted?: boolean
  accountStatus?: string
}
