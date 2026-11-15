import { useSupabaseAuth } from './useSupabaseAuth';
import { useFinanceSync } from './useFinanceSync';
import { CloudSyncContext } from './CloudSyncContext';

export default function CloudSyncProvider({ repository, children }) {
  const auth = useSupabaseAuth();
  const sync = useFinanceSync(repository, auth);

  return (
    <CloudSyncContext.Provider value={{ auth, sync }}>
      {children}
    </CloudSyncContext.Provider>
  );
}
