/**
 * Initializes the Profile Modal panel's functionality.
 * This function is designed to be called after the panel's HTML is loaded into the DOM.
 * @param {Object} user - The user object whose profile is being displayed.
 * @param {Object} currentUser - The currently logged-in user.
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {function} onComplete - A callback function to run after the panel is closed or an action is completed.
 */
window.initializeProfileModal = function (user, currentUser, supabase, onComplete) {
    console.log("Initializing profile modal with user data:", user);

    // Hızlı çıkış, kullanıcı verisi yoksa
    if (!user || typeof user !== 'object') {
        console.error('Invalid user data provided for profile modal');
        if (typeof onComplete === 'function') {
            onComplete({ error: 'Invalid user data' });
        }
        return;
    }

    const panel = document.getElementById('profile-modal');
    if (!panel) {
        console.error('Profile Modal not found in the DOM.');
        return;
    }

    // UI Elements
    const closeButton = panel.querySelector('.close-modal-btn');
    const avatar = panel.querySelector('.profile-avatar img');
    const username = panel.querySelector('.profile-username');
    const statusDot = panel.querySelector('.status-dot');
    const statusIndicator = panel.querySelector('.status-indicator');
    const statusText = panel.querySelector('.status-text');
    const profileTag = panel.querySelector('.profile-tag');
    const bio = panel.querySelector('.bio');
    const memberSince = panel.querySelector('.member-since');
    const memberDuration = panel.querySelector('.member-duration');
    const badgesContainer = panel.querySelector('.profile-badges');
    const messageBtn = panel.querySelector('.message-btn');
    const callBtn = panel.querySelector('.call-btn');
    const removeFriendBtn = panel.querySelector('.remove-friend-btn');
    const blockBtn = panel.querySelector('.block-btn');

    // --- Helper Functions ---

    /**
     * Formats a date in a human-readable format
     * @param {string|Date} dateString - The date to format
     * @returns {string} - Formatted date string
     */
    function formatDate(dateString) {
        if (!dateString) return 'Bilinmiyor';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Geçersiz Tarih';

        return date.toLocaleDateString('tr-TR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }

    /**
     * Calculates the time elapsed since a given date
     * @param {string|Date} dateString - The start date
     * @returns {string} - Human-readable time elapsed
     */
    function calculateTimeElapsed(dateString) {
        if (!dateString) return 'Bilinmiyor';

        const startDate = new Date(dateString);
        if (isNaN(startDate.getTime())) return 'Geçersiz Tarih';

        const now = new Date();
        const diffTime = Math.abs(now - startDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffYears > 0) {
            return `${diffYears} yıl ${Math.floor((diffDays % 365) / 30)} ay`;
        } else if (diffMonths > 0) {
            return `${diffMonths} ay ${diffDays % 30} gün`;
        } else {
            return `${diffDays} gün`;
        }
    }

    function closePanel() {
        panel.classList.remove('active');
        // Give animation time to finish before removing
        setTimeout(() => {
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }, 400); // Corresponds to the CSS transition duration
    }

    /**
     * Rozet işleyicisi - Kullanıcının rozetlerini göstermek için
     * @param {Array} badges - Kullanıcı rozetleri dizisi
     */
    function renderBadges(badges) {
        // Önce mevcut rozetleri temizle
        badgesContainer.innerHTML = '';

        // Eğer rozet yoksa veya boş diziyse boş rozet göster
        if (!badges || !Array.isArray(badges) || badges.length === 0) {
            const emptyBadge = document.createElement('div');
            emptyBadge.className = 'badge-item empty-badge';
            emptyBadge.innerHTML = `
                <div class="badge-placeholder"><i class="fas fa-plus"></i></div>
                <span>Rozet Yok</span>
            `;
            badgesContainer.appendChild(emptyBadge);
            return;
        }

        // Rozetleri göster (maksimum 6 adet)
        const maxBadgesToShow = Math.min(badges.length, 6);
        for (let i = 0; i < maxBadgesToShow; i++) {
            const badge = badges[i];
            const badgeItem = document.createElement('div');
            badgeItem.className = 'badge-item earned';
            badgeItem.innerHTML = `
                <div class="badge-icon" title="${badge.name || 'Rozet'}">
                    <i class="${badge.icon || 'fas fa-award'}"></i>
                </div>
                <span>${badge.name || 'Rozet'}</span>
            `;
            badgesContainer.appendChild(badgeItem);
        }

        // Eğer daha fazla rozet varsa "ve daha fazla" göster
        if (badges.length > maxBadgesToShow) {
            const moreBadge = document.createElement('div');
            moreBadge.className = 'badge-item more-badge';
            moreBadge.innerHTML = `
                <div class="badge-placeholder">+${badges.length - maxBadgesToShow}</div>
                <span>Daha Fazla</span>
            `;
            badgesContainer.appendChild(moreBadge);
        }
    }

    // --- Fill User Data ---
    function populateUserData() {
        // Set avatar
        if (user.avatar_url) {
            avatar.src = user.avatar_url;
            avatar.onerror = function () {
                this.src = 'images/defaultavatar.png';
                console.log('Failed to load avatar, using default');
            };
        } else {
            avatar.src = 'images/defaultavatar.png';
        }

        // Set username - varsayılan olarak "Kullanıcı" değil, gerçek kullanıcı adını kullanma
        username.textContent = user.username || user.display_name || user.name || 'İsimsiz Kullanıcı';

        // Set profile tag if available
        if (user.tag) {
            profileTag.textContent = `#${user.tag}`;
            profileTag.style.display = '';
        } else {
            profileTag.style.display = 'none';
        }

        // Set online status
        const isOnline = user.is_online || false;
        statusText.textContent = isOnline ? 'Çevrimiçi' : 'Çevrimdışı';

        // Update status indicators
        if (isOnline) {
            statusDot.classList.add('online');
            statusIndicator.classList.add('online');
            statusIndicator.classList.remove('offline');
        } else {
            statusDot.classList.remove('online');
            statusIndicator.classList.remove('online');
            statusIndicator.classList.add('offline');
        }

        // Set bio
        if (user.bio) {
            bio.textContent = user.bio;
        } else {
            bio.textContent = 'Bu kullanıcı henüz hakkında bir şey yazmamış.';
        }

        // Set membership info
        if (user.created_at) {
            memberSince.textContent = formatDate(user.created_at);
            memberDuration.textContent = calculateTimeElapsed(user.created_at);
        } else {
            memberSince.textContent = 'Bilinmiyor';
            memberDuration.textContent = 'Bilinmiyor';
        }

        // Rozet verisi - gerçek uygulamada burası dinamik olacak
        const sampleBadges = user.badges || [
            { name: 'Erken Üye', icon: 'fas fa-star' }
        ];

        // Rozetleri göster
        renderBadges(sampleBadges);
    }

    // Kullanıcı verilerini yükle
    try {
        populateUserData();
    } catch (error) {
        console.error('Error populating user data:', error);
    }

    // --- Event Handlers ---

    // Message button
    messageBtn.addEventListener('click', () => {
        closePanel();
        if (typeof onComplete === 'function') {
            // Pass information that user wants to message
            onComplete({ action: 'message', userId: user.id });
        }
    });

    // Call button
    callBtn.addEventListener('click', () => {
        alert('Sesli arama özelliği yakında eklenecek!');
    });

    // Remove friend button
    removeFriendBtn.addEventListener('click', async () => {
        if (confirm(`${user.username || 'Bu kullanıcıyı'} arkadaşlıktan çıkarmak istediğinize emin misiniz?`)) {
            try {
                // Find the friendship record
                const { data: friendship, error: findError } = await supabase
                    .from('friendships')
                    .select('id')
                    .or(`and(user_id_1.eq.${currentUser.id},user_id_2.eq.${user.id}),and(user_id_1.eq.${user.id},user_id_2.eq.${currentUser.id})`)
                    .eq('status', 'accepted')
                    .single();

                if (findError || !friendship) {
                    throw new Error('Arkadaşlık kaydı bulunamadı.');
                }

                // Delete the friendship
                const { error: deleteError } = await supabase
                    .from('friendships')
                    .delete()
                    .eq('id', friendship.id);

                if (deleteError) {
                    throw deleteError;
                }

                alert(`${user.username || 'Kullanıcı'} arkadaşlıktan çıkarıldı.`);
                closePanel();
                if (typeof onComplete === 'function') {
                    onComplete({ action: 'removed', userId: user.id });
                }
            } catch (error) {
                console.error('Error removing friend:', error);
                alert(`Bir hata oluştu: ${error.message}`);
            }
        }
    });

    // Block button
    blockBtn.addEventListener('click', () => {
        alert('Engelleme özelliği yakında eklenecek!');
    });

    // Close button
    closeButton.addEventListener('click', closePanel);

    // Close panel if user clicks on the overlay (outside the modal content)
    panel.addEventListener('click', (event) => {
        if (event.target === panel) {
            closePanel();
        }
    });

    // Close panel with Escape key
    function handleEscKey(event) {
        if (event.key === 'Escape') {
            closePanel();
            // Remove listener after closing
            document.removeEventListener('keydown', handleEscKey);
        }
    }
    document.addEventListener('keydown', handleEscKey);

    // Show the panel with animation
    requestAnimationFrame(() => {
        panel.classList.add('active');
    });
}; 