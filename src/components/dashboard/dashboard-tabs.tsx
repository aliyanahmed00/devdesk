import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, LayoutGrid, Plug } from "lucide-react";

export type DashboardTab = "overview" | "widgets" | "integrations";

export type DashboardTabItem = {
  id: DashboardTab;
  label: string;
  icon: LucideIcon;
};

export const DASHBOARD_TABS: DashboardTabItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "widgets", label: "Widgets", icon: LayoutGrid },
  { id: "integrations", label: "Integrations", icon: Plug },
];
