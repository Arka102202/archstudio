import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { db } from '@db'
import { QUERY_KEYS } from '@constants/queryKeys'
import type { NodeRow } from '@db'

export const useGetNodes = (projectId: string): UseQueryResult<NodeRow[], Error> =>
  useQuery<NodeRow[], Error>({
    queryKey: QUERY_KEYS.nodes(projectId),
    queryFn:  () => db.nodes.where('projectId').equals(projectId).toArray(),
    enabled:  Boolean(projectId),
  })
