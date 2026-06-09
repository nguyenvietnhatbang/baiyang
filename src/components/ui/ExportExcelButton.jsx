import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { downloadTableExcel } from '@/lib/tableExcelExport';
import { toast } from 'sonner';

/**
 * @param {object} props
 * @param {string} props.fileName
 * @param {string} [props.sheetName]
 * @param {string} [props.title]
 * @param {Array} props.columns
 * @param {Array} [props.rows]
 * @param {() => Array | Promise<Array>} [props.getRows]
 */
export function ExportExcelButton({
  fileName,
  sheetName,
  title,
  columns,
  rows,
  getRows,
  disabled,
  className = 'gap-2 text-base font-bold h-10 px-4 shrink-0',
  variant = 'outline',
  size,
  label = 'Tải Excel',
}) {
  const [exporting, setExporting] = useState(false);

  const handleClick = async () => {
    setExporting(true);
    try {
      const data = typeof getRows === 'function' ? await getRows() : rows;
      if (!data?.length) {
        toast.message('Không có dữ liệu để xuất');
        return;
      }
      await downloadTableExcel({
        fileName,
        sheetName,
        title,
        columns,
        rows: data,
      });
      toast.success('Đã tải file Excel');
    } catch (e) {
      console.error(e);
      toast.error('Không xuất được Excel');
    }
    setExporting(false);
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={disabled || exporting || !columns?.length}
      onClick={() => void handleClick()}
    >
      <Download className="w-4 h-4 shrink-0" />
      <span className="hidden sm:inline">{exporting ? 'Đang xuất…' : label}</span>
      <span className="sm:hidden">{exporting ? '…' : 'Excel'}</span>
    </Button>
  );
}
