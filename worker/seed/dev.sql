-- Local development only: the demo site from demo/, reachable as localhost and 127.0.0.1.
INSERT INTO sites (id, name, origin, created_at)
VALUES ('demo', 'Demo', 'http://localhost:4321 http://127.0.0.1:4321', unixepoch() * 1000)
ON CONFLICT (id) DO UPDATE SET origin = excluded.origin;
