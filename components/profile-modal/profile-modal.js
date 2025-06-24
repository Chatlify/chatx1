/**
 * Profil Modal Bileşeni
 * Bu fonksiyon, bir "başlatıcı" fonksiyon döndürür.
 */
function createProfileModalInitializer() {
    const modal = document.getElementById('profile-modal');
    if (!modal) {
        console.error('Profil modalı DOM\'da bulunamadı!');
        return null;
    }

    let modalCloseTimer;
    let currentUser, supabase, onComplete, activeUser;

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
        document.removeEventListener('keydown', handleEscapeKey);
        modalCloseTimer = setTimeout(() => {
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
            elements.badgesContainer.innerHTML = `
                <div class="badge-item empty-badge">
                    <div class="badge-placeholder"><i class="fas fa-plus"></i></div>
                    <span>Rozet Yok</span>
                </div>`;
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
            if (!user) throw new Error('Geçerli kullanıcı verisi bulunamadı');
            elements.avatar.src = user.avatar_url || 'images/defaultavatar.png';
            const displayName = user.username || user.display_name || 'İsimsiz Kullanıcı';
            elements.username.textContent = displayName;
            document.title = `${displayName} - Profil | Chatlify`;
            elements.tag.textContent = user.tag ? `#${user.tag}` : '';
            elements.bio.textContent = user.bio || 'Bu kullanıcı henüz hakkında bir şey yazmamış.';
            elements.memberSince.textContent = formatDate(user.created_at);
            elements.memberDuration.textContent = calculateTimeElapsed(user.created_at);

            const isOnline = user.is_online || false;
            elements.statusText.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';
            elements.statusIndicator.classList.toggle('online', isOnline);
            elements.statusDot.classList.toggle('online', isOnline);

            renderBadges(user);
        } catch (error) {
            console.error('Kullanıcı verisi yükleme hatası:', error);
            elements.username.textContent = 'Veri Yüklenemedi';
        }
    }

    async function handleRemoveFriend() {
        const user = activeUser;
        if (!user) return;
        const username = user.username || 'Bu kullanıcıyı';
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
    }

    function handleSendMessage() {
        if (activeUser) {
            closeModal();
            if (typeof onComplete === 'function') onComplete({ action: 'message', userId: activeUser.id });
        }
    }

    // Olay dinleyicilerini bir kez ata
    elements.closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });
    elements.messageButton.addEventListener('click', handleSendMessage);
    elements.removeFriendButton.addEventListener('click', handleRemoveFriend);
    elements.callButton.addEventListener('click', () => alert('Arama özelliği yakında!'));
    elements.blockButton.addEventListener('click', () => alert('Engelleme yakında!'));

    return function initialize(user, _currentUser, _supabase, _onComplete) {
        console.log("Profil modalı başlatılıyor:", user);
        activeUser = user;
        currentUser = _currentUser;
        supabase = _supabase;
        onComplete = _onComplete;

        renderUserData(user);

        clearTimeout(modalCloseTimer);
        requestAnimationFrame(() => {
            modal.classList.add('active');
            document.addEventListener('keydown', handleEscapeKey);
        });
    };
}
window.createProfileModalInitializer = createProfileModalInitializer;