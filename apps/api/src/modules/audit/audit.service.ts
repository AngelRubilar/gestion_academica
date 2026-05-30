import { Injectable } from '@nestjs/common';
import type { AuditAction } from '@gestion-academica/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuditContext } from './audit-context.service';

export interface AuditFilters {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: AuditAction;
  from?: Date;
  to?: Date;
}

export interface Pagination {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    entityType: string;
    entityId: string;
    action: AuditAction;
    changes?: unknown;
    context: AuditContext;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        changes: input.changes as Prisma.InputJsonValue,
        userId: input.context.userId,
        userRole: input.context.userRole,
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
      },
    });
  }

  async findMany(filters: AuditFilters, pagination: Pagination) {
    const page = pagination.page ?? 1;
    const pageSize = pagination.pageSize ?? 20;
    const where = this.buildWhere(filters);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  findByEntity(entityType: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByUser(userId: string) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  private buildWhere(filters: AuditFilters) {
    const where: Record<string, unknown> = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.from || filters.to) {
      where.createdAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }
    return where;
  }
}
