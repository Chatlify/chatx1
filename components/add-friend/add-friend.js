/**
 * Initializes the Add Friend panel's functionality.
 * This function is designed to be called after the panel's HTML is loaded into the DOM.
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {function} onComplete - A callback function to run after the panel is closed or an action is completed.
 */
window.initializeAddFriendPanel = function(supabase, onComplete) {
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
            const { data, error } = await supabase.rpc('send_friend_request', { target_username: targetUsername });

            if (error) {
                throw error;
            }

            // The RPC function returns a status message
            if (data) {
                 if (data.includes('zaten')) { // If the message indicates they are already friends
                    showStatus(data, 'error');
                } else {
                    showStatus(data, 'success');
                    usernameInput.value = ''; // Clear input on success
                    setTimeout(closePanel, 2000); // Close panel after 2 seconds on success
                }
            } else {
                 showStatus('Bir hata oluştu, ancak sunucudan mesaj alınamadı.', 'error');
            }

        } catch (error) {
            console.error('Error sending friend request:', error);
            const errorMessage = error.message.includes('not found') ? 'Kullanıcı bulunamadı.' : 'İstek gönderilirken bir hata oluştu. Lütfen tekrar deneyin.';
            showStatus(errorMessage, 'error');
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
