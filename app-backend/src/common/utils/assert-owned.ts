import { NotFoundException } from '@nestjs/common';
import { EntityManager, EntityTarget, FindOptionsWhere } from 'typeorm';

/**
 * Throws 404 unless a row matching `where` exists. Used to prove a referenced
 * parent (site, cluster, device...) belongs to the caller's tenant before a
 * child row is created or moved. 404 (not 403) so existence is not revealed.
 */
export async function assertOwned<E>(
  manager: EntityManager,
  entity: EntityTarget<E>,
  where: FindOptionsWhere<E>,
  label: string,
): Promise<E> {
  const row = await manager.findOne(entity, { where });
  if (!row) {
    throw new NotFoundException(`${label} not found`);
  }
  return row;
}
