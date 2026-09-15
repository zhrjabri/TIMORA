/**
 * Database types matching supabase/migrations. Kept in the shape produced by
 * `supabase gen types typescript` so it can be regenerated once a project is linked.
 */

export type ScheduleTypeDb = "interval" | "once" | "none";
export type IntervalUnitDb = "day" | "week" | "month" | "year";
export type CompletionSourceDb = "done_now" | "backdated" | "initial" | "qr";
export type SystemCategoryKey =
  | "home"
  | "vehicle"
  | "personal_care"
  | "health"
  | "pets"
  | "plants"
  | "documents"
  | "lent_items"
  | "other";

type ProfileRow = {
  id: string;
  display_name: string | null;
  locale: "ar" | "en";
  timezone: string;
  theme: "light" | "dark" | "system";
  created_at: string;
  updated_at: string;
};

type CategoryRow = {
  id: string;
  user_id: string;
  system_key: SystemCategoryKey | null;
  name: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
};

type ItemRow = {
  id: string;
  user_id: string;
  category_id: string | null;
  name: string;
  note: string | null;
  icon: string | null;
  schedule_type: ScheduleTypeDb;
  interval_count: number | null;
  interval_unit: IntervalUnitDb | null;
  due_date: string | null;
  due_soon_days: number | null;
  schedule_set_at: string;
  qr_token: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type CompletionRow = {
  id: string;
  user_id: string;
  item_id: string;
  completed_on: string;
  recorded_at: string;
  note: string | null;
  source: CompletionSourceDb;
  undone_at: string | null;
};

type ItemOverviewRow = ItemRow & {
  category_system_key: SystemCategoryKey | null;
  category_name: string | null;
  category_icon: string | null;
  last_completed_on: string | null;
  latest_recorded_at: string | null;
  completion_count: number;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: never;
        Update: Partial<Pick<ProfileRow, "display_name" | "locale" | "timezone" | "theme">>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Pick<CategoryRow, "name"> & Partial<Pick<CategoryRow, "icon">>;
        Update: Partial<Pick<CategoryRow, "name" | "icon">>;
        Relationships: [];
      };
      items: {
        Row: ItemRow;
        Insert: Pick<ItemRow, "name" | "schedule_type"> &
          Partial<
            Pick<ItemRow, "category_id" | "note" | "icon" | "interval_count" | "interval_unit" | "due_date" | "due_soon_days">
          >;
        Update: Partial<
          Pick<
            ItemRow,
            | "category_id"
            | "name"
            | "note"
            | "icon"
            | "schedule_type"
            | "interval_count"
            | "interval_unit"
            | "due_date"
            | "due_soon_days"
            | "archived_at"
          >
        >;
        Relationships: [];
      };
      completion_records: {
        Row: CompletionRow;
        Insert: Pick<CompletionRow, "item_id" | "completed_on"> & Partial<Pick<CompletionRow, "note" | "source">>;
        Update: Pick<CompletionRow, "undone_at">;
        Relationships: [];
      };
    };
    Views: {
      item_overview: {
        Row: ItemOverviewRow;
        Relationships: [];
      };
    };
    Functions: {
      regenerate_qr_token: {
        Args: { p_item_id: string };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = ProfileRow;
export type Category = CategoryRow;
export type Item = ItemRow;
export type ItemOverview = ItemOverviewRow;
export type CompletionRecord = CompletionRow;
