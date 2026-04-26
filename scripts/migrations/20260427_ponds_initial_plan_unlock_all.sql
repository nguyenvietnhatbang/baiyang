-- Bỏ trạng thái khóa đăng ký ban đầu trên mọi ao (UI không còn khóa).
update public.ponds set initial_plan_locked = false;
