-- SQL çalıştırmak için güvenli bir fonksiyon
-- NOT: Bu fonksiyon sadece güvenli SQL komutları çalıştırmalıdır
-- Üretim ortamında bu tür fonksiyonlar güvenlik riski oluşturabilir
CREATE OR REPLACE FUNCTION execute_sql(sql_query text)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Sadece UPDATE friendships komutlarına izin ver
  IF sql_query LIKE 'UPDATE friendships SET status = ''accepted''%' THEN
    EXECUTE sql_query;
    RETURN TRUE;
  ELSE
    RAISE EXCEPTION 'Unauthorized SQL query: %', sql_query;
    RETURN FALSE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error executing SQL: %', SQLERRM;
    RETURN FALSE;
END;
$$; 