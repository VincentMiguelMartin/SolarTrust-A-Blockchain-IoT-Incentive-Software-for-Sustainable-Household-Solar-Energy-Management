import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { syncEnergy } from "../services/apiService.js";
import { API_BASE_URL } from "../config";

const ENERGY_UPDATE_INTERVAL_MS = 300000;

type EnergyReading = {
  solarWatts: number;
  gridWatts: number;
  exportWatts: number;
  powerUsageWatts: number;
  ts: string;
};

type EnergyContextType = {
  selectedPlantId: string;
  setSelectedPlantId: (plantId: string) => void;
  reading: EnergyReading;
  powerHistory: number[];
  usageHistory: number[];
  lastUpdate: string;
  error: string;
  debugUrl: string;
  debugState: string;
  rawData: any;
  refreshEnergy: () => Promise<void>;
  registerEnergyConsumer: () => () => void;
};

const defaultReading: EnergyReading = {
  solarWatts: 0,
  gridWatts: 0,
  exportWatts: 0,
  powerUsageWatts: 0,
  ts: "",
};

const EnergyContext = createContext<EnergyContextType>({} as EnergyContextType);

export function EnergyProvider({ children }: { children: ReactNode }) {
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [reading, setReading] = useState<EnergyReading>(defaultReading);
  const [powerHistory, setPowerHistory] = useState<number[]>([]);
  const [usageHistory, setUsageHistory] = useState<number[]>([]);
  const [lastUpdate, setLastUpdate] = useState("");
  const [error, setError] = useState("");
  const [debugUrl, setDebugUrl] = useState("");
  const [debugState, setDebugState] = useState("idle");
  const [rawData, setRawData] = useState<any>(null);

  const consumerCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshEnergy = useCallback(async () => {
    try {
      const base = API_BASE_URL;
      const plantId = selectedPlantId.trim();

      if (!plantId) {
        setDebugUrl("");
        setDebugState("idle");
        setError("");
        return;
      }

      setDebugUrl(`${base}/energy/sync/${plantId}`);
      setDebugState("loading");

      const data = await syncEnergy(plantId);
      const energy = data?.reading ?? {};

      const solarRaw = Number(energy.solarWatts ?? 0);
      const gridRaw = Number(energy.gridWatts ?? 0);
      const exportRaw = Number(energy.exportWatts ?? 0);
      const ts = energy.ts ?? data?.latest?.ts ?? "";

      if (isNaN(solarRaw)) {
        return;
      }

      const solarWatts = Math.round(solarRaw);
      const gridWatts = isNaN(gridRaw) ? 0 : Math.round(gridRaw);
      const exportWatts = isNaN(exportRaw) ? 0 : Math.round(exportRaw);
      const powerUsageWatts = Math.max(0, solarWatts + gridWatts - exportWatts);

      setReading({
        solarWatts,
        gridWatts,
        exportWatts,
        powerUsageWatts,
        ts,
      });
      setRawData(data);
      setLastUpdate(ts);
      setError("");
      setDebugState("ok");

      setPowerHistory((prev) => {
        const updated = [...prev, solarWatts];
        if (updated.length > 20) updated.shift();
        return updated;
      });

      setUsageHistory((prev) => {
        const updated = [...prev, powerUsageWatts];
        if (updated.length > 20) updated.shift();
        return updated;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load energy");
      setDebugState("failed");
    }
  }, [selectedPlantId]);

  useEffect(() => {
    setReading(defaultReading);
    setPowerHistory([]);
    setUsageHistory([]);
    setLastUpdate("");
    setError("");
    setRawData(null);
  }, [selectedPlantId]);

  const registerEnergyConsumer = useCallback(() => {
    consumerCountRef.current += 1;

    if (consumerCountRef.current === 1) {
      refreshEnergy();
      timerRef.current = setInterval(refreshEnergy, ENERGY_UPDATE_INTERVAL_MS);
    }

    return () => {
      consumerCountRef.current = Math.max(0, consumerCountRef.current - 1);

      if (consumerCountRef.current === 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [refreshEnergy]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      selectedPlantId,
      setSelectedPlantId,
      reading,
      powerHistory,
      usageHistory,
      lastUpdate,
      error,
      debugUrl,
      debugState,
      rawData,
      refreshEnergy,
      registerEnergyConsumer,
    }),
    [
      selectedPlantId,
      reading,
      powerHistory,
      usageHistory,
      lastUpdate,
      error,
      debugUrl,
      debugState,
      rawData,
      refreshEnergy,
      registerEnergyConsumer,
    ]
  );

  return (
    <EnergyContext.Provider
      value={value}
    >
      {children}
    </EnergyContext.Provider>
  );
}

export function useEnergy() {
  const context = useContext(EnergyContext);

  useEffect(() => {
    return context.registerEnergyConsumer();
  }, [context.registerEnergyConsumer]);

  return context;
}
