import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { db } from '@db'
import { QUERY_KEYS } from '@constants/queryKeys'
import type { NodeRow } from '@db'

export const useUpdateNode = (): UseMutationResult<number, Error, NodeRow> => {
  const queryClient = useQueryClient()

  return useMutation<number, Error, NodeRow>({
    mutationFn: (row: NodeRow) =>
      db.nodes.update(row.id, {
        label:     row.label,
        position:  row.position,
        size:      row.size,
        data:      row.data,
        updatedAt: Date.now(),
      }),
    onSuccess: (_result, row) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nodes(row.projectId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.node(row.id) })
    },
  })
}
