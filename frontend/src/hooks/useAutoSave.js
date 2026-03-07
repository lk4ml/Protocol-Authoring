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
      try {
        if (protocolDirty) await useProtocolStore.getState().saveProtocol();
      } catch (err) {
        console.error('[AutoSave] Protocol save failed:', err);
      }
      try {
        if (designDirty) await useDesignStore.getState().saveDesign(protocolId);
      } catch (err) {
        console.error('[AutoSave] Design save failed:', err);
      }
      try {
        if (scheduleDirty) await useScheduleStore.getState().saveSchedule(protocolId);
      } catch (err) {
        console.error('[AutoSave] Schedule save failed:', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [protocolId, protocolDirty, designDirty, scheduleDirty]);
}
