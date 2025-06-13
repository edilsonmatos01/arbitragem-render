-- Multiplica todos os spreads por 100 para converter em porcentagem
UPDATE "SpreadHistory"
SET spread = spread * 100
WHERE spread < 1; -- Apenas atualiza registros que parecem estar na escala decimal 