// Ambient declarations for CDN globals

interface FlatpickrInstance {
  destroy(): void;
  clear(): void;
  setDate(date: string | Date, triggerChange?: boolean): void;
  set(option: string, value: unknown): void;
  selectedDates: Date[];
  input: HTMLInputElement;
  calendarContainer: HTMLDivElement;
}

interface FlatpickrOptions {
  dateFormat?: string;
  defaultDate?: string | Date | null;
  minDate?: string | Date | null;
  maxDate?: string | Date | null;
  disableMobile?: boolean;
  disable?: Array<((date: Date) => boolean) | { from: string; to: string }>;
  allowInput?: boolean;
  onChange?: (selectedDates: Date[], dateStr: string, instance: FlatpickrInstance) => void;
  onOpen?: (selectedDates: Date[], dateStr: string, instance: FlatpickrInstance) => void;
}

declare function flatpickr(
  element: HTMLElement | string,
  options?: FlatpickrOptions
): FlatpickrInstance;

declare namespace XLSX {
  namespace utils {
    function aoa_to_sheet(data: unknown[][]): unknown;
    function book_new(): unknown;
    function book_append_sheet(wb: unknown, ws: unknown, name: string): void;
    function sheet_to_json(sheet: unknown, opts?: { header?: number; raw?: boolean; defval?: string }): unknown[][];
  }
  function read(data: Uint8Array, opts?: { type?: string }): {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
  function writeFile(wb: unknown, filename: string): void;
}
