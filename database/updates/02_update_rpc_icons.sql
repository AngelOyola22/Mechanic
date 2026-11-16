-- ==========================================
-- SCRIPT DE ACTUALIZACIÓN: RPC para Íconos
-- ==========================================

CREATE OR REPLACE FUNCTION get_user_modules(p_user_id BIGINT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
          'id', m.id,
          'name', m.name,
          'icon', m.icon,
          'screens', m_screens.screens_array
      ) ORDER BY m.id
  ), '[]'::jsonb)
  FROM seg_modules m
  JOIN (
      -- Agrupar las pantallas y sus acciones permitidas
      SELECT 
          s.module_id,
          jsonb_agg(
              jsonb_build_object(
                  'id', s.id,
                  'name', s.name,
                  'icon', s.icon,
                  'route', s.route,
                  'actions', user_screen_actions.action_codes
              ) ORDER BY s.id
          ) as screens_array
      FROM seg_screens s
      JOIN (
          -- Obtener las acciones específicas que este usuario tiene en cada pantalla
          SELECT a.screen_id, jsonb_agg(a.code) as action_codes
          FROM seg_user_roles ur
          JOIN seg_role_permissions rp ON rp.role_id = ur.role_id
          JOIN seg_actions a ON a.id = rp.action_id
          WHERE ur.user_id = p_user_id
          GROUP BY a.screen_id
      ) user_screen_actions ON s.id = user_screen_actions.screen_id
      GROUP BY s.module_id
  ) m_screens ON m.id = m_screens.module_id;
$$;
