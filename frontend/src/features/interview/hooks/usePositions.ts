import { useEffect, useMemo, useState } from "react";
import { fetchAdminPositions, fetchPositions } from "../api";
import type { JobPosition } from "../types";

type UsePositionsOptions = {
  admin?: boolean;
};

export function usePositions(options: UsePositionsOptions = {}) {
  const { admin = false } = options;
  const [positions, setPositions] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      setPositions(admin ? await fetchAdminPositions() : await fetchPositions());
    } catch {
      setPositions([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [admin]);

  const options_list = useMemo(
    () =>
      positions.map((item) => ({
        label: item.name,
        value: item.name,
        disabled: !item.enabled,
      })),
    [positions],
  );

  const enabledOptions = useMemo(() => options_list.filter((item) => !item.disabled), [options_list]);

  return { positions, loading, options: options_list, enabledOptions, reload };
}
