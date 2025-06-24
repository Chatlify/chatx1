/**
 * Profil Modal Bileşeni
 * Başka bir kullanıcının profil bilgilerini görüntülemek için kullanılır.
 * 
 * @param {Object} user - Görüntülenecek kullanıcı nesnesi
 * @param {Object} currentUser - Mevcut oturum açmış kullanıcı
 * @param {SupabaseClient} supabase - Supabase istemcisi
 * @param {Function} onComplete - Modal kapatıldığında çalıştırılacak fonksiyon
 */
window.initializeProfileModal = function (user, currentUser, supabase, onComplete) {
    console.log("Profil modalı yükleniyor:", user);

    // Panel elementi
    const modal = document.getElementById('profile-modal');
    if (!modal) {
        console.error('Profil modalı DOM\'da bulunamadı!');
        return;
    }

    // Panel için zamanlayıcı
    let modalCloseTimer;

    // Modal UI elementleri
    const elements = {
        // Avatar ve durum
        avatar: modal.querySelector('.profile-avatar img'),
        statusIndicator: modal.querySelector('.status-indicator'),
        statusDot: modal.querySelector('.status-dot'),
        statusText: modal.querySelector('.status-text'),

        // Kullanıcı bilgileri
        username: modal.querySelector('.profile-username'),
        tag: modal.querySelector('.profile-tag'),
        bio: modal.querySelector('.bio'),
        memberSince: modal.querySelector('.member-since'),

        // Rozetler
        badgesContainer: modal.querySelector('.badges-container'),

        // Butonlar
        messageButton: modal.querySelector('.message-btn'),
        callButton: modal.querySelector('.call-btn'),
        removeFriendButton: modal.querySelector('.remove-friend-btn'),
        blockButton: modal.querySelector('.block-btn'),
        closeButton: modal.querySelector('.close-modal-btn')
    };

    /**
     * Modal'ı animasyonlu bir şekilde açar
     */
    function openModal() {
        // İlk açılışta kullanıcı verilerini göster
        renderUserData();

        // Animasyonlu açılış için setTimeout kullanma
        clearTimeout(modalCloseTimer);
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });

        // ESC ile kapatma için event listener ekle
        document.addEventListener('keydown', handleEscapeKey);
    }

    /**
     * Modal'ı animasyonlu bir şekilde kapatır
     */
    function closeModal() {
        modal.classList.remove('active');

        // Animasyon tamamlanana kadar bekle
        modalCloseTimer = setTimeout(() => {
            // ESC ile kapatma event listener'ını kaldır
            document.removeEventListener('keydown', handleEscapeKey);

            // Tamamlandığında callback'i çağır
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }, 500); // CSS geçiş süresine uygun
    }

    /**
     * ESC tuşu ile modal'ı kapatma
     */
    function handleEscapeKey(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    /**
     * Profil için rozet oluşturur
     */
    function renderBadges() {
        // Rozet konteynırını temizle
        elements.badgesContainer.innerHTML = '';

        // Kullanıcının rozetleri var mı kontrol et
        const badges = user?.badges || [];

        if (badges.length === 0) {
            // Rozet yoksa boş durum göster
            const emptyBadge = document.createElement('div');
            emptyBadge.className = 'badge-item empty-badge';
            emptyBadge.innerHTML = `
                <div class="badge-placeholder"><i class="fas fa-plus"></i></div>
                <span>Rozet Yok</span>
            `;
            elements.badgesContainer.appendChild(emptyBadge);
            return;
        }

        // Rozetleri göster (en fazla 4 tane)
        const maxBadges = Math.min(badges.length, 4);
        for (let i = 0; i < maxBadges; i++) {
            const badge = badges[i];
            const badgeElement = document.createElement('div');
            badgeElement.className = 'badge-item earned';
            badgeElement.innerHTML = `
                <div class="badge-icon" title="${badge.name || 'Rozet'}">
                    <i class="${badge.icon || 'fas fa-award'}"></i>
                </div>
                <span>${badge.name || 'Rozet'}</span>
            `;
            elements.badgesContainer.appendChild(badgeElement);
        }

        // Daha fazla rozet varsa ek bir gösterge ekle
        if (badges.length > maxBadges) {
            const moreBadges = document.createElement('div');
            moreBadges.className = 'badge-item more-badge';
            moreBadges.innerHTML = `
                <div class="badge-placeholder">+${badges.length - maxBadges}</div>
                <span>Daha Fazla</span>
            `;
            elements.badgesContainer.appendChild(moreBadges);
        }
    }

    /**
     * Tarih biçimlendirme
     */
    function formatDate(dateString) {
        if (!dateString) return 'Bilinmiyor';

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Geçersiz Tarih';

            return date.toLocaleDateString('tr-TR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            });
        } catch (error) {
            console.error('Tarih biçimlendirme hatası:', error);
            return 'Bilinmiyor';
        }
    }

    /**
     * Kullanıcı bilgilerini görüntüler
     */
    function renderUserData() {
        try {
            // Kullanıcı bilgisi yoksa hata göster
            if (!user || typeof user !== 'object') {
                throw new Error('Geçerli kullanıcı verisi bulunamadı');
            }

            // Avatar
            if (user.avatar_url) {
                elements.avatar.src = user.avatar_url;
                elements.avatar.onerror = () => {
                    elements.avatar.src = 'images/defaultavatar.png';
                    console.warn('Avatar yüklenemedi, varsayılan avatar kullanılıyor');
                };
            } else {
                elements.avatar.src = 'images/defaultavatar.png';
            }

            // Kullanıcı adı - birkaç olası alan kontrolü yap
            const displayName = user.username || user.display_name || user.name || 'İsimsiz Kullanıcı';
            elements.username.textContent = displayName;
            document.title = `${displayName} - Profil | Chatlify`;

            // Kullanıcı etiketi
            if (user.tag) {
                elements.tag.textContent = `#${user.tag}`;
                elements.tag.style.display = '';
            } else {
                elements.tag.style.display = 'none';
            }

            // Çevrimiçi durumu
            const isOnline = user.is_online || false;
            elements.statusText.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';

            // Durum göstergeleri
            if (isOnline) {
                elements.statusIndicator.classList.add('online');
                elements.statusIndicator.classList.remove('offline');
                elements.statusDot.classList.add('online');

                // Yeni: profile-status container'a online/offline class ekleme
                const profileStatus = modal.querySelector('.profile-status');
                if (profileStatus) {
                    profileStatus.classList.add('online');
                    profileStatus.classList.remove('offline');
                }
            } else {
                elements.statusIndicator.classList.remove('online');
                elements.statusIndicator.classList.add('offline');
                elements.statusDot.classList.remove('online');

                // Yeni: profile-status container'a online/offline class ekleme
                const profileStatus = modal.querySelector('.profile-status');
                if (profileStatus) {
                    profileStatus.classList.remove('online');
                    profileStatus.classList.add('offline');
                }
            }

            // Biyografi
            elements.bio.textContent = user.bio || 'Bu kullanıcı henüz hakkında bir şey yazmamış.';

            // Üyelik bilgisi
            if (user.created_at) {
                elements.memberSince.textContent = formatDate(user.created_at);
            } else {
                elements.memberSince.textContent = 'Bilinmiyor';
            }

            // Rozetleri göster
            renderBadges();

        } catch (error) {
            console.error('Kullanıcı verisi yükleme hatası:', error);

            // Hata durumunda varsayılan değerler göster
            elements.username.textContent = 'Kullanıcı Bilgisi Yüklenemedi';
            elements.bio.textContent = 'Kullanıcı bilgisi yüklenirken bir hata oluştu.';
            elements.memberSince.textContent = 'Bilinmiyor';

            // Boş rozet göster
            elements.badgesContainer.innerHTML = `
                <div class="badge-item empty-badge">
                    <div class="badge-placeholder"><i class="fas fa-exclamation-triangle"></i></div>
                    <span>Hata</span>
                </div>
            `;
        }
    }

    // ----- Event Listeners -----

    // Mesaj gönderme butonu
    elements.messageButton.addEventListener('click', () => {
        closeModal();
        if (typeof onComplete === 'function') {
            onComplete({ action: 'message', userId: user.id });
        }
    });

    // Arama butonu
    elements.callButton.addEventListener('click', () => {
        alert('Sesli arama özelliği yakında eklenecek!');
    });

    // Arkadaşlıktan çıkarma butonu
    elements.removeFriendButton.addEventListener('click', async () => {
        const username = user.username || user.display_name || 'Bu kullanıcıyı';
        if (confirm(`${username} arkadaşlıktan çıkarmak istediğinize emin misiniz?`)) {
            try {
                // Arkadaşlık kaydını bul
                const { data: friendship, error: findError } = await supabase
                    .from('friendships')
                    .select('id')
                    .or(`and(user_id_1.eq.${currentUser.id},user_id_2.eq.${user.id}),and(user_id_1.eq.${user.id},user_id_2.eq.${currentUser.id})`)
                    .eq('status', 'accepted')
                    .single();

                if (findError || !friendship) {
                    throw new Error('Arkadaşlık kaydı bulunamadı.');
                }

                // Arkadaşlığı sil
                const { error: deleteError } = await supabase
                    .from('friendships')
                    .delete()
                    .eq('id', friendship.id);

                if (deleteError) {
                    throw deleteError;
                }

                alert(`${username} arkadaşlıktan çıkarıldı.`);
                closeModal();
                if (typeof onComplete === 'function') {
                    onComplete({ action: 'removed', userId: user.id });
                }
            } catch (error) {
                console.error('Arkadaşlıktan çıkarma hatası:', error);
                alert(`Bir hata oluştu: ${error.message}`);
            }
        }
    });

    // Engelleme butonu
    elements.blockButton.addEventListener('click', () => {
        alert('Engelleme özelliği yakında eklenecek!');
    });

    // Kapatma butonu
    elements.closeButton.addEventListener('click', closeModal);

    // Arkaplan tıklaması ile kapatma
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Modal'ı aç
    openModal();
}; 