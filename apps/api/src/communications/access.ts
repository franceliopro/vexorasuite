import {ForbiddenException} from '@nestjs/common';
import {AuthenticatedRequest} from '../auth/auth.types';
export function mailAdmin(req:AuthenticatedRequest){if(!['OWNER','ADMIN'].includes(req.user.role))throw new ForbiddenException('Somente a administração pode gerenciar rotinas.');}
