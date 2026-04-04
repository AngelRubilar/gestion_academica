import type { Role } from './constants';

export interface User {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Teacher {
  id: string;
  userId: string;
  rut: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  specialization: string | null;
}

export interface Student {
  id: string;
  userId: string;
  rut: string;
  firstName: string;
  lastName: string;
  enrollmentDate: Date;
  birthDate: Date | null;
}

export interface Guardian {
  id: string;
  userId: string;
  rut: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  relationship: string;
}

export interface Course {
  id: string;
  name: string;
  level: string;
  section: string;
  year: number;
  teacherId: string | null;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface Evaluation {
  id: string;
  name: string;
  subjectId: string;
  courseId: string;
  date: Date;
  weight: number;
  type: string;
  description: string | null;
}

export interface Grade {
  id: string;
  evaluationId: string;
  studentId: string;
  value: number;
  observations: string | null;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Material {
  id: string;
  subjectId: string;
  courseId: string;
  title: string;
  description: string | null;
  fileUrl: string;
  fileType: string;
  isPublished: boolean;
  uploadedBy: string;
  createdAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
