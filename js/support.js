document.addEventListener('DOMContentLoaded', function () {
    // All FAQ questions data
    const allFaqs = [
        {
            question: "How can I download Chatlify?",
            answer: "You can download Chatlify by clicking the 'Download' button on our homepage or download page. We currently have applications available for Windows, macOS, Linux, iOS, and Android. You can select the version suitable for your platform and start the download process.",
            visible: true
        },
        {
            question: "Is creating an account free?",
            answer: "Yes, creating an account on Chatlify is completely free. Most of the basic features can be used with a free account. We offer Chatlify Premium subscription for premium features, but you don't need to pay for standard usage.",
            visible: true
        },
        {
            question: "I forgot my password, what should I do?",
            answer: "If you forgot your password, you can click on the 'Forgot Password' link on the login screen. When you enter the email address associated with your account, you will receive an email containing a password reset link. You can create a new password by clicking on the link.",
            visible: true
        },
        {
            question: "How do I make voice calls in Chatlify?",
            answer: "To start a voice call, go to the chat window of the person or group you want to talk to. Click on the 'Call' icon (shaped like a phone) at the top of the screen. The voice call will start when the other party accepts your call. In group calls, multiple people can join at the same time.",
            visible: true
        },
        {
            question: "How can I join a community?",
            answer: "There are several ways to join a community: You can view popular communities from the 'Discover Communities' section on the homepage, search for specific communities using the search bar, or join directly with an invitation link. Once you find the community, simply click the 'Join' button.",
            visible: true
        },
        {
            question: "What does Chatlify Premium offer?",
            answer: "With Chatlify Premium, we offer high-quality audio and video, custom emojis and stickers, enhanced security features, higher file upload limits, special profile badges, and more customization options. We have monthly or annual subscription plans available.",
            visible: true
        },
        {
            question: "How can I create my own community?",
            answer: "To create your own community, click on the 'Create Community' option from the main menu. Set a name, description, and icon for your community. Then you can create channels, set permissions, and invite your friends. You can always make customizations from the community settings.",
            visible: true
        },
        {
            question: "How do I delete my messages in Chatlify?",
            answer: "To delete a message, hover over the message you want to delete and click on the three dots (...) icon that appears. Select 'Delete' from the menu that opens. Specify whether you want to delete the message only for yourself or for everyone. In group messages, you can only delete your own messages.",
            visible: true
        },
        {
            question: "What should I do to block someone?",
            answer: "To block a user, go to that person's profile page and click on the three dots (...) icon in the top right corner. Select 'Block' from the menu that opens. Blocked users cannot send you messages, make calls, or see your content in communities. You can remove blocks at any time.",
            visible: true
        },
        {
            question: "How can I change my notification settings?",
            answer: "To change your notification settings, go to Settings > Notifications. Here you can customize different options for general notifications, voice calls, messages, and community notifications. You can also set custom notification settings for specific chats or communities.",
            visible: true
        },
        {
            question: "How do I share my screen in Chatlify?",
            answer: "To share your screen, click on the 'Share Screen' icon in the bottom menu during a video call. You can choose to share your entire screen or a specific window. To stop screen sharing, simply click on the same icon again.",
            visible: false
        },
        {
            question: "How do I create a group chat in Chatlify?",
            answer: "To create a group chat, click on the 'New Group' option from the main menu. Select the people you want to include in the group, give the group a name, and optionally add a group icon. When you click Create, the group chat will be initiated.",
            visible: false
        },
        {
            question: "How do I delete my account?",
            answer: "To delete your account, go to Settings > Account > Delete Account. The account deletion process cannot be undone, and all your data, chats, and settings will be permanently deleted. Consider this information before confirming.",
            visible: false
        },
        {
            question: "How do I update my payment information?",
            answer: "To update your payment information, go to Settings > Billing. Click on the 'Update Payment Method' option and enter your new card information. Changes will be applied immediately, and your next payment will be made with your updated information.",
            visible: false
        },
        {
            question: "How can I enable two-factor authentication?",
            answer: "To enable two-factor authentication, go to Settings > Security > Two-Factor Authentication. Click the 'Enable' button and select your preferred verification method (SMS, email, or authentication app). Complete the setup by following the instructions provided.",
            visible: false
        },
        {
            question: "What are the file sharing limits in Chatlify?",
            answer: "For free accounts, the file sharing limit is 100MB per file. This limit is increased to 500MB for Premium users. Additionally, free users can share a total of 5GB per month, while Premium users can share 50GB.",
            visible: false
        },
        {
            question: "How can I change my profile picture?",
            answer: "To change your profile picture, go to Settings > Profile. Click on your current profile picture and select 'Change'. You can upload a picture from your device or choose one of the suggested avatars. Click the 'Save' button to set the picture.",
            visible: false
        },
        {
            question: "How do I add friends in Chatlify?",
            answer: "You can add friends by searching with a username, email, or phone number. You can also visit the user's profile and click the 'Add Friend' button. The person will be added to your friend list when they accept your friend request.",
            visible: false
        },
        {
            question: "Can I use Chatlify on multiple devices?",
            answer: "Yes, you can log in to your Chatlify account from as many devices as you want. All your chats and settings will be synchronized across devices. You can be active on multiple devices at the same time.",
            visible: false
        },
        {
            question: "How can I backup my messages in Chatlify?",
            answer: "To backup your messages, go to Settings > Data and Storage > Chat Backup. Click the 'Backup' button and select a backup location. You can enable daily, weekly, or monthly options for automatic backup.",
            visible: false
        },
        {
            question: "How is dark mode enabled in Chatlify?",
            answer: "To enable dark mode, go to Settings > Appearance > Theme. Select the 'Dark' option. You can also select the 'Automatic' option to have the theme change automatically according to your device's system settings.",
            visible: false
        },
        {
            question: "Where are Chatlify servers located?",
            answer: "Chatlify servers are located in strategic locations around the world: North America (USA and Canada), Europe (Germany, France, UK), Asia (Japan, Singapore, India), and Australia. They automatically connect to the nearest server to provide users with the lowest latency.",
            visible: false
        },
        {
            question: "How can I change language settings in Chatlify?",
            answer: "To change language settings, go to Settings > General > Language. Choose your preferred language from the 25+ supported languages. The change will be applied immediately. Some translations are provided by the community and may have shortcomings.",
            visible: false
        },
        {
            question: "Can I use Chatlify without an internet connection?",
            answer: "No, Chatlify is an online communication platform and requires an internet connection for most of its basic features. However, you can access previously downloaded media files while offline. When your internet connection returns, all your messages will be automatically synchronized.",
            visible: false
        },
        {
            question: "Which browsers is Chatlify compatible with?",
            answer: "The Chatlify web application is fully compatible with the current versions of Chrome, Firefox, Safari, Edge, and Opera. We recommend keeping your browser up to date for the best experience. Internet Explorer is no longer supported.",
            visible: false
        }
    ];

    // Function that adds FAQ items to the page
    function renderFaqs(faqs) {
        const container = document.getElementById('faqContainer');
        container.innerHTML = '';

        if (faqs.length === 0) {
            document.querySelector('.no-results').style.display = 'block';
            return;
        }

        document.querySelector('.no-results').style.display = 'none';

        faqs.forEach(faq => {
            const faqItem = document.createElement('div');
            faqItem.classList.add('faq-item');

            faqItem.innerHTML = `
                <div class="faq-question">
                    <span>${faq.question}</span>
                    <i class="fas fa-chevron-down"></i>
                </div>
                <div class="faq-answer">
                    <p>${faq.answer}</p>
                </div>
            `;

            container.appendChild(faqItem);

            // Add question click event
            const questionElement = faqItem.querySelector('.faq-question');
            questionElement.addEventListener('click', () => {
                faqItem.classList.toggle('active');
            });
        });
    }

    // Show visible FAQs when the page first loads
    const visibleFaqs = allFaqs.filter(faq => faq.visible);
    renderFaqs(visibleFaqs);

    // Search function
    function searchFaqs(query) {
        if (!query.trim()) {
            renderFaqs(visibleFaqs);
            return;
        }

        query = query.toLowerCase().trim();

        // Search in all FAQs, not just visible ones
        const results = allFaqs.filter(faq =>
            faq.question.toLowerCase().includes(query) ||
            faq.answer.toLowerCase().includes(query)
        );

        renderFaqs(results);
    }

    // Add search events
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

    searchButton.addEventListener('click', () => {
        searchFaqs(searchInput.value);
    });

    searchInput.addEventListener('keyup', (e) => {
        // Real-time search as user types
        searchFaqs(searchInput.value);
    });

    // Clear search results when input is cleared
    searchInput.addEventListener('input', () => {
        if (searchInput.value === '') {
            renderFaqs(visibleFaqs);
        }
    });

    // Animation when page loads
    document.querySelector('main').classList.add('loaded');

    // Scroll animations
    const addScrolledClass = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('scrolled');
            }
        });
    };

    const observer = new IntersectionObserver(addScrolledClass, {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    });

    document.querySelectorAll('.faq-item').forEach(item => {
        observer.observe(item);
    });

    // Header scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            document.querySelector('header').classList.add('scrolled');
        } else {
            document.querySelector('header').classList.remove('scrolled');
        }
    });
}); 