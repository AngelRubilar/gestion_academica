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
