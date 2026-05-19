import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { db } from '@db'
import { QUERY_KEYS } from '@constants/queryKeys'
import type { NodeRow } from '@db'

export const useCreateNode = (): UseMutationResult<string, Error, NodeRow> => {
  const queryClient = useQueryClient()

  return useMutation<string, Error, NodeRow>({
    mutationFn: (row: NodeRow) => db.nodes.add(row),
    onSuccess:  (_result, row) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nodes(row.projectId) })
    },
  })
}
