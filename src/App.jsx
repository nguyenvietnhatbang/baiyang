import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import AuthGate from '@/components/AuthGate';
import OfficeRoleGate from '@/components/routing/OfficeRoleGate';
import FieldRoleGate from '@/components/routing/FieldRoleGate';
import Login from '@/pages/Login';

// Pages
import Dashboard from './pages/Dashboard';
import Ponds from './pages/Ponds';
import PondDetailPage from './pages/PondDetailPage';
import Logs from './pages/Logs';
import Reports from './pages/Reports';
import Agencies from './pages/Agencies';
import Households from './pages/Households';
import Settings from './pages/Settings';
import FieldLayout from '@/pages/field/FieldLayout';
import FieldHome from '@/pages/field/FieldHome';
import FieldLogPage from '@/pages/field/FieldLogPage';
import FieldHouseholdPage from '@/pages/field/FieldHouseholdPage';
import FieldScanPage from '@/pages/field/FieldScanPage';
import AdminUsers from '@/pages/admin/AdminUsers';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/field/login" element={<Navigate to="/login" replace />} />
            <Route element={<AuthGate />}>
              <Route path="/field" element={<FieldRoleGate />}>
                <Route element={<FieldLayout />}>
                  <Route index element={<FieldHome />} />
                  <Route path="log" element={<FieldLogPage />} />
                  <Route path="household" element={<FieldHouseholdPage />} />
                  <Route path="scan" element={<FieldScanPage />} />
                </Route>
              </Route>
              <Route element={<OfficeRoleGate />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/ponds" element={<Ponds />} />
                  <Route path="/ponds/:pondId" element={<PondDetailPage />} />
                  <Route path="/logs" element={<Logs />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/agencies" element={<Agencies />} />
                  <Route path="/households" element={<Households />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/admin" element={<AdminUsers />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
