import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import PondManageView from '@/components/ponds/PondManageView';
import { formatSupabaseError } from '@/lib/supabaseErrors';
import { useAuth } from '@/lib/AuthContext';
import { isFieldRole, isPondInFieldUserScope, filterPondsForFieldUser } from '@/lib/fieldAuthHelpers';

const VALID_TABS = new Set(['plan', 'log', 'harvest', 'qr']);

function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

export default function PondDetailPage() {
  const { pondId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab = tabParam && VALID_TABS.has(tabParam) ? tabParam : 'plan';

  const [pond, setPond] = useState(null);
  const [siblingPonds, setSiblingPonds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!pondId) return;
    setError('');
    setLoading(true);
    try {
      const allPromise = base44.entities.Pond.listWithHouseholds('-updated_at', 500);
      let p = looksLikeUuid(pondId) ? await base44.entities.Pond.getWithCycles(pondId) : null;
      if (!p) {
        p = await base44.entities.Pond.findByCodeFlattened(pondId);
      }
      const all = await allPromise;
      setPond(p);
      const allScoped = isFieldRole(user?.role) ? filterPondsForFieldUser(user, all || []) : all || [];
      setSiblingPonds(allScoped);
      if (!p) setError('Không tìm thấy ao.');
    } catch (e) {
      setError(formatSupabaseError(e));
      setPond(null);
    }
    setLoading(false);
  }, [pondId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const outOfScope = useMemo(
    () => !loading && pond && isFieldRole(user?.role) && !isPondInFieldUserScope(user, pond),
    [loading, pond, user]
  );

  const setTab = (v) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'plan') next.delete('tab');
    else next.set('tab', v);
    setSearchParams(next, { replace: true });
  };

  if (outOfScope) {
    return <Navigate to="/ponds" replace />;
  }

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto min-h-0">
      <div className="mb-3 flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => navigate('/ponds')}>
          <ArrowLeft className="w-4 h-4" />
          Danh sách ao
        </Button>
      </div>

      {loading && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground text-sm">
          Đang tải…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {!loading && pond && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <PondManageView
            pond={pond}
            siblingPonds={siblingPonds}
            activeTab={activeTab}
            onTabChange={setTab}
            onUpdate={load}
            onDeleted={() => navigate('/ponds')}
          />
        </div>
      )}
    </div>
  );
}
