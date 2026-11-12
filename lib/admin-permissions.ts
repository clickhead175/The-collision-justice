import { ApiError } from '@/lib/api-error';
import type { AdminRole } from '@/lib/auth';

export function assertCanCreateAdminRole(actor: AdminRole, target: string) {
  if (target !== 'admin' && target !== 'viewer') throw new ApiError(403, 'Superadmin accounts cannot be created through team management.');
  if (actor === 'admin' && target !== 'viewer') throw new ApiError(403, 'Admins may create viewer accounts only.');
  if (actor === 'viewer') throw new ApiError(403, 'Viewers cannot manage team accounts.');
}

export function assertCanManageAdmin(actor: AdminRole, target: AdminRole, action: 'edit' | 'delete' | 'reset-2fa') {
  if (target === 'superadmin') throw new ApiError(403, 'Superadmin accounts are protected and cannot be changed or deleted.');
  if (actor === 'superadmin') return;
  if (actor === 'admin' && target === 'viewer' && action === 'delete') return;
  throw new ApiError(403, 'You do not have permission to perform this team-management action.');
}
