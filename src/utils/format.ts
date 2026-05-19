import type { MethodReturnType } from '@entity'
import { JavaType } from '@entity'

/**
 * Formats a service method return type for display.
 * entityLabel must be resolved by the caller from rt.entityTypeId via rfNodes.
 * arrayEntityLabel must be resolved from rt.arrayEntityTypeId when rt.type === ARRAY.
 * Never references DTOs.
 */
export function formatReturnType(
  rt:                MethodReturnType,
  entityLabel?:      string,
  arrayEntityLabel?: string,
): string {
  if (rt.isVoid || rt.type === null) return 'void'

  // Resolve the inner type name
  const innerName = rt.type === 'ENTITY_REF'
    ? (entityLabel ?? 'Entity')
    : rt.type === JavaType.ARRAY
      ? (rt.arraySubType === 'ENTITY_REF'
          ? (arrayEntityLabel ?? 'Entity') + '[]'
          : (rt.arraySubType ?? '?'))
      : rt.type

  if (rt.isList)     return `List<${innerName}>`
  if (rt.isPage)     return `Page<${innerName}>`
  if (rt.isOptional) return `Optional<${innerName}>`
  return innerName
}
