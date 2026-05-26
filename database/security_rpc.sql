-- ==========================================
-- SCRIPT: FUNCIÓN RPC PARA MENÚ DINÁMICO Y PERMISOS
-- ==========================================
-- Esta función lee la matriz de seguridad y devuelve el menú
-- INCLUYENDO las acciones permitidas (códigos) para que el
-- Frontend pueda ocultar/mostrar botones específicos.

CREATE OR REPLACE FUNCTION get_user_modules(p_user_id BIGINT)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
          'id', m.id,
          'name', m.name,
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

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION get_user_modules(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_modules(BIGINT) TO anon;
