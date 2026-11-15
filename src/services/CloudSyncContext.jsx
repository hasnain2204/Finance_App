import { createContext, useContext } from 'react';

export const CloudSyncContext = createContext({ auth: null, sync: null });

export function useCloudSync() {
  return useContext(CloudSyncContext);
}
