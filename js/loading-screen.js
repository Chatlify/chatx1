document.addEventListener('DOMContentLoaded', () => {
    // Yükleme çubuğu ve yüzde elementlerini seç
    const loadingBar = document.getElementById('loadingBar');
    const loadingPercent = document.getElementById('loadingPercent');
    const loadingInfo = document.getElementById('loadingInfo');

    // Yükleme süresi ve animasyon hızını ayarla (6 saniye)
    const totalLoadingTime = 6000; // 6 saniye
    const updateInterval = 50; // Her 50ms'de bir güncelle
    const steps = totalLoadingTime / updateInterval;
    let currentStep = 0;

    // Yükleme bilgi metinleri
    const loadingTexts = [
        'Yeni nesil iletişim platformu yükleniyor...',
        'Topluluğa bağlanılıyor...',
        'Güvenli bağlantı kuruluyor...',
        'Neredeyse hazır...',
        'Dashboard hazırlanıyor...'
    ];

    // Partikül arkaplan efekti için canvas oluştur
    const particlesBackground = document.querySelector('.particles-background');
    const canvas = document.createElement('canvas');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.zIndex = '1';

    particlesBackground.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    // Pencere boyutu değiştiğinde canvas boyutunu güncelle
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    // Partikül sınıfı
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 3 + 0.5;
            this.speedX = Math.random() * 0.5 - 0.25;
            this.speedY = Math.random() * 0.5 - 0.25;

            // Mor ve mavi tonları arasında rastgele renk
            const hue = Math.random() * 60 + 240; // 240-300 arası (mavi-mor)
            const sat = Math.random() * 20 + 80; // 80-100% doygunluk
            const light = Math.random() * 20 + 50; // 50-70% aydınlık
            this.color = `hsla(${hue}, ${sat}%, ${light}%, ${Math.random() * 0.3 + 0.2})`;

            this.maxSize = this.size;
            this.angle = Math.random() * 360;
        }

        update() {
            // Partikül hareketini güncelle
            this.x += this.speedX;
            this.y += this.speedY;

            // Sinüs dalgası efekti ile boyut değişimi
            this.size = this.maxSize * (0.8 + Math.sin(Date.now() * 0.001 + this.angle) * 0.2);

            // Ekran sınırlarını kontrol et
            if (this.x > canvas.width || this.x < 0) {
                this.speedX = -this.speedX;
            }

            if (this.y > canvas.height || this.y < 0) {
                this.speedY = -this.speedY;
            }
        }

        draw() {
            // Partikülü çiz (hafif glow efektiyle)
            ctx.save();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;

            // Glow efekti
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;

            ctx.fill();
            ctx.restore();
        }
    }

    // Partikül dizisi oluştur - ekran genişliğine göre dinamik sayı
    const particles = [];
    const particleCount = Math.min(Math.floor(window.innerWidth / 10), 100); // Maksimum 100 partikül

    for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
    }

    // Animasyon fonksiyonu
    function animate() {
        // Her kareyi yarı-transparan temizle (iz bırakma efekti)
        ctx.fillStyle = 'rgba(14, 14, 24, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Partikülleri çiz ve güncelle
        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        // Partiküller arasında bağlantı çiz
        connectParticles();

        requestAnimationFrame(animate);
    }

    // Partiküller arasında bağlantı çizme fonksiyonu
    function connectParticles() {
        const maxDistance = Math.min(150, canvas.width * 0.15); // Ekrana göre dinamik mesafe

        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < maxDistance) {
                    // Mesafeye göre opaklık ayarla
                    const opacity = (1 - distance / maxDistance) * 0.3;
                    ctx.beginPath();

                    // Gradient çizgi
                    const gradient = ctx.createLinearGradient(
                        particles[i].x, particles[i].y,
                        particles[j].x, particles[j].y
                    );

                    gradient.addColorStop(0, `rgba(106, 17, 203, ${opacity})`);
                    gradient.addColorStop(1, `rgba(37, 117, 252, ${opacity})`);

                    ctx.strokeStyle = gradient;
                    ctx.lineWidth = 0.5;
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    // Animasyonu başlat
    animate();

    // Yükleme çubuğunu güncelleme intervali
    const loadingInterval = setInterval(() => {
        currentStep++;

        // Yükleme yüzdesini hesapla
        const progress = Math.min(100, Math.floor((currentStep / steps) * 100));

        // Yükleme çubuğunu ve yüzde metnini güncelle
        loadingBar.style.width = `${progress}%`;
        loadingPercent.textContent = `${progress}%`;

        // Her %20'de bir yükleme metnini değiştir
        if (progress % 20 === 0) {
            const textIndex = Math.floor(progress / 20);
            if (textIndex < loadingTexts.length) {
                // Metni değiştirirken fade efekti
                loadingInfo.style.opacity = '0';

                setTimeout(() => {
                    loadingInfo.textContent = loadingTexts[textIndex];
                    loadingInfo.style.opacity = '1';
                }, 300);
            }
        }

        // Yükleme tamamlandığında
        if (progress >= 100) {
            clearInterval(loadingInterval);

            // Yükleme tamamlandı, dashboard'a yönlendir
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 500);
        }
    }, updateInterval);
}); 