-- Tüm arkadaşlık isteklerini kontrol et
SELECT * FROM friendships 
ORDER BY created_at DESC 
LIMIT 20;

-- Bekleyen istekleri kontrol et
SELECT f.*, 
       p1.username as sender_username, 
       p2.username as receiver_username
FROM friendships f
JOIN profiles p1 ON f.user_id_1 = p1.id
JOIN profiles p2 ON f.user_id_2 = p2.id
WHERE f.status = 'pending'
ORDER BY f.created_at DESC;

-- Kabul edilen istekleri kontrol et
SELECT f.*, 
       p1.username as sender_username, 
       p2.username as receiver_username
FROM friendships f
JOIN profiles p1 ON f.user_id_1 = p1.id
JOIN profiles p2 ON f.user_id_2 = p2.id
WHERE f.status = 'accepted'
ORDER BY f.updated_at DESC;

-- Belirli bir kullanıcının arkadaşlık durumunu kontrol et
-- Kullanıcı ID'sini buraya gir
SELECT f.*, 
       p1.username as user1_username, 
       p2.username as user2_username,
       f.status,
       f.created_at,
       f.updated_at
FROM friendships f
JOIN profiles p1 ON f.user_id_1 = p1.id
JOIN profiles p2 ON f.user_id_2 = p2.id
WHERE f.user_id_1 = 'KULLANICI_ID_BURAYA' 
   OR f.user_id_2 = 'KULLANICI_ID_BURAYA'
ORDER BY f.updated_at DESC;

-- Sorunlu kayıtları tespit et
-- Kabul edilmiş ama updated_at değeri null olan kayıtlar
SELECT * FROM friendships 
WHERE status = 'accepted' AND updated_at IS NULL;

-- Aynı kullanıcılar arasında birden fazla arkadaşlık kaydı var mı?
SELECT user_id_1, user_id_2, COUNT(*) as count
FROM friendships
GROUP BY user_id_1, user_id_2
HAVING COUNT(*) > 1;

-- Sorunu düzeltmek için
-- Belirli bir arkadaşlık kaydını manuel olarak kabul edilmiş olarak işaretle
UPDATE friendships
SET status = 'accepted', 
    updated_at = NOW()
WHERE id = 3; -- İstek ID'sini buraya gir

-- Tüm bekleyen istekleri kabul et (DİKKAT: Sadece test ortamında kullan!)
-- UPDATE friendships
-- SET status = 'accepted', 
--     updated_at = NOW()
-- WHERE status = 'pending'; 