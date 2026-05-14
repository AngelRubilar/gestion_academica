import type { Role } from '@gestion-academica/shared';

export interface RequestUser {
  id: string;
  email: string;
  role: Role;
}
