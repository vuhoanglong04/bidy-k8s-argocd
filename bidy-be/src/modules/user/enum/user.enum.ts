export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive', // Keep for backward compatibility if needed, but we will mostly use suspended
  SUSPENDED = 'suspended',
  BANNED = 'banned',
  DEACTIVATED = 'deactivated',
}