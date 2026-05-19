import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { db } from '@db'
import { QUERY_KEYS } from '@constants/queryKeys'

interface DeleteNodesArgs {
  nodeIds:   string[]
  projectId: string
}

export const useDeleteNodes = (): UseMutationResult<undefined, Error, DeleteNodesArgs> => {
  const queryClient = useQueryClient()

  return useMutation<undefined, Error, DeleteNodesArgs>({
    mutationFn: async ({ nodeIds }) => { await db.nodes.bulkDelete(nodeIds); return undefined },
    onSuccess:  (_result, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nodes(projectId) })
    },
  })
}
