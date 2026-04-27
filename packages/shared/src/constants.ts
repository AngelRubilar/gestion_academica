export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  DIRECTOR: 'DIRECTOR',
  PROFESOR_JEFE: 'PROFESOR_JEFE',
  PROFESOR: 'PROFESOR',
  ESTUDIANTE: 'ESTUDIANTE',
  APODERADO: 'APODERADO',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const GENDERS = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  NOT_SPECIFIED: 'NOT_SPECIFIED',
} as const;

export type Gender = (typeof GENDERS)[keyof typeof GENDERS];

export const PERIOD_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
} as const;

export type PeriodStatus = (typeof PERIOD_STATUS)[keyof typeof PERIOD_STATUS];

export const TIME_BLOCK_TYPES = {
  CLASS: 'CLASS',
  BREAK: 'BREAK',
  LUNCH: 'LUNCH',
} as const;

export type TimeBlockType = (typeof TIME_BLOCK_TYPES)[keyof typeof TIME_BLOCK_TYPES];

export const DAYS_OF_WEEK = {
  MONDAY: 'MONDAY',
  TUESDAY: 'TUESDAY',
  WEDNESDAY: 'WEDNESDAY',
  THURSDAY: 'THURSDAY',
  FRIDAY: 'FRIDAY',
} as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[keyof typeof DAYS_OF_WEEK];

export const GRADE_CHANGE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type GradeChangeStatus = (typeof GRADE_CHANGE_STATUS)[keyof typeof GRADE_CHANGE_STATUS];

export const DOCUMENT_TYPES = {
  ID_CARD: 'ID_CARD',
  BIRTH_CERTIFICATE: 'BIRTH_CERTIFICATE',
  TITLE: 'TITLE',
  CERTIFICATION: 'CERTIFICATION',
  CONTRACT: 'CONTRACT',
  OTHER: 'OTHER',
} as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const AUDIT_ACTIONS = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DEACTIVATE: 'DEACTIVATE',
  REACTIVATE: 'REACTIVATE',
  DELETE: 'DELETE',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const GRADE_SCALE = {
  MIN: 1.0,
  MAX: 7.0,
  PASSING: 4.0,
} as const;

export const ATTENDANCE_STATUS = {
  PRESENTE: 'PRESENTE',
  AUSENTE: 'AUSENTE',
  ATRASADO: 'ATRASADO',
  JUSTIFICADO: 'JUSTIFICADO',
} as const;

export type AttendanceStatus = (typeof ATTENDANCE_STATUS)[keyof typeof ATTENDANCE_STATUS];
