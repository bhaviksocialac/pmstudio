declare module "frappe-gantt" {
  // Minimal ambient types — Frappe Gantt has no shipped d.ts.
  export interface FrappeTaskInput {
    id: string;
    name: string;
    start: string | Date;
    end: string | Date;
    progress?: number;
    dependencies?: string;
    custom_class?: string;
  }
  export interface PopupCtx {
    task: { name: string; start: string | Date; end: string | Date; progress?: number };
    set_title: (s: string) => void;
    set_subtitle: (s: string) => void;
    set_details: (s: string) => void;
  }
  export interface GanttOptions {
    view_mode?: string;
    view_modes?: unknown[];
    bar_height?: number;
    bar_corner_radius?: number;
    padding?: number;
    readonly?: boolean;
    infinite_padding?: boolean;
    today_button?: boolean;
    view_mode_select?: boolean;
    popup?: (ctx: PopupCtx) => void;
    on_click?: (task: { id: string }) => void;
    on_date_change?: (task: { id: string }, start: Date, end: Date) => void;
    on_view_change?: (mode: { name: string }) => void;
  }
  export default class Gantt {
    constructor(target: HTMLElement | string, tasks: FrappeTaskInput[], options?: GanttOptions);
    refresh(tasks: FrappeTaskInput[]): void;
    change_view_mode(mode?: string): void;
    scroll_current?: () => void;
  }
}
