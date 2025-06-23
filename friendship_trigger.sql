-- Önce trigger fonksiyonunu oluştur
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

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS set_friendship_timestamp ON friendships;
CREATE TRIGGER set_friendship_timestamp
BEFORE UPDATE ON friendships
FOR EACH ROW
EXECUTE FUNCTION update_friendship_timestamp();

-- Mevcut NULL updated_at değerlerini düzelt
UPDATE friendships
SET updated_at = NOW()
WHERE status = 'accepted' AND updated_at IS NULL; 