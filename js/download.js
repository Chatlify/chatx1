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

    // Sistem gereksinimleri sekme işlevselliği
    const platformTabs = document.querySelectorAll('.platform-tab');
    const platformContents = document.querySelectorAll('.platform-content');

    // İlk sekme aktif olacak şekilde başlat
    if (platformTabs.length > 0 && platformContents.length > 0) {
        platformTabs[0].classList.add('active');
        platformContents[0].classList.add('active');

        // Her sekmeye tıklama olayı ekle
        platformTabs.forEach(tab => {
            tab.addEventListener('click', function () {
                // Tüm sekmelerin aktif sınıfını kaldır
                platformTabs.forEach(t => t.classList.remove('active'));

                // Tıklanan sekmeyi aktif yap
                this.classList.add('active');

                // Hangi platformun seçildiğini al
                const platform = this.getAttribute('data-platform');

                // Tüm içeriklerin aktif sınıfını kaldır
                platformContents.forEach(content => content.classList.remove('active'));

                // Seçilen platforma ait içeriği aktif yap
                document.getElementById(`${platform}-content`).classList.add('active');
            });
        });
    }

    // Sistem gereksinimleri kartları animasyonu
    const requirementSpecs = document.querySelectorAll('.spec-item');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                // Kademeli animasyon için gecikme ekle
                setTimeout(() => {
                    entry.target.classList.add('animated');
                }, index * 100);
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.2
    });

    requirementSpecs.forEach(spec => {
        observer.observe(spec);
    });
}); 