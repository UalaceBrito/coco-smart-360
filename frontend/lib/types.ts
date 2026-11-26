export interface Health {
  status: string;
  demo_mode: boolean;
}

export interface Farm {
  id: number;
  name: string;
  municipality: string;
  state: string;
  total_area_ha: number;
  cultivated_area_ha: number;
  planted_tree_count: number;
  variety: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface Tree {
  id: number;
  farm_id: number;
  identifier: string;
  planted_at: string | null;
  variety: string | null;
  row_number: number | null;
  position_number: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

export interface Task {
  id: number;
  farm_id: number;
  tree_id: number | null;
  title: string;
  description: string;
  due_date: string;
  priority: "low" | "normal" | "high" | "critical";
  status: "pending" | "in_progress" | "done" | "rescheduled";
  created_at: string;
}

export interface SoilAnalysis {
  id: number;
  farm_id: number;
  plot_name: string;
  sample_date: string;
  depth_cm: string;
  ph: number | null;
  organic_matter_pct: number | null;
  phosphorus_mg_dm3: number | null;
  potassium_mg_dm3: number | null;
  calcium_cmolc_dm3: number | null;
  magnesium_cmolc_dm3: number | null;
  aluminum_cmolc_dm3: number | null;
  ctc_cmolc_dm3: number | null;
  base_saturation_pct: number | null;
  lab_method: string | null;
  laboratory: string | null;
  reviewed: boolean;
  created_at: string;
}

export interface FertilizationApplication {
  id: number;
  farm_id: number;
  tree_id: number | null;
  scope: "tree" | "plot" | "farm";
  plot_name: string | null;
  product_name: string;
  quantity_kg: number;
  applied_on: string;
  plan_reference: string | null;
  created_at: string;
}

export interface IrrigationEvent {
  id: number;
  farm_id: number;
  plot_name: string | null;
  recorded_on: string;
  volume_liters: number;
  runtime_minutes: number | null;
  area_ha: number | null;
  notes: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: number;
  farm_id: number;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_cost: number | null;
  lot: string | null;
  expires_on: string | null;
  n_pct: number | null;
  p2o5_pct: number | null;
  k2o_pct: number | null;
  created_at: string;
}

export interface Harvest {
  id: number;
  farm_id: number;
  tree_id: number | null;
  harvested_on: string;
  fruits_harvested: number;
  fruits_discarded: number;
  weight_kg: number | null;
  price_per_fruit: number | null;
  destination: string | null;
  created_at: string;
}

export interface DashboardSummary {
  tree_count: number;
  pending_tasks: number;
  overdue_tasks: number;
  critical_tasks: number;
  soil_sample_count: number;
  inventory_item_count: number;
  harvested_fruits_this_month: number;
  irrigation_liters_30d: number;
  estimated_harvest_revenue_this_month: number | null;
  health_status: "not_assessed";
}

export interface Workspace {
  farm: Farm;
  dashboard: DashboardSummary;
  trees: Tree[];
  tasks: Task[];
  soil_analyses: SoilAnalysis[];
  fertilization_applications: FertilizationApplication[];
  irrigation_events: IrrigationEvent[];
  inventory: InventoryItem[];
  harvests: Harvest[];
}

export interface FertilizerCalculation {
  product_grams_per_tree: number;
  total_product_kg: number;
  package_count: number | null;
  estimated_purchase_cost: number | null;
  supplied_n_g_per_tree: number;
  supplied_p2o5_g_per_tree: number;
  supplied_k2o_g_per_tree: number;
  excess_n_g_per_tree: number;
  excess_p2o5_g_per_tree: number;
  excess_k2o_g_per_tree: number;
  execution_authorized: false;
  note: string;
}

export interface IrrigationCalculation {
  etc_mm_day: number;
  net_irrigation_depth_mm_day: number;
  gross_irrigation_depth_mm_day: number;
  total_volume_m3_day: number;
  total_volume_liters_day: number;
  liters_per_tree_day: number;
  runtime_hours_estimate: number | null;
  execution_authorized: false;
  note: string;
}

export interface AgronomicReferences {
  fertilization: {
    source: string;
    publication_year: number;
    reference_status: string;
    note: string;
    annual_ranges_g_per_tree: Array<{
      age: string;
      n: number;
      p2o5_min: number | null;
      p2o5_max: number | null;
      k2o_min: number | null;
      k2o_max: number | null;
    }>;
  };
  leaf_critical_levels: {
    source: string;
    publication_year: number;
    leaf: string;
    variety: string;
    reference_status: string;
    note: string;
    levels: Array<{
      nutrient: string;
      minimum: number;
      maximum: number;
      unit: string;
    }>;
  };
}
