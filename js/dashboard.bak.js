import { supabase } from './auth_config.js';

document.addEventListener('DOMContentLoaded', async () => {

    // --- 1. STATE MANAGEMENT ---
    const state = {
        currentUser: null,
        currentConversationId: null,
        friends: [],
        onlineFriends: new Set(),
        presenceChannel: null,
    };

    // --- 2. UI ELEMENTS ---
    const ui = {
        // Friend List & Panels
        friendsPanel: document.querySelector('.friends-panel-container'),
        friendsListContainer: document.querySelector('.friends-list-container'),
        onlineFriendsList: document.querySelector('.online-friends'),
        offlineFriendsList: document.querySelector('.offline-friends'),
        onlineCount: document.querySelector('.online-count'),
        offlineCount: document.querySelector('.offline-count'),
        onlineSectionTitle: document.querySelector('.online-section-title'),
        offlineSectionTitle: document.querySelector('.offline-section-title'),
        dmList: document.querySelector('#friends-group .dm-items'),
        friendList: document.querySelector('.friend-list'),

        // Chat Panel
        chatPanel: document.querySelector('.chat-panel'),
        chatHeaderUser: document.querySelector('.chat-panel .chat-header-user'),
        chatMessages: document.querySelector('.chat-panel .chat-messages'),
        chatInput: document.querySelector('.chat-panel .chat-textbox textarea'),
        chatSendBtn: document.querySelector('.chat-panel .chat-send-btn'),
        chatCloseBtn: document.querySelector('.chat-panel .chat-close-btn'),

        // Profile Panel (The one that opens for friends)
        friendProfilePanel: document.querySelector('.friend-profile-panel'),
        friendProfileCloseBtn: document.querySelector('.friend-profile-panel .close-panel-btn'),
        friendProfileModalOverlay: document.querySelector('.friend-profile-modal-overlay'),

        // User Footer
        userFooter: document.querySelector('.dm-footer .dm-user'),
        userFooterName: document.querySelector('.dm-footer .dm-user-name'),
        userFooterAvatar: document.querySelector('.dm-footer .dm-user-avatar img'),

        // YENİ, YATAY MODAL YAPISI İÇİN
        profileModal: {
            container: document.getElementById('profile-modal-container'),
            closeBtn: document.querySelector('.profile-modal-close-btn'),
            // Sol Taraf
            avatar: document.querySelector('.profile-modal-left .profile-modal-avatar img'),
            statusDot: document.querySelector('.profile-modal-left .status-dot-modal'),
            username: document.querySelector('.profile-modal-left .username'),
            statusText: document.querySelector('.profile-modal-left .status-text'),
            // Sağ Taraf
            badgesContainer: document.querySelector('.profile-modal-right .badges-container'),
            bio: document.querySelector('.profile-modal-right .bio'),
            memberSince: document.querySelector('.profile-modal-right .member-since'),
        }
    };

    // --- 3. SUPABASE SERVICE ---
    const supabaseService = {
        async getUserSession() {
            const { data, error } = await supabase.auth.getUser();
            if (error || !data.user) {
                console.error('No user session. Redirecting to login.', error);
                window.location.href = 'login.html';
                return null;
            }
            return data.user;
        },
        async getUserProfile(userId) {
            const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (error) console.error(`Error fetching profile for ${userId}:`, error);
            return data;
        },
        async getFriends(userId) {
            const { data, error } = await supabase
                .from('friendships')
                .select('user_id_1, user_id_2, profiles_1:user_id_1(id, username, avatar_url), profiles_2:user_id_2(id, username, avatar_url)')
                .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
                .eq('status', 'accepted');
            if (error) {
                console.error('Error fetching friends:', error);
                return [];
            }
            return data.map(f => f.user_id_1 === userId ? f.profiles_2 : f.profiles_1);
        },
        async findOrCreateConversation(userId1, userId2) {
            // Logic from old file to find or create a DM
            const { data, error } = await supabase.rpc('get_or_create_conversation', { user_id_1: userId1, user_id_2: userId2 });
            if (error) console.error("Error finding/creating conversation:", error);
            return data;
        },
        async getMessages(conversationId) {
            const { data, error } = await supabase.from('messages').select('*, sender:senderId(*)').eq('conversationId', conversationId).order('createdAt');
            if (error) console.error("Error fetching messages:", error);
            return data || [];
        },
        async sendMessage(conversationId, senderId, content) {
            const { data, error } = await supabase.from('messages').insert([{ conversationId, senderId, content }]);
            if (error) console.error("Error sending message:", error);
            return data;
        },
        subscribeToMessages(conversationId, callback) {
            return supabase.channel(`messages:${conversationId}`)
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversationId=eq.${conversationId}` }, callback)
                .subscribe();
        },
        subscribeToPresence(callback) {
            const channel = supabase.channel('online-users');
            channel.on('presence', { event: 'sync' }, callback);
            channel.subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: state.currentUser.id, online_at: new Date().toISOString() });
                }
            });
            return channel;
        }
    };

    // --- 4. UI RENDERER ---
    const renderer = {
        renderFriendsList() {
            ui.onlineFriendsList.innerHTML = '';
            ui.offlineFriendsList.innerHTML = '';
            ui.dmList.innerHTML = '';

            let onlineCount = 0;
            let offlineCount = 0;

            state.friends.forEach(friend => {
                const isOnline = state.onlineFriends.has(friend.id);
                const friendRow = this.createFriendRow(friend, isOnline);
                const dmRow = this.createDMRow(friend, isOnline);

                if (isOnline) {
                    ui.onlineFriendsList.appendChild(friendRow);
                    onlineCount++;
                } else {
                    ui.offlineFriendsList.appendChild(friendRow);
                    offlineCount++;
                }
                ui.dmList.appendChild(dmRow);
            });

            ui.onlineCount.textContent = onlineCount;
            ui.offlineCount.textContent = offlineCount;
            ui.onlineSectionTitle.style.display = onlineCount > 0 ? 'flex' : 'none';
            ui.offlineSectionTitle.style.display = offlineCount > 0 ? 'flex' : 'none';
        },
        createFriendRow(friend, isOnline) {
            const el = document.createElement('div');
            el.className = `friend-item ${isOnline ? 'online' : ''}`;
            el.dataset.userId = friend.id;
            el.innerHTML = `
                <div class="friend-info">
                    <div class="friend-avatar">
                        <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}">
                        <div class="status-dot ${isOnline ? 'online' : ''}"></div>
                    </div>
                    <div class="friend-details">
                        <div class="friend-name">${friend.username}</div>
                        <div class="friend-status-text">${isOnline ? 'Çevrimiçi' : 'Çevrimdışı'}</div>
                    </div>
                </div>
                <div class="friend-actions">
                    <button class="btn message-btn" title="Mesaj Gönder"><i class="fas fa-comment-alt"></i></button>
                    <button class="btn profile-btn" title="Profili Görüntüle"><i class="fas fa-user"></i></button>
                    <button class="btn more-btn" title="Daha Fazla"><i class="fas fa-ellipsis-v"></i></button>
                </div>`;
            return el;
        },
        createDMRow(friend, isOnline) {
            const el = document.createElement('div');
            el.className = 'dm-item';
            el.dataset.userId = friend.id;
            el.innerHTML = `
                <div class="dm-avatar">
                    <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}">
                    <div class="dm-status ${isOnline ? 'online' : 'offline'}"></div>
                </div>
                <div class="dm-info">
                    <div class="dm-name">${friend.username}</div>
                </div>`;
            return el;
        },
        async renderChatPanel(friendId) {
            const friend = state.friends.find(f => f.id === friendId);
            if (!friend) return;

            // Update header
            ui.chatHeaderUser.querySelector('.chat-username').textContent = friend.username;
            ui.chatHeaderUser.querySelector('.chat-avatar img').src = friend.avatar_url || 'images/defaultavatar.png';

            // Show/Hide panels
            ui.friendsPanel.classList.add('hidden');
            ui.chatPanel.classList.remove('hidden');

            // Fetch and render messages
            state.currentConversationId = await supabaseService.findOrCreateConversation(state.currentUser.id, friend.id);
            ui.chatMessages.innerHTML = '<div>Yükleniyor...</div>';
            const messages = await supabaseService.getMessages(state.currentConversationId);
            this.renderMessages(messages);
        },
        renderMessages(messages) {
            ui.chatMessages.innerHTML = '';
            messages.forEach(msg => {
                const isOwn = msg.senderId === state.currentUser.id;
                const el = document.createElement('div');
                el.className = `message-group ${isOwn ? 'own-message' : ''}`;
                el.innerHTML = `
                    <div class="message-group-avatar"><img src="${isOwn ? state.currentUser.profile.avatar_url : msg.sender.avatar_url}" alt=""></div>
                    <div class="message-group-content">
                         <div class="message-group-header">
                            <span class="message-author">${isOwn ? 'Sen' : msg.sender.username}</span>
                            <span class="message-time">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div class="message-content"><p>${msg.content}</p></div>
                    </div>`;
                ui.chatMessages.appendChild(el);
            });
            ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
        },
        renderFriend: (friend) => {
            const friendItem = document.createElement('div');
            friendItem.className = `friend-item ${friend.status}`;
            friendItem.setAttribute('data-user-id', friend.id);

            // PROFİL BUTONUNU İÇEREN GÜNCELLENMİŞ HTML YAPISI
            friendItem.innerHTML = `
                <div class="friend-avatar">
                    <img src="${friend.avatar_url || 'images/defaultavatar.png'}" alt="${friend.username}">
                    <div class="status-dot"></div>
                </div>
                <div class="friend-info">
                    <span class="friend-name">${friend.username}</span>
                    <span class="friend-status-text">${friend.status === 'online' ? 'Çevrimiçi' : 'Çevrimdışı'}</span>
                </div>
                <div class="friend-actions">
                    <button class="action-btn message-friend-btn" title="Mesaj Gönder"><i class="fas fa-comment-alt"></i></button>
                    <button class="action-btn profile-action-btn" title="Profili Görüntüle"><i class="fas fa-user"></i></button>
                </div>
            `;
            return friendItem;
        },
        renderProfilePanel: (profile) => {
            console.log("[DEBUG] renderProfilePanel çağrıldı, gelen profil verisi:", profile);

            // Hiç veri yoksa bile minimum bir yapı oluştur
            profile = profile || {
                id: 'default',
                username: 'Test Kullanıcı',
                status: 'online',
                avatar_url: 'images/defaultavatar.png',
                bio: 'Bu bir test hesabıdır.',
                created_at: new Date().toISOString()
            };

            // Sol tarafı doldur - Kesin kontrollerle
            if (ui.profileModal.avatar) {
                ui.profileModal.avatar.src = profile.avatar_url || 'images/defaultavatar.png';
            }

            if (ui.profileModal.username) {
                // Kullanıcı adını kesin olarak ayarla
                ui.profileModal.username.textContent = profile.username || 'Test Kullanıcı';
            }

            // Durum göstergesini güncelle
            if (ui.profileModal.statusDot) {
                const status = profile.status || 'offline';
                ui.profileModal.statusDot.className = `status-dot-modal ${status}`;
            }

            if (ui.profileModal.statusText) {
                const statusMap = {
                    online: 'Çevrimiçi',
                    offline: 'Çevrimdışı',
                    idle: 'Boşta',
                    dnd: 'Rahatsız Etmeyin'
                };
                const status = profile.status || 'offline';
                ui.profileModal.statusText.textContent = statusMap[status] || 'Çevrimdışı';
            }

            // Sağ tarafı doldur - Kesin kontrollerle
            if (ui.profileModal.bio) {
                ui.profileModal.bio.textContent = profile.bio || 'Bu kullanıcı henüz hakkında bir şey yazmamış.';
            }

            // Üyelik tarihini manual olarak ayarla ve kontrol et
            if (ui.profileModal.memberSince) {
                try {
                    let dateStr = 'Bilinmiyor';
                    if (profile.created_at) {
                        const date = new Date(profile.created_at);
                        if (!isNaN(date.getTime())) { // Geçerli tarih kontrolü
                            dateStr = date.toLocaleDateString('tr-TR', {
                                year: 'numeric', month: 'long', day: 'numeric'
                            });
                        }
                    }
                    ui.profileModal.memberSince.textContent = dateStr;
                } catch (error) {
                    console.error("[HATA] Tarih işlenirken hata oluştu:", error);
                    ui.profileModal.memberSince.textContent = "Bilinmiyor";
                }
            }

            // Rozetleri temizle ve yeniden ekle
            if (ui.profileModal.badgesContainer) {
                ui.profileModal.badgesContainer.innerHTML = '';

                // Manuel örnek rozetler ekle
                const badges = [
                    { icon: 'fas fa-crown', title: 'Premium Üye', condition: true },
                    { icon: 'fas fa-shield-alt', title: 'Güvenilir Üye', condition: true },
                ];

                badges.forEach(badge => {
                    if (badge.condition) {
                        const badgeIcon = document.createElement('i');
                        badgeIcon.className = badge.icon;
                        badgeIcon.title = badge.title;
                        ui.profileModal.badgesContainer.appendChild(badgeIcon);
                    }
                });
            }

            // Paneli göster
            if (ui.profileModal.container) {
                ui.profileModal.container.style.display = 'flex';
            } else {
                console.error("[HATA] Modal container bulunamadı!");
            }
        },
        updateUserFooter(profile) {
            ui.userFooterName.textContent = profile.username;
            ui.userFooterAvatar.src = profile.avatar_url || 'images/defaultavatar.png';
        }
    };

    // --- 5. EVENT LISTENERS ---
    const initEventListeners = () => {
        console.log("DEBUG: Olay dinleyicileri başlatılıyor...");

        // Arkadaş/DM listeleri için olay delegasyonu
        ui.friendsListContainer?.addEventListener('click', handleFriendAction);
        ui.dmList?.addEventListener('click', (e) => {
            const target = e.target.closest('.dm-item');
            if (target) {
                renderer.renderChatPanel(target.dataset.userId);
            }
        });

        // Sohbet paneli butonları
        ui.chatCloseBtn?.addEventListener('click', () => {
            ui.chatPanel.classList.add('hidden');
            ui.friendsPanel.classList.remove('hidden');
            state.currentConversationId = null;
        });

        ui.chatSendBtn?.addEventListener('click', handleSendMessage);
        ui.chatInput?.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
            }
        });

        // Profil Modalı Kapatma Butonları
        ui.friendProfileCloseBtn?.addEventListener('click', () => {
            ui.friendProfileModalOverlay.classList.remove('is-visible');
        });

        ui.friendProfileModalOverlay?.addEventListener('click', (e) => {
            if (e.target === ui.friendProfileModalOverlay) {
                ui.friendProfileModalOverlay.classList.remove('is-visible');
            }
        });

        // ARKADAŞ LİSTESİNDE OLAY DELEGASYONU (DAHA KAPSAMLI HATA AYIKLAMA İLE)
        if (ui.friendList) {
            ui.friendList.addEventListener('click', (e) => {
                const profileButton = e.target.closest('.profile-action-btn');
                if (profileButton) {
                    console.log("[DEBUG] Profil butonu tıklandı");

                    const friendItem = profileButton.closest('.friend-item');
                    if (!friendItem) {
                        console.error("[HATA] Tıklanan butonun üst elementi (.friend-item) bulunamadı!");
                        return;
                    }

                    const userId = friendItem.dataset.userId;
                    console.log("[DEBUG] Tıklanan kullanıcı ID:", userId);

                    if (userId) {
                        console.log("[DEBUG] state.friends:", state.friends);

                        // Önce arkadaş listesinde arayalım
                        let profileData;
                        if (state.friends && Array.isArray(state.friends)) {
                            profileData = state.friends.find(f => f.id === userId);
                            console.log("[DEBUG] state.friends içinde bulunan veri:", profileData);
                        } else {
                            console.error("[HATA] state.friends dizisi tanımlı değil veya dizi değil:", state.friends);
                        }

                        // Eğer arkadaş listesinde bulunamadıysa, arkadaş API'den doğrudan isteyelim
                        if (!profileData) {
                            console.log("[DEBUG] Kullanıcı arkadaş listesinde bulunamadı, API'den alınacak");

                            // Bu kısım sadece manual test içindir
                            profileData = {
                                id: userId,
                                username: "Test Kullanıcı",
                                discriminator: "1234",
                                avatar_url: "images/defaultavatar.png",
                                status: "online",
                                bio: "Bu bir test hesabıdır.",
                                created_at: new Date().toISOString(),
                            };

                            console.log("[DEBUG] Test verisi kullanılıyor:", profileData);
                        }

                        if (profileData) {
                            renderer.renderProfilePanel(profileData);
                        } else {
                            console.error("[HATA] Kullanıcı verisi bulunamadı.");
                        }
                    }
                }
            });
        } else {
            console.error("[HATA] ui.friendList elementi bulunamadı!");
        }

        // MODAL KAPATMA BUTONU
        if (ui.profileModal.closeBtn) {
            ui.profileModal.closeBtn.addEventListener('click', () => {
                if (ui.profileModal.container) {
                    ui.profileModal.container.style.display = 'none';
                    console.log("SUCCESS: Profil modalı kapatıldı ('display: none').");
                }
            });
        }

        // DIŞARI TIKLAYINCA MODALI KAPATMA (YENİ)
        if (ui.profileModal.container) {
            ui.profileModal.container.addEventListener('click', (e) => {
                // Sadece overlay'e tıklandığında kapat (içeriğe tıklanınca değil)
                if (e.target === ui.profileModal.container) {
                    ui.profileModal.container.style.display = 'none';
                }
            });
        }
    };

    const handleFriendAction = (e) => {
        console.log("DEBUG: handleFriendAction tetiklendi.");
        const button = e.target.closest('.btn');
        if (!button) {
            console.log("DEBUG: Tıklanan yer bir buton değil, çıkılıyor.");
            return;
        }
        console.log("DEBUG: Buton bulundu:", button);

        const friendItem = e.target.closest('.friend-item');
        if (!friendItem) {
            console.error("HATA: .friend-item bulunamadı!");
            return;
        }
        const userId = friendItem.dataset.userId;
        console.log(`DEBUG: Kullanıcı ID'si alındı: ${userId}`);

        if (button.classList.contains('profile-btn')) {
            console.log(`DEBUG: Profil butonu tıklandı. renderProfilePanel çağrılıyor...`);
            renderer.renderProfilePanel(userId);
        }
        if (button.classList.contains('message-btn')) {
            console.log(`DEBUG: Mesaj butonu tıklandı. renderChatPanel çağrılıyor...`);
            renderer.renderChatPanel(userId);
        }
    };

    const handleSendMessage = async () => {
        const content = ui.chatInput.value.trim();
        if (content && state.currentConversationId) {
            await supabaseService.sendMessage(state.currentConversationId, state.currentUser.id, content);
            ui.chatInput.value = '';
            // Realtime listener will handle displaying the message
        }
    };


    // --- 6. INITIALIZATION ---
    const init = async () => {
        state.currentUser = await supabaseService.getUserSession();
        if (!state.currentUser) return;

        const profile = await supabaseService.getUserProfile(state.currentUser.id);
        state.currentUser.profile = profile;
        renderer.updateUserFooter(profile);

        state.friends = await supabaseService.getFriends(state.currentUser.id);

        initEventListeners();

        // Setup presence and initial friend list render
        state.presenceChannel = supabaseService.subscribeToPresence(() => {
            state.onlineFriends.clear();
            const presenceState = state.presenceChannel.state;
            for (const id in presenceState) {
                state.onlineFriends.add(presenceState[id][0].user_id);
            }
            renderer.renderFriendsList();
        });

        // Initial render
        renderer.renderFriendsList();
    };

    await init();
}); 