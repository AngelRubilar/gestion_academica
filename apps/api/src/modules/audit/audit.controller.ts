import { Controller, Get, Param, Query } from '@nestjs/common';
import { ROLES } from '@gestion-academica/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit-logs')
@Roles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.DIRECTOR)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Query() query: AuditQueryDto) {
    const { page, pageSize, ...filters } = query;
    return this.auditService.findMany(
      {
        entityType: filters.entityType,
        entityId: filters.entityId,
        userId: filters.userId,
        action: filters.action,
        from: filters.from,
        to: filters.to,
      },
      { page, pageSize },
    );
  }

  @Get('entity/:entityType/:entityId')
  byEntity(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.auditService.findByEntity(entityType, entityId);
  }

  @Get('user/:userId')
  byUser(@Param('userId') userId: string) {
    return this.auditService.findByUser(userId);
  }
}
