
export enum EventStatus {
  UPCOMING = 'upcoming',  // sắp diễn ra
  ONGOING = 'ongoing',    // đang diễn ra
  ENDED = 'ended',        // đã kết thúc
  CANCELLED = 'cancelled' // bị hủy
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