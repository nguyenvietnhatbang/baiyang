import { Navigate } from 'react-router-dom';

/** Hộ nuôi gộp vào trang Quản lý ao (tab thứ 2). */
export default function Households() {
  return <Navigate to="/ponds?tab=households" replace />;
}
