# My Pond App (React + Vite + Supabase)

## Tài khoản hiện trường & admin

- **Đại lý / chủ hộ:** `/login` mặc định là **Hiện trường** (SĐT + mật khẩu). Văn phòng: `/login?mode=office`. `/field/login` chuyển về `/login`.
- **Admin văn phòng:** `/login` (email + mật khẩu) — vẫn dùng Supabase Auth. Trang `/admin` **insert** trực tiếp vào `field_accounts` (mật khẩu **plaintext**, tiện ích nội bộ).

### SQL (Supabase SQL Editor)

1. [`scripts/migrations/20260429_field_accounts.sql`](scripts/migrations/20260429_field_accounts.sql) — bảng `field_accounts`, RLS chỉ admin.
2. [`scripts/migrations/20260430_field_account_verify_rpc.sql`](scripts/migrations/20260430_field_account_verify_rpc.sql) — RPC đăng nhập hiện trường; gỡ cột `auth_user_id` nếu DB còn bản migration cũ.

### Mã vùng / biển số

`region_codes.code` là **đầu biển số xe** theo tỉnh (đồng bộ `src/lib/vietnamProvinces.js`). DB cũ đang dùng mã hành chính (01, 02…) thì chạy [`scripts/migrations/20260502_region_codes_license_plate.sql`](scripts/migrations/20260502_region_codes_license_plate.sql).

### RLS / hiện trường

Tài khoản hiện trường không có JWT `authenticated` — request dùng **anon key**. Nhiều policy trong schema cho phép thao tác khi `app_settings_bypass_rls()` là true. Nếu `bypass_rls = false`, có thể cần nới policy hoặc chỉ dùng chế độ bypass cho môi trường tiện ích.

---

# React + Vite

This template provides a minimal setup for React with Vite and ESLint.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
