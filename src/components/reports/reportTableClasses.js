import { cn } from '@/lib/utils';



/** Padding ô bảng (khớp Chu kỳ ao). */

const REPORT_CELL_PAD = 'px-4 py-3.5';



/** Khung cuộn + lớp shell: typography cố định trong index.css (.report-table-shell). */

export const reportTableScroll = cn(

  'report-table-shell overflow-x-auto max-w-full pb-2',

  '[&_table]:w-full [&_table]:min-w-max [&_table]:border-collapse',

  '[&_table]:border-2 [&_table]:border-slate-400',

  '[&_th]:border-2 [&_th]:border-slate-400',

  '[&_td]:border-2 [&_td]:border-slate-400',

  'dark:[&_table]:border-slate-500 dark:[&_th]:border-slate-500 dark:[&_td]:border-slate-500'

);



export const reportTable = 'w-full min-w-max border-collapse';



export const reportTh = cn(

  REPORT_CELL_PAD,

  'text-center whitespace-nowrap border-r border-border'

);



export const reportThLeft = cn(REPORT_CELL_PAD, 'text-left whitespace-nowrap border-r border-border');



export const reportThLast = cn(REPORT_CELL_PAD, 'text-center whitespace-nowrap');



export const reportThSub = cn(REPORT_CELL_PAD, 'text-center whitespace-nowrap');



/** Căn lề ô — không gắn font-size/weight (shell CSS đảm nhiệm). */

export const reportTd = cn(REPORT_CELL_PAD, 'whitespace-nowrap');



export const reportTdCenter = cn(reportTd, 'text-center');



export const reportTdLeft = cn(reportTd, 'text-left');



/** Số: tabular-nums chỉ trên ô số, tránh ảnh hưởng cột mã ao chữ. */

export const reportTdRight = cn(reportTd, 'text-right report-table-num');



export const reportTdBoldRight = cn(reportTdRight, 'report-table-total');



/** Mã ao — mono + căn giữa, đồng nhất từng dòng. */

export const reportTdCode = cn(reportTd, 'text-center report-table-code');



export const reportTdTotalLabel = cn(reportTd, 'report-table-total');



export function reportNumCellClass({ bold = false, border = false, extra = '' } = {}) {

  return cn(reportTdRight, bold && 'report-table-total', border && 'border-r border-border', extra);

}



export const reportBanner = cn(

  'px-5 py-3.5 bg-muted/30 border-b border-border text-base text-muted-foreground font-semibold leading-normal'

);



export const reportAlert =

  'text-base font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2';

