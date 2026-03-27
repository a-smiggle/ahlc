export const AdSlot = () => {
  return (
    <aside className="panel no-print border-dashed p-4 text-sm text-token-ink/80" aria-label="Advertising slot">
      <p className="font-semibold">Advertisement</p>
      <p className="mt-1">This area is isolated from calculator state and can be disabled without affecting functionality.</p>
      <div className="mt-3 rounded border border-token-ink/20 bg-token-mist p-6 text-center">Ad Container</div>
    </aside>
  );
};
