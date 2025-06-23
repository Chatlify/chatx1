-- Bu SQL dosyasını Supabase SQL Editor'da çalıştırın

-- 1. Kabul edilmiş ama updated_at değeri null olan kayıtları düzelt
UPDATE friendships
SET updated_at = NOW()
WHERE status = 'accepted' AND updated_at IS NULL;

-- 2. Trigger fonksiyonunu oluştur
CREATE OR REPLACE FUNCTION update_friendship_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    -- Status değiştiğinde updated_at alanını güncelle
    IF OLD.status <> NEW.status THEN
        NEW.updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger'ı oluştur
DROP TRIGGER IF EXISTS set_friendship_timestamp ON friendships;
CREATE TRIGGER set_friendship_timestamp
BEFORE UPDATE ON friendships
FOR EACH ROW
EXECUTE FUNCTION update_friendship_timestamp();

-- 4. Basit bir arkadaşlık kabul fonksiyonu
CREATE OR REPLACE FUNCTION accept_friendship_request(request_id integer)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- İsteği kabul et ve updated_at'i güncelle
  UPDATE friendships
  SET status = 'accepted',
      updated_at = NOW()
  WHERE id = request_id;
  
  -- Güncelleme başarılı mı kontrol et
  IF FOUND THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$; 