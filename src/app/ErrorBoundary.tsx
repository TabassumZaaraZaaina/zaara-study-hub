import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="font-semibold">Something went wrong on this screen</h2>
        <p className="mt-1 text-sm text-muted">Your saved work is safe — it lives in this device’s storage. Try going back, or reload the app.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-sunken p-2 text-xs text-muted">{this.state.error.message}</pre>
        <button className="mt-3 min-h-[44px] rounded-xl bg-primary px-4 font-semibold text-on-primary" onClick={() => location.reload()}>Reload</button>
      </div>
    );
  }
}
