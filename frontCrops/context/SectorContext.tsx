import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CROP_SECTORS, CropSectorId, STORAGE_KEY_SECTOR, isCropSectorId } from '@/constants/sectors';
import { useAuth } from '@/context/AuthContext';

type SectorContextType = {
  sector: CropSectorId | null;
  setSector: (id: CropSectorId) => Promise<void>;
  clearSector: () => Promise<void>;
  isLoading: boolean;
  sectorMeta: (typeof CROP_SECTORS)[number] | undefined;
};

const SectorContext = createContext<SectorContextType | undefined>(undefined);

export function SectorProvider({ children }: { children: React.ReactNode }) {
  const { token, isGuest } = useAuth();
  const [sector, setSectorState] = useState<CropSectorId | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const hadSessionRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_SECTOR);
        if (!cancelled && isCropSectorId(raw)) setSectorState(raw);
        else if (!cancelled) setSectorState(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const active = !!(token || isGuest);
    if (hadSessionRef.current && !active) {
      setSectorState(null);
    }
    hadSessionRef.current = active;
  }, [token, isGuest]);

  const setSector = useCallback(async (id: CropSectorId) => {
    setSectorState(id);
    await AsyncStorage.setItem(STORAGE_KEY_SECTOR, id);
  }, []);

  const clearSector = useCallback(async () => {
    setSectorState(null);
    await AsyncStorage.removeItem(STORAGE_KEY_SECTOR);
  }, []);

  const sectorMeta = useMemo(() => CROP_SECTORS.find((s) => s.id === sector), [sector]);

  const value = useMemo(
    () => ({
      sector,
      setSector,
      clearSector,
      isLoading,
      sectorMeta,
    }),
    [sector, setSector, clearSector, isLoading, sectorMeta],
  );

  return <SectorContext.Provider value={value}>{children}</SectorContext.Provider>;
}

export function useSector() {
  const ctx = useContext(SectorContext);
  if (!ctx) throw new Error('useSector must be used within SectorProvider');
  return ctx;
}
