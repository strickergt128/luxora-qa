import {
  BanknotesIcon,
  CubeIcon,
  ShoppingBagIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline";
import Sparkline from "./Sparkline";

export type OverviewStats = {
  totalUsers: number;
  totalOrders: number;
  totalProducts: number;
  totalRevenue: number;
};

export default function OverviewCards({
  stats,
  trends,
}: {
  stats: OverviewStats;
  trends?: { orders?: number[]; revenue?: number[] };
}) {
  const cards = [
    {
      label: "Revenue",
      value: `₹${(stats.totalRevenue || 0).toLocaleString("en-IN")}`,
      icon: BanknotesIcon,
      iconTint: "bg-success/10 text-success",
      trend: trends?.revenue,
      stroke: "#10b981",
      fill: "rgba(16, 185, 129, 0.15)",
    },
    {
      label: "Orders",
      value: stats.totalOrders,
      icon: ShoppingBagIcon,
      iconTint: "bg-primary/10 text-primary",
      trend: trends?.orders,
      stroke: "#6366f1",
      fill: "rgba(99, 102, 241, 0.15)",
    },
    {
      label: "Users",
      value: stats.totalUsers,
      icon: UserGroupIcon,
      iconTint: "bg-primary/10 text-primary",
    },
    {
      label: "Products",
      value: stats.totalProducts,
      icon: CubeIcon,
      iconTint: "bg-warning/10 text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((c) => (
        <div
          key={c.label}
          className="card relative flex flex-col justify-between p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-muted-foreground">{c.label}</h3>
            <div
              className={`shrink-0 rounded-lg border border-border p-2 ${c.iconTint}`}
            >
              <c.icon className="w-6 h-6" strokeWidth={2.5} />
            </div>
          </div>
          
          <div className="flex items-end justify-between">
            <div className="truncate text-3xl font-bold text-foreground">
              {c.value}
            </div>
            {c.trend && c.trend.length > 1 && (
              <div className="w-24 h-12 opacity-80">
                <Sparkline data={c.trend} stroke={c.stroke} fill={c.fill} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
