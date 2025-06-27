-- Deletar registros de SpreadHistory mais antigos que 7 dias
DELETE FROM "SpreadHistory"
WHERE timestamp < NOW() - INTERVAL '7 days';

-- Deletar registros de PriceHistory mais antigos que 7 dias
DELETE FROM "PriceHistory"
WHERE timestamp < NOW() - INTERVAL '7 days';

-- Executar VACUUM para liberar espaço físico
VACUUM FULL "SpreadHistory";
VACUUM FULL "PriceHistory";

-- Mostrar quantidade de registros restantes
SELECT 'SpreadHistory' as table_name, COUNT(*) as remaining_records
FROM "SpreadHistory"
UNION ALL
SELECT 'PriceHistory' as table_name, COUNT(*) as remaining_records
FROM "PriceHistory"; 