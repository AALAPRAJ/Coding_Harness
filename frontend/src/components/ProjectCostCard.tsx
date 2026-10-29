import React, { useEffect, useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { ApiService, ProjectCost } from '../services/api';

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function ProjectCostCard() {
  const [cost, setCost] = useState<ProjectCost | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const result = await ApiService.getProjectCost();
        if (active) { setCost(result); setFailed(false); }
      } catch {
        if (active) setFailed(true);
      }
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const available = cost?.status === 'available' && cost.grossCost !== undefined && cost.netCost !== undefined && cost.currency;
  const label = available ? money(cost.grossCost!, cost.currency!) : failed || cost?.status === 'unavailable' ? 'Unavailable' : cost?.status === 'pending' ? 'Pending' : 'Loading…';
  return (
    <div className="relative flex-shrink-0" onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="project-cost-details"
        className="flex items-center gap-2 rounded-lg border border-dark-border bg-dark-card px-3 py-2 text-xs font-medium text-gray-300 hover:text-white hover:border-brand-500/40 transition-colors">
        <CircleDollarSign className="h-4 w-4 text-brand-400" />
        <span>Cost</span><span aria-live="polite" className="text-white">{label}</span>
      </button>
      {open && (
        <div id="project-cost-details" className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-dark-border bg-dark-card p-4 text-xs text-gray-400 leading-relaxed shadow-xl">
          {available ? (
            <>
              <p className="text-gray-200">{money(cost.grossCost!, cost.currency!)} before credits · {money(cost.netCost!, cost.currency!)} after credits</p>
              <p className="mt-2">{cost.stale || failed ? 'Showing last available data. ' : ''}{cost.latestUsage ? `Usage through ${new Date(cost.latestUsage).toLocaleString()}. ` : ''}Google billing may be delayed.</p>
            </>
          ) : <p>{cost?.status === 'pending' && !failed ? 'Waiting for Google billing data. Initial export may take several days.' : failed || cost?.status === 'unavailable' ? 'Could not load billing data.' : 'Checking Google billing data.'}</p>}
          <p className="mt-2 text-gray-500">Refreshes automatically.</p>
        </div>
      )}
    </div>
  );
}
