
export enum EventStatus {
  DRAFT = 'draft',         // Mới tạo, đang chỉnh sửa, chưa công khai
  PUBLISHED = 'published', // Đã sẵn sàng và hiển thị cho người dùng mua vé
  UPCOMING = 'upcoming',   // Đã công khai nhưng chưa tới giờ diễn ra
  ONGOING = 'ongoing',     // Đang diễn ra
  ENDED = 'ended',         // Đã kết thúc
  CANCELLED = 'cancelled', // Bị hủy bỏ
  POSTPONED = 'postponed'  // Bị tạm hoãn 
}
export enum ReportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected ',
  SPAM = 'spam',
}

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}
export enum RoleUser {
  USER = 'user',
  MEMBERSHIP = 'membership',
  ADMIN = 'admin',
  ORGANIZATION = 'organization'
}
export enum OrgRequestStatus {
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
  SUSPENDED = "SUSPENDED"
}
export enum VerificationStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}