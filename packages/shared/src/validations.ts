import { z } from 'zod';
import { ROLES, GRADE_SCALE } from './constants';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  role: z.enum([
    ROLES.SUPER_ADMIN,
    ROLES.ADMIN,
    ROLES.DIRECTOR,
    ROLES.PROFESOR_JEFE,
    ROLES.PROFESOR,
    ROLES.ESTUDIANTE,
    ROLES.APODERADO,
  ]),
});

export const gradeValueSchema = z
  .number()
  .min(GRADE_SCALE.MIN, `La nota mínima es ${GRADE_SCALE.MIN}`)
  .max(GRADE_SCALE.MAX, `La nota máxima es ${GRADE_SCALE.MAX}`);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
