
export enum EventStatus {
    UPCOMING = 'upcoming',  // sắp diễn ra
    ONGOING = 'ongoing',    // đang diễn ra
    ENDED = 'ended',        // đã kết thúc
    CANCELLED = 'cancelled' // bị hủy
}
// export enum EventType {
//     PUBLIC = 'public',
//     PRIVATE = 'private',
// }
export enum ParticipantRole {
    STAFF = 'staff',       // ban tổ chức
    VIP = 'vip',           // khách mời đặc biệt
    ATTENDEE = 'attendee', // người tham gia bình thường
}
export enum InvitationStatus {
    PENDING = 'pending',
    ACCEPTED = 'accepted',
    REJECTED = 'rejected',
}