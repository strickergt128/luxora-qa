import React from "react";

type Props = {
  distribution: Record<string, number>;
  avg: number;
};

export default function StarsBar({ distribution = {}, avg = 0 }: Props) {
  const total =
    Object.values(distribution).reduce((s, n) => s + Number(n || 0), 0) || 0;
  const percent = (stars: number) => {
    const n = Number(distribution[String(stars)] || 0);
    return total ? Math.round((n / total) * 100) : 0;
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-3xl font-bold text-gray-900">
          {avg.toFixed(1)} <span className="text-amber-500">★</span>
        </div>
        <div className="text-sm text-gray-600">{total} reviews</div>
      </div>
      <div className="space-y-2">
        {[5, 4, 3, 2, 1].map((s) => (
          <div key={s} className="flex items-center gap-3">
            <div className="w-10 text-sm text-gray-700">{s}★</div>
            <div className="flex-1 h-2 rounded bg-gray-200 overflow-hidden">
              <div
                className="h-full bg-amber-400"
                style={{ width: `${percent(s)}%` }}
              />
            </div>
            <div className="w-12 text-right text-sm text-gray-700">
              {percent(s)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
