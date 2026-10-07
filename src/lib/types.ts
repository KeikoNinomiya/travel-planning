export const CATEGORIES = ["観光", "食事", "移動", "宿泊", "買い物"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Trip {
  id: string;
  title: string;
  start_date: string; // YYYY-MM-DD
  num_days: number;
  day_titles: string[];
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface Stop {
  id: string;
  trip_id: string;
  day_index: number;
  position: number;
  time: string | null;
  name: string;
  category: Category;
  cost: number;
  note: string;
  lat: number | null;
  lng: number | null;
}

export type StopInput = Omit<Stop, "id" | "trip_id" | "position"> & { position?: number };

export interface Member {
  trip_id: string;
  user_id: string;
  role: "owner" | "editor";
  email: string | null;
}
