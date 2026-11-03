import { useRegisterSW } from 'virtual:pwa-register/react';

/** Safe updates: a new version waits until Zaara chooses to reload, so no session is interrupted. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker
  } = useRegisterSW({ onRegisterError: () => undefined });
  if (!needRefresh && !offlineReady) return null;
  return (
    <div role="status" className="fixed inset-x-3 top-3 z-50 mx-auto max-w-md rounded-2xl bg-ink px-4 py-3 text-bg shadow-lift lg:bottom-6 lg:top-auto">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm">{needRefresh ? 'A new version of ZAARA is ready.' : 'ZAARA is ready to work offline.'}</p>
        {needRefresh && (
          <button className="min-h-[40px] rounded-lg bg-bg px-3 text-sm font-semibold text-ink" onClick={() => updateServiceWorker(true)}>
            Update
          </button>
        )}
        <button className="min-h-[40px] px-2 text-sm opacity-80" onClick={() => { setNeedRefresh(false); setOfflineReady(false); }}>
          Close
        </button>
      </div>
    </div>
  );
}
