// Download sayfası JavaScript

document.addEventListener('DOMContentLoaded', function () {
    // Ana içeriğin yüklenmesi animasyonu
    const main = document.querySelector('main');
    setTimeout(() => {
        main.classList.add('loaded');
    }, 300);

    // ID'ye göre sayfada belirli bir bölüme kaydırma
    const scrollToSection = (id) => {
        const section = document.querySelector(id);
        if (section) {
            window.scrollTo({
                top: section.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    };

    // CTA butonlarından download seçeneklerine kaydırma
    const ctaButton = document.querySelector('.cta .btn');
    if (ctaButton) {
        ctaButton.addEventListener('click', function (e) {
            e.preventDefault();
            scrollToSection('.download-options');
        });
    }

    // İndirme kartları hover efekti
    const downloadCards = document.querySelectorAll('.download-card');
    downloadCards.forEach(card => {
        card.addEventListener('mouseenter', function () {
            this.classList.add('hover-active');
        });

        card.addEventListener('mouseleave', function () {
            this.classList.remove('hover-active');
        });
    });

    // İndirme butonları tıklama olayları
    const downloadButtons = document.querySelectorAll('.download-btn-large');
    downloadButtons.forEach(button => {
        button.addEventListener('click', function (e) {
            e.preventDefault();

            const platform = this.getAttribute('data-version');
            const downloadLinks = {
                windows: 'downloads/Chatlify-Setup-0.0.1.exe',
                mac: 'downloads/Chatlify-0.0.1.dmg',
                linux: 'downloads/Chatlify-0.0.1.AppImage',
                android: 'downloads/Chatlify-0.0.1.apk',
                ios: 'downloads/Chatlify-0.0.1.ipa'
            };

            // Platformun indirme bağlantısını al
            const downloadLink = downloadLinks[platform];

            if (downloadLink) {
                // İndirme işlemini başlat
                console.log(`İndirme başlatılıyor: ${downloadLink}`);

                // İndirme başladı bildirimi
                showDownloadNotification(platform);

                // Normalde burada gerçek bir indirme başlatılır
                // window.location.href = downloadLink;
            }
        });
    });

    // İndirme bildirimi göster
    function showDownloadNotification(platform) {
        const platformNames = {
            windows: 'Windows',
            mac: 'macOS',
            linux: 'Linux',
            android: 'Android',
            ios: 'iOS'
        };

        // Bildirim oluştur
        const notification = document.createElement('div');
        notification.className = 'download-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-download"></i>
                <span>Chatlify için ${platformNames[platform]} indirmesi başlatılıyor...</span>
                <button class="close-btn"><i class="fas fa-times"></i></button>
            </div>
        `;

        // Bildirimi sayfaya ekle
        document.body.appendChild(notification);

        // Görünürlük için kısa bir gecikme ekle
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);

        // Kapatma düğmesi olayı
        const closeBtn = notification.querySelector('.close-btn');
        closeBtn.addEventListener('click', function () {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        });

        // Otomatik kapatma
        setTimeout(() => {
            if (document.body.contains(notification)) {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }
        }, 5000);
    }

    // Sistem gereksinimleri kartları animasyonu
    const requirementCards = document.querySelectorAll('.requirement-card');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animated');
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2
    });

    requirementCards.forEach(card => {
        observer.observe(card);
    });
}); 