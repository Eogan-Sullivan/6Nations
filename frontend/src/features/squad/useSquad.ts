import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyDraft, validateDraft, type Draft, type Player } from './model';
import { defaultRepository, type SavedSquad, type SquadRepository } from './repository';

export function useSquad(repository: SquadRepository = defaultRepository) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [saved, setSaved] = useState<SavedSquad>({
    draft: emptyDraft(),
    confirmed: null,
    confirmedAt: null,
    locked: false,
    lockedAt: null,
    transfersRemaining: 2,
  });
  const [loading, setLoading] = useState(true);
  const [storageReady, setStorageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(repository.source === 'api' ? 'Waiting for game data' : 'Loading demo');
  const [saving, setSaving] = useState(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(true);
  const version = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStorageReady(false);
    try {
      const pool = await repository.players();
      if (!mounted.current) return;
      setPlayers(pool);
      const previous = await repository.load();
      if (!mounted.current) return;
      setSaved(previous ?? { draft: emptyDraft(), confirmed: null, confirmedAt: null, locked: false, lockedAt: null, transfersRemaining: 2 });
      setStorageReady(true);
      setStatus(previous
        ? repository.source === 'api' ? 'Squad restored from the game server' : 'Draft restored on this device'
        : repository.source === 'api' ? 'Player data unavailable' : 'Local demo · ready');
    } catch {
      if (mounted.current) {
        setError(repository.source === 'api'
          ? 'The game data API is not ready yet. Your account is connected, but no player catalog is available.'
          : 'Could not restore the local draft. Retry, or start a new draft to replace the saved demo.');
        setStatus('Storage unavailable');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [repository]);
  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const persist = useCallback(
    (value: SavedSquad) => {
      const change = ++version.current;
      setSaving(true);
      setStatus('Saving on this device…');
      const operation = queue.current.then(() => repository.save(value));
      queue.current = operation.catch(() => {});
      return operation.then(
        () => {
          if (mounted.current && change === version.current) {
            setError(null);
            setSaving(false);
            setStatus('Saved on this device');
          }
        },
        (cause: unknown) => {
          if (mounted.current && change === version.current) {
            setSaving(false);
            setError(
              'Your changes are in memory, but could not be saved. Retry before closing this page.',
            );
            setStatus('Changes not saved');
          }
          throw cause;
        },
      );
    },
    [repository],
  );

  const update = (change: (draft: Draft) => Draft) => {
    if (!storageReady || saved.locked) return;
    setSaved((current) => ({ ...current, draft: change(current.draft) }));
  };
  // Serialize writes and persist only after successful hydration.
  const initial = useRef(true);
  useEffect(() => {
    if (!storageReady) {
      initial.current = true;
      return;
    }
    if (initial.current) {
      initial.current = false;
      return;
    }
    void persist(saved).catch(() => {});
  }, [saved, storageReady, persist]);

  const reset = () => {
    const next = { draft: emptyDraft(), confirmed: null, confirmedAt: null, locked: false, lockedAt: null, transfersRemaining: 2 };
    setSaved(next);
    setStorageReady(true);
    void persist(next).catch(() => {});
  };
  const confirm = async () => {
    if (!storageReady || saved.locked || validateDraft(saved.draft, players).length) return false;
    const next = {
      ...saved,
      confirmed: { ...saved.draft, slots: [...saved.draft.slots] },
      confirmedAt: new Date().toISOString(),
    };
    try {
      await persist(next);
      setSaved(next);
      return true;
    } catch {
      return false;
    }
  };
  const lock = async () => {
    if (!storageReady || saved.locked || validateDraft(saved.draft, players).length) return false;
    const next = {
      ...saved,
      confirmed: { ...saved.draft, slots: [...saved.draft.slots] },
      confirmedAt: new Date().toISOString(),
      locked: true,
      lockedAt: new Date().toISOString(),
    };
    try {
      await persist(next);
      setSaved(next);
      return true;
    } catch {
      return false;
    }
  };
  const useTransfer = async (change: (draft: Draft) => Draft) => {
    if (!storageReady || saved.locked || saved.transfersRemaining <= 0) return false;
    const next = { ...saved, draft: change(saved.draft), transfersRemaining: saved.transfersRemaining - 1 };
    setSaved(next);
    return true;
  };
  return {
    ...saved,
    source: repository.source,
    players,
    loading,
    storageReady,
    error,
    status,
    saving,
    update,
    reset,
    confirm,
    lock,
    useTransfer,
    retry: () => (storageReady ? persist(saved).catch(() => {}) : load()),
  };
}
