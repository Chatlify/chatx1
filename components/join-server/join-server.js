/**
 * Initializes the Join Server panel's functionality.
 * This function is designed to be called after the panel's HTML is loaded into the DOM.
 * @param {SupabaseClient} supabase - The Supabase client instance.
 * @param {function} onComplete - A callback function to run after the panel is closed or an action is completed.
 */
window.initializeJoinServerPanel = function (supabase, onComplete) {
    // Check if panel exists
    const panel = document.getElementById('join-server-panel');
    if (!panel) {
        console.error('Join Server Panel not found in the DOM.');
        return;
    }

    // UI Elements
    const closeButton = panel.querySelector('.close-modal-btn');
    const serverOptions = panel.querySelector('#server-options');
    const joinServerForm = panel.querySelector('#join-server-form');
    const createServerForm = panel.querySelector('#create-server-form');
    const joinForm = panel.querySelector('#serverJoinForm');
    const backButtons = panel.querySelectorAll('.back-button');
    const nextButtons = panel.querySelectorAll('.next-step-btn');
    const prevButtons = panel.querySelectorAll('.prev-step-btn');
    const createServerButton = panel.querySelector('.create-server-btn');
    const joinServerStatus = panel.querySelector('#joinServerStatus');
    const createServerStatus = panel.querySelector('#createServerStatus');
    const serverAvatarUpload = panel.querySelector('#serverAvatarUpload');
    const serverAvatarPreview = panel.querySelector('#serverAvatarPreview');
    const removeAvatarBtn = panel.querySelector('.remove-avatar-btn');
    const categoryItems = panel.querySelectorAll('.category-item');
    const privacyOptions = panel.querySelectorAll('.privacy-option');
    const steps = panel.querySelectorAll('.step');
    const serverSteps = panel.querySelectorAll('.server-step');

    // State variables
    let currentStep = 1;
    let selectedCategory = '';
    let selectedPrivacy = '';
    let serverAvatarFile = null;
    let serverAvatarDataUrl = '';

    // --- Helper Functions ---

    function showStatus(message, type = 'error', statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-message ${type} visible`;
    }

    function hideStatus(statusElement) {
        statusElement.className = 'status-message';
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

    function showView(view) {
        // Hide all views
        serverOptions.classList.add('hidden');
        joinServerForm.classList.add('hidden');
        createServerForm.classList.add('hidden');

        // Show the selected view
        view.classList.remove('hidden');
    }

    function goToStep(step) {
        // Update current step
        currentStep = step;

        // Update step indicators
        steps.forEach(stepEl => {
            const stepNum = parseInt(stepEl.dataset.step);
            stepEl.classList.remove('active', 'completed');
            if (stepNum === currentStep) {
                stepEl.classList.add('active');
            } else if (stepNum < currentStep) {
                stepEl.classList.add('completed');
            }
        });

        // Show current step content
        serverSteps.forEach(stepContent => {
            stepContent.classList.remove('active');
            if (stepContent.id === `step-${currentStep}`) {
                stepContent.classList.add('active');
            }
        });
    }

    function validateCurrentStep() {
        switch (currentStep) {
            case 1:
                const serverName = panel.querySelector('#serverName').value.trim();
                if (!serverName) {
                    showStatus('Lütfen bir sunucu ismi girin.', 'error', createServerStatus);
                    panel.querySelector('#serverName').focus();
                    return false;
                }
                hideStatus(createServerStatus);
                return true;

            case 2:
                if (!selectedCategory) {
                    showStatus('Lütfen bir kategori seçin.', 'error', createServerStatus);
                    return false;
                }
                hideStatus(createServerStatus);
                return true;

            case 3:
                if (!selectedPrivacy) {
                    showStatus('Lütfen bir gizlilik ayarı seçin.', 'error', createServerStatus);
                    return false;
                }
                hideStatus(createServerStatus);
                return true;

            case 4:
                // Server avatar is optional, so no validation needed
                return true;

            default:
                return true;
        }
    }

    async function handleServerCreation() {
        try {
            // Get current user session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error('İşlem yapmak için oturum açmalısınız.');
            }

            // Get form data
            const serverName = panel.querySelector('#serverName').value.trim();

            // Perform validation
            if (!serverName) {
                throw new Error('Sunucu ismi gereklidir.');
            }

            if (!selectedCategory) {
                throw new Error('Bir kategori seçmelisiniz.');
            }

            if (!selectedPrivacy) {
                throw new Error('Bir gizlilik ayarı seçmelisiniz.');
            }

            // Create server in database
            const serverId = crypto.randomUUID();

            // Upload avatar if exists
            let avatarUrl = null;
            if (serverAvatarFile) {
                const fileExt = serverAvatarFile.name.split('.').pop();
                const filePath = `server_avatars/${serverId}.${fileExt}`;

                const { error: uploadError } = await supabase
                    .storage
                    .from('avatars')
                    .upload(filePath, serverAvatarFile);

                if (uploadError) {
                    console.error('Avatar upload error:', uploadError);
                    throw new Error('Sunucu avatarı yüklenirken bir hata oluştu.');
                }

                const { data: { publicUrl } } = supabase
                    .storage
                    .from('avatars')
                    .getPublicUrl(filePath);

                avatarUrl = publicUrl;
            }

            // Store server data
            const { error: insertError } = await supabase
                .from('servers')
                .insert({
                    id: serverId,
                    name: serverName,
                    owner_id: session.user.id,
                    category: selectedCategory,
                    privacy: selectedPrivacy,
                    avatar_url: avatarUrl,
                    created_at: new Date().toISOString()
                });

            if (insertError) {
                console.error("Insert error:", insertError);
                throw new Error('Sunucu oluşturulurken bir hata oluştu.');
            }

            // Create server membership for the owner
            const { error: membershipError } = await supabase
                .from('server_members')
                .insert({
                    server_id: serverId,
                    user_id: session.user.id,
                    role: 'owner',
                    joined_at: new Date().toISOString()
                });

            if (membershipError) {
                console.error("Membership error:", membershipError);
                throw new Error('Sunucu üyeliği oluşturulurken bir hata oluştu.');
            }

            showStatus('Sunucu başarıyla oluşturuldu!', 'success', createServerStatus);
            setTimeout(closePanel, 2000);

        } catch (error) {
            console.error('Error creating server:', error);
            showStatus(error.message, 'error', createServerStatus);
        }
    }

    async function handleJoinServer(event) {
        event.preventDefault();
        hideStatus(joinServerStatus);

        const inviteCode = panel.querySelector('#serverInviteCode').value.trim();

        if (!inviteCode) {
            showStatus('Lütfen bir davet kodu girin.', 'error', joinServerStatus);
            panel.querySelector('.modal-container').classList.add('shake');
            setTimeout(() => panel.querySelector('.modal-container').classList.remove('shake'), 500);
            return;
        }

        try {
            // Get current user session
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error('İşlem yapmak için oturum açmalısınız.');
            }

            // Find server by invite code
            const { data: serverInvite, error: inviteError } = await supabase
                .from('server_invites')
                .select('*, servers(*)')
                .eq('code', inviteCode)
                .single();

            if (inviteError || !serverInvite) {
                throw new Error('Geçersiz davet kodu.');
            }

            // Check if user is already a member
            const { data: existingMembership, error: membershipError } = await supabase
                .from('server_members')
                .select('*')
                .eq('server_id', serverInvite.server_id)
                .eq('user_id', session.user.id)
                .maybeSingle();

            if (membershipError) {
                throw new Error('Üyelik durumu kontrol edilirken bir hata oluştu.');
            }

            if (existingMembership) {
                throw new Error('Bu sunucunun zaten bir üyesisiniz.');
            }

            // Add user to server members
            const { error: joinError } = await supabase
                .from('server_members')
                .insert({
                    server_id: serverInvite.server_id,
                    user_id: session.user.id,
                    role: 'member',
                    joined_at: new Date().toISOString()
                });

            if (joinError) {
                throw new Error('Sunucuya katılırken bir hata oluştu.');
            }

            showStatus(`"${serverInvite.servers.name}" sunucusuna başarıyla katıldınız!`, 'success', joinServerStatus);
            setTimeout(closePanel, 2000);

        } catch (error) {
            console.error('Error joining server:', error);
            showStatus(error.message, 'error', joinServerStatus);
        }
    }

    // --- Event Listeners ---

    // Close button
    closeButton.addEventListener('click', closePanel);

    // Option card clicks
    serverOptions.addEventListener('click', (e) => {
        const optionCard = e.target.closest('.option-card');
        if (!optionCard) return;

        const action = optionCard.dataset.action;
        if (action === 'join') {
            showView(joinServerForm);
        } else if (action === 'create') {
            showView(createServerForm);
            goToStep(1);
        }
    });

    // Back buttons
    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            showView(serverOptions);
        });
    });

    // Next step buttons
    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            const nextStep = parseInt(button.dataset.next);
            if (validateCurrentStep()) {
                goToStep(nextStep);
            }
        });
    });

    // Previous step buttons
    prevButtons.forEach(button => {
        button.addEventListener('click', () => {
            const prevStep = parseInt(button.dataset.prev);
            goToStep(prevStep);
        });
    });

    // Category selection
    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            categoryItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedCategory = item.dataset.category;
        });
    });

    // Privacy selection
    privacyOptions.forEach(option => {
        option.addEventListener('click', () => {
            privacyOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedPrivacy = option.dataset.privacy;
        });
    });

    // Server avatar upload
    serverAvatarUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            serverAvatarFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                serverAvatarDataUrl = e.target.result;
                serverAvatarPreview.src = serverAvatarDataUrl;
            };
            reader.readAsDataURL(file);
        }
    });

    // Remove avatar button
    removeAvatarBtn.addEventListener('click', () => {
        serverAvatarFile = null;
        serverAvatarDataUrl = '';
        serverAvatarPreview.src = '/images/defaultavatar.svg';
        serverAvatarUpload.value = '';
    });

    // Join server form submit
    joinForm.addEventListener('submit', handleJoinServer);

    // Create server submit button
    createServerButton.addEventListener('click', handleServerCreation);

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
    // Use a timeout to allow the element to be in the DOM before adding the class
    setTimeout(() => {
        panel.classList.add('active');
        // Focus on input if applicable
        const visibleInput = panel.querySelector('input:not([type="file"])');
        if (visibleInput) visibleInput.focus();
    }, 10);
} 