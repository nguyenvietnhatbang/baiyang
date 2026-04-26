import { useState } from 'react';
import { X, Fish, ClipboardList, ShoppingCart, QrCode, Pencil, AlertTriangle } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PondPlanTab from './PondPlanTab';
import PondLogTab from './PondLogTab';
import PondHarvestTab from './PondHarvestTab';
import PondQRCode from './PondQRCode';
import PondEditDialog from './PondEditDialog';
import { differenceInDays, parseISO } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

export default function PondDrawer({ pond, onClose, onUpdate, siblingPonds = [] }) {
  const { harvestAlertDays, user } = useAuth();
  const isAdmin = user?.role === 'admin';
  // Đã đăng nhập → form kế hoạch luôn mở trên UI; quyền ghi thật do RLS + trigger DB.
  const canEditThisPond = Boolean(user);
  const today = new Date();
  const [showEdit, setShowEdit] = useState(false);

  const isWithdrawal = pond.withdrawal_end_date &&
    differenceInDays(parseISO(pond.withdrawal_end_date), today) >= 0;

  const harvestDiff = pond.expected_harvest_date
    ? differenceInDays(parseISO(pond.expected_harvest_date), today)
    : null;

  const isUrgent = harvestDiff !== null && harvestDiff <= harvestAlertDays;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
        <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative w-full max-w-2xl h-full bg-card shadow-2xl flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-start justify-between"
            style={{ background: 'hsl(var(--primary))' }}>
            <div>
              <div className="flex items-center gap-2">
                <Fish className="w-5 h-5 text-white/80" />
                <h2 className="text-lg font-bold text-white">{pond.code}</h2>
                {isUrgent && (
                  <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold pulse-urgent">
                    ƯU TIÊN THU
                  </span>
                )}
                {isWithdrawal && (
                  <span className="bg-orange-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                    NGƯNG THUỐC
                  </span>
                )}
              </div>
              <p className="text-blue-200 text-sm mt-0.5">{pond.owner_name} • {pond.area} m²</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEdit(true)}
                className="text-white/70 hover:text-white transition-colors p-1 rounded"
                title="Chỉnh sửa / Xóa ao"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Warning bar */}
          {isWithdrawal && (
            <div className="px-6 py-2 bg-orange-50 border-b border-orange-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <p className="text-xs text-orange-700 font-medium">
                Còn {differenceInDays(parseISO(pond.withdrawal_end_date), today)} ngày ngưng thuốc.
                Hết ngưng: {pond.withdrawal_end_date}. Chưa được lên lịch thu hoạch.
              </p>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="plan" className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-3 border-b border-border bg-card">
              <TabsList className="bg-muted">
                <TabsTrigger value="plan" className="flex items-center gap-1.5 text-xs">
                  <Fish className="w-3.5 h-3.5" />Kế hoạch
                </TabsTrigger>
                <TabsTrigger value="log" className="flex items-center gap-1.5 text-xs">
                  <ClipboardList className="w-3.5 h-3.5" />Nhật ký
                </TabsTrigger>
                <TabsTrigger value="harvest" className="flex items-center gap-1.5 text-xs">
                  <ShoppingCart className="w-3.5 h-3.5" />Thu hoạch
                </TabsTrigger>
                <TabsTrigger value="qr" className="flex items-center gap-1.5 text-xs">
                  <QrCode className="w-3.5 h-3.5" />Mã QR
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="plan" className="p-6 mt-0">
                <PondPlanTab
                  pond={pond}
                  onUpdate={onUpdate}
                  isWithdrawal={isWithdrawal}
                  canEditPlan={canEditThisPond}
                  canEditAdjustedPlan={canEditThisPond}
                  isAdmin={isAdmin}
                  siblingPonds={siblingPonds}
                />
              </TabsContent>
              <TabsContent value="log" className="p-6 mt-0">
                <PondLogTab pond={pond} onUpdate={onUpdate} />
              </TabsContent>
              <TabsContent value="harvest" className="p-6 mt-0">
                <PondHarvestTab pond={pond} onUpdate={onUpdate} isWithdrawal={isWithdrawal} />
              </TabsContent>
              <TabsContent value="qr" className="p-6 mt-0 flex flex-col items-center">
                <p className="text-xs text-muted-foreground mb-6 text-center">
                  In mã QR này và dán tại ao để quét nhanh khi nhập nhật ký.
                </p>
                <PondQRCode pond={pond} size={220} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>

      {showEdit && (
        <PondEditDialog
          pond={pond}
          canEditCode={canEditPlan}
          open={showEdit}
          onClose={() => setShowEdit(false)}
          onSaved={() => { onUpdate(); setShowEdit(false); }}
          onDeleted={() => { onClose(); onUpdate(); }}
        />
      )}
    </>
  );
}