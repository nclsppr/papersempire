interface DeliveryTruckProps {
  active: boolean;
}

/**
 * A tiny SVG truck that loops across the bottom road when the Delivery
 * building is unlocked. Pure CSS animation on a single transform.
 */
export function DeliveryTruck({ active }: DeliveryTruckProps) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-3 h-10">
      <div className="relative h-full w-full">
        <div
          className="absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-slate-200/80"
          aria-hidden
        />
        <div
          className="absolute -top-2 left-0 animate-truck-drive"
          aria-hidden
        >
          <svg viewBox="0 0 64 32" width="64" height="32">
            <rect x="2" y="10" width="36" height="14" rx="3" fill="#f87171" />
            <rect x="38" y="14" width="18" height="10" rx="2" fill="#fca5a5" />
            <rect x="42" y="16" width="10" height="6" rx="1" fill="#bfdbfe" />
            <circle cx="14" cy="26" r="4" fill="#1f2937" />
            <circle cx="46" cy="26" r="4" fill="#1f2937" />
            <circle cx="14" cy="26" r="1.6" fill="#9ca3af" />
            <circle cx="46" cy="26" r="1.6" fill="#9ca3af" />
            <rect x="8" y="13" width="6" height="6" rx="1" fill="#fff" />
          </svg>
        </div>
      </div>
    </div>
  );
}
