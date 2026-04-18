'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { MasterRecord, LeaveType } from './types';

interface MasterData {
  qualifications: MasterRecord[];
  genders: MasterRecord[];
  role_types: MasterRecord[];
  leave_types: LeaveType[];
  leave_durations: MasterRecord[];
  departments: MasterRecord[];
}

interface MasterDataContextValue {
  data: MasterData;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const emptyData: MasterData = {
  qualifications: [],
  genders: [],
  role_types: [],
  leave_types: [],
  leave_durations: [],
  departments: [],
};

const MasterDataContext = createContext<MasterDataContextValue>({
  data: emptyData,
  isLoading: true,
  error: null,
  refresh: async () => {},
});

const TABLES = [
  'qualifications',
  'genders',
  'role_types',
  'leave_types',
  'leave_durations',
  'departments',
] as const;

export function MasterDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<MasterData>(emptyData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.all(
        TABLES.map((table) => api.get<MasterRecord[]>(`/master/${table}`)),
      );
      const newData = {} as Record<string, MasterRecord[]>;
      TABLES.forEach((table, i) => {
        newData[table] = results[i];
      });
      setData(newData as unknown as MasterData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load master data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <MasterDataContext.Provider value={{ data, isLoading, error, refresh }}>
      {children}
    </MasterDataContext.Provider>
  );
}

export function useMasterData() {
  return useContext(MasterDataContext);
}
