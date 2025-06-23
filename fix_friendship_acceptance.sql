-- Daha güçlü bir arkadaşlık isteği kabul fonksiyonu
CREATE OR REPLACE FUNCTION accept_friendship_request_v2(request_id integer)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  friendship_record RECORD;
  success BOOLEAN;
BEGIN
  -- Önce isteği getir
  SELECT * INTO friendship_record 
  FROM friendships 
  WHERE id = request_id;
  
  -- Kayıt yoksa false döndür
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- İsteği kabul et ve updated_at'i güncelle
  UPDATE friendships
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = request_id;
  
  -- Güncelleme başarılı mı kontrol et
  GET DIAGNOSTICS success = ROW_COUNT;
  
  -- Sonucu döndür
  RETURN success > 0;
END;
$$;

-- Tüm kabul edilmiş istekleri düzelt
UPDATE friendships
SET updated_at = NOW()
WHERE status = 'accepted' AND updated_at IS NULL; 