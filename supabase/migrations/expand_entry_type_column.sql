-- Expande a coluna entry_type de VARCHAR(10) para VARCHAR(20)
-- para acomodar novos tipos: coffee_start, coffee_end, lunch_start, lunch_end
ALTER TABLE time_entries ALTER COLUMN entry_type TYPE VARCHAR(20);
