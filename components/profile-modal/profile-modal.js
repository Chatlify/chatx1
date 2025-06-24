/**
 * Profil Modal Bileşeni
 * Başka bir kullanıcının profil bilgilerini görüntülemek için kullanılır.
 * Bu fonksiyon, bir "başlatıcı" fonksiyon döndürür.
 */
function createProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) {
        console.error('Profil modalı DOM\'da bulunamadı!');
        return null;
    }

    let modalCloseTimer;
    let currentUser, supabase, onComplete;

    const elements = {
        avatar: modal.querySelector('.profile-avatar img'),
        statusIndicator: modal.querySelector('.status-indicator'),
        statusDot: modal.querySelector('.status-dot'),
        statusText: modal.querySelector('.status-text'),
        username: modal.querySelector('.profile-username'),
        tag: modal.querySelector('.profile-tag'),
        bio: modal.querySelector('.bio'),
        memberSince: modal.querySelector('.member-since'),
        memberDuration: modal.querySelector('.member-duration'),
        badgesContainer: modal.querySelector('.badges-container'),
        messageButton: modal.querySelector('.message-btn'),
        callButton: modal.querySelector('.call-btn'),
        removeFriendButton: modal.querySelector('.remove-friend-btn'),
        blockButton: modal.querySelector('.block-btn'),
        closeButton: modal.querySelector('.close-modal-btn')
    };

    function closeModal() {
        modal.classList.remove('active');
        modalCloseTimer = setTimeout(() => {
            document.removeEventListener('keydown', handleEscapeKey);
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }, 500);
    }

    function handleEscapeKey(event) {
        if (event.key === 'Escape') {
            closeModal();
        }
    }

    function renderBadges(user) {
        elements.badgesContainer.innerHTML = '';
        const badges = user?.badges || [];
        if (badges.length === 0) {
            const emptyBadge = document.createElement('div');
            emptyBadge.className = 'badge-item empty-badge';
            emptyBadge.innerHTML = `
                <div class="badge-placeholder"><i class="fas fa-plus"></i></div>
                <span>Rozet Yok</span>
            `;
            elements.badgesContainer.appendChild(emptyBadge);
            return;
        }
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

    function formatDate(dateString) {
        if (!dateString) return 'Bilinmiyor';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'Geçersiz Tarih';
            return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (error) {
            console.error('Tarih biçimlendirme hatası:', error);
            return 'Bilinmiyor';
        }
    }

    function calculateTimeElapsed(dateString) {
        if (!dateString) return 'Bilinmiyor';
        try {
            const startDate = new Date(dateString);
            if (isNaN(startDate.getTime())) return 'Geçersiz Tarih';
            const now = new Date();
            const diffTime = Math.abs(now - startDate);
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            const diffMonths = Math.floor(diffDays / 30);
            const diffYears = Math.floor(diffDays / 365);
            if (diffYears > 0) return `${diffYears} yıl ${Math.floor((diffDays % 365) / 30)} ay`;
            if (diffMonths > 0) return `${diffMonths} ay ${diffDays % 30} gün`;
            return `${diffDays} gün`;
        } catch (error) {
            console.error('Süre hesaplama hatası:', error);
            return 'Bilinmiyor';
        }
    }

    function renderUserData(user) {
        try {
            if (!user || typeof user !== 'object') {
                throw new Error('Geçerli kullanıcı verisi bulunamadı');
            }
            if (user.avatar_url) {
                elements.avatar.src = user.avatar_url;
                elements.avatar.onerror = () => { elements.avatar.src = 'images/defaultavatar.png'; };
            } else {
                elements.avatar.src = 'images/defaultavatar.png';
            }
            const displayName = user.username || user.display_name || user.name || 'İsimsiz Kullanıcı';
            elements.username.textContent = displayName;
            document.title = `${displayName} - Profil | Chatlify`;
            if (user.tag) {
                elements.tag.textContent = `#${user.tag}`;
                elements.tag.style.display = '';
            } else {
                elements.tag.style.display = 'none';
            }
            const isOnline = user.is_online || false;
            elements.statusText.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
            if (isOnline) {
                elements.statusIndicator.classList.add('online');
                elements.statusDot.classList.add('online');
            } else {
                elements.statusIndicator.classList.remove('online');
                elements.statusDot.classList.remove('online');
            }
            elements.bio.textContent = user.bio || 'Bu kullanıcı henüz hakkında bir şey yazmamış.';
            if (user.created_at) {
                elements.memberSince.textContent = formatDate(user.created_at);
                elements.memberDuration.textContent = calculateTimeElapsed(user.created_at);
            } else {
                elements.memberSince.textContent = 'Bilinmiyor';
                elements.memberDuration.textContent = 'Bilinmiyor';
            }
            renderBadges(user);
        } catch (error) {
            console.error('Kullanıcı verisi yükleme hatası:', error);
            elements.username.textContent = 'Kullanıcı Bilgisi Yüklenemedi';
        }
    }

    elements.closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    elements.callButton.addEventListener('click', () => alert('Sesli arama özelliği yakında eklenecek!'));
    elements.blockButton.addEventListener('click', () => alert('Engelleme özelliği yakında eklenecek!'));

    return function initialize(user, _currentUser, _supabase, _onComplete) {
        console.log("Profil modalı başlatılıyor:", user);
        currentUser = _currentUser;
        supabase = _supabase;
        onComplete = _onComplete;
        renderUserData(user);
        clearTimeout(modalCloseTimer);
        requestAnimationFrame(() => {
            modal.classList.add('active');
        });
        document.addEventListener('keydown', handleEscapeKey);

        elements.removeFriendButton.onclick = async () => {
            const username = user.username || user.display_name || 'Bu kullanıcıyı';
            if (confirm(`${username} arkadaşlıktan çıkarmak istediğinize emin misiniz?`)) {
                try {
                    const { data: friendship, error: findError } = await supabase.from('friendships').select('id').or(`and(user_id_1.eq.${currentUser.id},user_id_2.eq.${user.id}),and(user_id_1.eq.${user.id},user_id_2.eq.${currentUser.id})`).eq('status', 'accepted').single();
                    if (findError || !friendship) throw new Error('Arkadaşlık kaydı bulunamadı.');
                    const { error: deleteError } = await supabase.from('friendships').delete().eq('id', friendship.id);
                    if (deleteError) throw deleteError;
                    alert(`${username} arkadaşlıktan çıkarıldı.`);
                    closeModal();
                    if (typeof onComplete === 'function') onComplete({ action: 'removed', userId: user.id });
                } catch (error) {
                    console.error('Arkadaşlıktan çıkarma hatası:', error);
                    alert(`Bir hata oluştu: ${error.message}`);
                }
            }
        };
        elements.messageButton.onclick = () => {
            closeModal();
            if (typeof onComplete === 'function') onComplete({ action: 'message', userId: user.id });
        };
    };
}
window.createProfileModalInitializer = createProfileModal;