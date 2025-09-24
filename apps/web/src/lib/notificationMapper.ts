/**
 * Notification mapper to ensure consistent data shape between API and frontend
 */

export function mapNotificationApiToClient(n: any) {
  return {
    ...n,
    fromUser: n.from_user ? {
      id: String(n.from_user.id),
      name: n.from_user.name ?? n.from_user.display_name ?? n.from_user.username,
      username: n.from_user.username,
      image: n.from_user.image ?? n.from_user.profile_image_url
    } : n.fromUser,
    data: n.data ?? {}
  };
}