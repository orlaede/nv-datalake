INSERT INTO auth.permissions (permission_key, name, description)
VALUES
    ('dashboard.read', 'Visualizar dashboard', 'Permite consultar os indicadores do dashboard.'),
    ('autos.read', 'Consultar autos', 'Permite consultar a listagem e os agrupamentos de autos.'),
    ('autos.export', 'Exportar autos', 'Permite exportar autos para Excel e PDF.'),
    ('users.read', 'Visualizar usuários', 'Permite visualizar usuários da aplicação.'),
    ('users.manage', 'Administrar usuários', 'Permite criar, editar, ativar e desativar usuários.'),
    ('roles.manage', 'Administrar roles', 'Permite criar roles e atribuir permissões.')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO auth.roles (role_key, name, description)
VALUES
    ('admin', 'Administrador', 'Acesso completo à aplicação.'),
    ('operador', 'Operador', 'Consulta e exportação de autos.'),
    ('consulta', 'Consulta', 'Somente consulta de dashboard e autos.')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO auth.role_permissions (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM auth.roles r
JOIN auth.permissions p ON (
    r.role_key = 'admin'
    OR (r.role_key = 'operador' AND p.permission_key IN ('dashboard.read', 'autos.read', 'autos.export'))
    OR (r.role_key = 'consulta' AND p.permission_key IN ('dashboard.read', 'autos.read'))
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
