/**
 * Initializes the Add Friend panel's functionality.
 * This function is designed to be called after the panel's HTML is loaded into the DOM.
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {function} onComplete - A callback function to run after the panel is closed or an action is completed.
 */
window.initializeAddFriendPanel = function (supabase, onComplete) {
    const panel = document.getElementById('add-friend-panel');
    if (!panel) {
        console.error('Add Friend Panel not found in the DOM.');
        return;
    }

    const form = panel.querySelector('#addFriendForm');
    const usernameInput = panel.querySelector('#friendUsername');
    const statusMessage = panel.querySelector('#addFriendStatus');
    const closeButton = panel.querySelector('.close-modal-btn');
    const overlay = panel; // The overlay is the panel itself

    // --- Helper Functions ---

    function showStatus(message, type = 'error') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type} visible`;
    }

    function hideStatus() {
        statusMessage.className = 'status-message';
    }

    function closePanel() {
        panel.classList.remove('active');
        // Give animation time to finish before removing
        setTimeout(() => {
            panel.remove();
            if (typeof onComplete === 'function') {
                onComplete();
            }
        }, 300); // Corresponds to the CSS transition duration
    }

    // --- Event Handlers ---

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideStatus();
        const targetUsername = usernameInput.value.trim();

        if (!targetUsername) {
            showStatus('Lütfen bir kullanıcı adı girin.');
            panel.querySelector('.modal-container').classList.add('shake');
            setTimeout(() => panel.querySelector('.modal-container').classList.remove('shake'), 500);
            return;
        }

        try {
            // 1. Get current user session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error('İşlem yapmak için oturum açmalısınız.');
            }
            const currentUser = session.user;

            // 2. Find target user by username
            const { data: targetUser, error: userError } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('username', targetUsername)
                .single();

            if (userError || !targetUser) {
                throw new Error(`'${targetUsername}' adlı kullanıcı bulunamadı.`);
            }

            // 3. Prevent sending request to oneself
            if (targetUser.id === currentUser.id) {
                throw new Error('Kendinize arkadaşlık isteği gönderemezsiniz.');
            }

            // 4. Check for existing friendship or pending request
            const senderId = currentUser.id;
            const receiverId = targetUser.id;
            const { data: existingFriendship, error: friendshipError } = await supabase
                .from('friendships')
                .select('status')
                .or(`and(user_id_1.eq.${senderId},user_id_2.eq.${receiverId}),and(user_id_1.eq.${receiverId},user_id_2.eq.${senderId})`)
                .maybeSingle(); // maybeSingle returns one record or null, and errors on multiple.

            if (friendshipError) {
                console.error('Error checking friendship:', friendshipError);
                throw new Error('Arkadaşlık durumu kontrol edilirken bir hata oluştu.');
            }

            if (existingFriendship) {
                const { status } = existingFriendship;
                if (status === 'accepted') {
                    throw new Error(`'${targetUsername}' ile zaten arkadaşsınız.`);
                }
                if (status === 'pending') {
                    throw new Error(`'${targetUsername}' kullanıcısına zaten bir istek gönderilmiş veya bu kullanıcıdan size bir istek gelmiş.`);
                }
                if (status === 'blocked') {
                    throw new Error('Bu kullanıcıya istek gönderemezsiniz.');
                }
                // Fallback for any other status
                throw new Error(`'${targetUsername}' ile aranızda zaten bir ilişki var (${status}).`);
            }

            // 5. If no existing relationship, insert a new friend request
            const { error: insertError } = await supabase
                .from('friendships')
                .insert({ user_id_1: currentUser.id, user_id_2: targetUser.id, status: 'pending' });

            if (insertError) {
                throw insertError;
            }

            showStatus(`'${targetUsername}' adlı kullanıcıya istek gönderildi!`, 'success');
            usernameInput.value = '';
            setTimeout(closePanel, 2000);

        } catch (error) {
            console.error('Error sending friend request:', error);
            showStatus(error.message, 'error');
        }
    }

    // --- Event Listeners ---

    closeButton.addEventListener('click', closePanel);
    form.addEventListener('submit', handleFormSubmit);

    // Close panel if user clicks on the overlay (outside the modal content)
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
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
    // Use a timeout to allow the element to be in the DOM before adding the class
    setTimeout(() => {
        panel.classList.add('active');
        usernameInput.focus();
    }, 10);
}
