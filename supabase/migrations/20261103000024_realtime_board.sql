-- =============================================================================
-- Papan servis realtime (PRD §7.3): perubahan work order disiarkan lewat Supabase Realtime.
-- Siaran mengikuti RLS (pengguna hanya menerima WO yang boleh dilihatnya). Klien memakai siaran
-- hanya sebagai pemicu muat ulang data, dengan polling 30 detik sebagai cadangan.
-- =============================================================================
alter publication supabase_realtime add table public.work_orders, public.work_order_items, public.work_order_mechanics;
