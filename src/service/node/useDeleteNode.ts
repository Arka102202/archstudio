import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query'
import { db } from '@db'
import { QUERY_KEYS } from '@constants/queryKeys'

interface DeleteNodeArgs {
  nodeId:    string
  projectId: string
}

export const useDeleteNode = (): UseMutationResult<undefined, Error, DeleteNodeArgs> => {
  const queryClient = useQueryClient()

  return useMutation<undefined, Error, DeleteNodeArgs>({
    mutationFn: async ({ nodeId }) => { await db.nodes.delete(nodeId); return undefined },
    onSuccess:  (_result, { nodeId, projectId }) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nodes(projectId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.node(nodeId) })
    },
  })
}
