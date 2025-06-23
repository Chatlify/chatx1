-- Arkadaşlık isteğini kabul etmek için RPC fonksiyonu
CREATE OR REPLACE FUNCTION accept_friendship_request(request_id integer, update_time timestamptz DEFAULT now())
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Arkadaşlık isteğini güncelle
  UPDATE friendships
  SET status = 'accepted', 
      updated_at = update_time
  WHERE id = request_id;
  
  -- Güncelleme başarılı mı kontrol et
  IF FOUND THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$; 