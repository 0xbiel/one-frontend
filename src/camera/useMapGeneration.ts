import { useQuery } from "@tanstack/react-query";
import { api, type MapGenerationResponse } from "../api/client";

export const terminalMapGenerationStatuses = new Set([
  "ready",
  "needs_rescan",
  "unavailable",
  "failed",
]);

export function useMapGeneration(cameraId?: string, jobId?: string) {
  return useQuery<MapGenerationResponse>({
    queryKey: ["map-generation", cameraId, jobId],
    queryFn: () => api.getMapGeneration(cameraId!, jobId!),
    enabled: Boolean(cameraId && jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && terminalMapGenerationStatuses.has(status) ? false : 1500;
    },
    retry: 1,
  });
}
