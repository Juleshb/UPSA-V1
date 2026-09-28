export type NoticeEvent =
  | { type: 'notice'; notice: ParentNotice }
  | { type: 'read'; notificationIds: string[] }

export type ParentNotice = {
  notificationId: string
  channel: string
  subject: string
  body: string
  createdAt: string
  read: boolean
}

type Listener = (event: NoticeEvent) => void

const rooms = new Map<string, Set<Listener>>()

export function publishNotice(userId: string, event: NoticeEvent) {
  rooms.get(userId)?.forEach((listener) => listener(event))
}

export function subscribeNotices(userId: string, listener: Listener) {
  const room = rooms.get(userId) ?? new Set<Listener>()
  room.add(listener)
  rooms.set(userId, room)
  return () => {
    room.delete(listener)
    if (room.size === 0) rooms.delete(userId)
  }
}
