import { useEffect } from 'react';
import useProtocolStore from '../store/useProtocolStore';
import useDesignStore from '../store/useDesignStore';
import useScheduleStore from '../store/useScheduleStore';

/**
 * Auto-save hook that watches dirty flags on all stores
 * and triggers saves after a 2-second debounce period.
 *
 * @param {string} protocolId - The current protocol ID
 */
export default function useAutoSave(protocolId) {
  const protocolDirty = useProtocolStore((s) => s.dirty);
  const designDirty = useDesignStore((s) => s.dirty);
  const scheduleDirty = useScheduleStore((s) => s.dirty);

  useEffect(() => {
    if (!protocolId) return;

    const timer = setTimeout(async () => {
      if (protocolDirty) await useProtocolStore.getState().saveProtocol();
      if (designDirty) await useDesignStore.getState().saveDesign(protocolId);
      if (scheduleDirty) await useScheduleStore.getState().saveSchedule(protocolId);
    }, 2000);

    return () => clearTimeout(timer);
  }, [protocolId, protocolDirty, designDirty, scheduleDirty]);
}
