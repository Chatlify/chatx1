document.addEventListener('DOMContentLoaded', () => {
    // Partikül arkaplan efekti için canvas oluştur
    const body = document.querySelector('body');
    const canvas = document.createElement('canvas');

    // Ensure body exists before appending canvas
    if (body) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.position = 'fixed';
        canvas.style.top = '0';
        canvas.style.left = '0';
        // Set z-index lower than main content but potentially higher than absolute background elements if any
        canvas.style.zIndex = '-1';
        // Optional: Add a class for easier targeting if needed
        canvas.classList.add('particle-canvas');
        body.appendChild(canvas);
    }

    // Proceed with particle logic only if canvas exists
    if (canvas && canvas.parentElement) {
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
                this.size = Math.random() * 1.5 + 0.5; // Slightly smaller particles
                this.speedX = Math.random() * 0.4 - 0.2; // Slightly slower speed
                this.speedY = Math.random() * 0.4 - 0.2;
                // Adjust color for better visibility on dark background
                this.color = `rgba(180, 180, 220, ${Math.random() * 0.2 + 0.05})`;
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x < 0 || this.x > canvas.width) {
                    this.speedX *= -1;
                }
                if (this.y < 0 || this.y > canvas.height) {
                    this.speedY *= -1;
                }
            }

            draw() {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Partikül dizisi oluştur
        let particles = [];
        function initParticles() {
            particles = [];
            const particleCount = Math.floor(canvas.width * canvas.height / 15000); // Adjust density based on area
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        }
        initParticles(); // Initial creation
        window.addEventListener('resize', initParticles); // Re-init on resize for density


        // Animasyon fonksiyonu
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

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
            const maxDistance = 80; // Reduced distance for fewer lines
            ctx.strokeStyle = 'rgba(180, 180, 220, 0.08)'; // Lighter, less opaque lines
            ctx.lineWidth = 0.5;

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) { // Start j from i + 1 to avoid duplicate checks
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < maxDistance) {
                        const opacity = 1 - (distance / maxDistance);
                        ctx.globalAlpha = opacity * 0.5; // Make lines fade based on distance
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                        ctx.globalAlpha = 1.0; // Reset global alpha
                    }
                }
            }
        }

        // Animasyonu başlat
        animate();
    }

    // Scroll animasyonları
    const scrollElements = document.querySelectorAll('.feature-item, .stat-item, .testimonial');

    const elementInView = (el, percentageScroll = 100) => {
        const elementTop = el.getBoundingClientRect().top;
        const elementHeight = el.getBoundingClientRect().height;

        return (
            elementTop <=
            ((window.innerHeight || document.documentElement.clientHeight) * (percentageScroll / 100))
        );
    };

    const displayScrollElement = (element) => {
        element.classList.add('scrolled');
    };

    const hideScrollElement = (element) => {
        element.classList.remove('scrolled');
    };

    const handleScrollAnimation = () => {
        scrollElements.forEach((el) => {
            if (elementInView(el, 80)) {
                displayScrollElement(el);
            } else {
                hideScrollElement(el);
            }
        });
    };

    // İlk yükleme için ve scroll olayı için çağır
    handleScrollAnimation();
    window.addEventListener('scroll', () => {
        handleScrollAnimation();
    });

    // Navigasyon menüsü scroll olayı
    const header = document.querySelector('header');

    // Check if header exists before adding scroll event
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // Mobil menü
    const createMobileMenu = () => {
        const nav = document.querySelector('nav');
        const body = document.querySelector('body');

        // Check if nav and body exist
        if (!nav || !body) return;

        // Remove existing mobile menu if window resizes above threshold
        const existingMobileBtn = document.querySelector('.mobile-menu-btn');
        const existingMobileMenu = document.querySelector('.mobile-menu');
        if (window.innerWidth > 992) {
            if (existingMobileBtn) existingMobileBtn.remove();
            if (existingMobileMenu) existingMobileMenu.remove();
            return; // Don't create menu if screen is large
        }

        // Create mobile menu only if it doesn't exist
        if (!existingMobileBtn) {
            const mobileBtn = document.createElement('div');
            mobileBtn.classList.add('mobile-menu-btn');
            mobileBtn.innerHTML = `<i class="fas fa-bars"></i>`;

            const mobileMenu = document.createElement('div');
            mobileMenu.classList.add('mobile-menu');

            const navLinks = document.querySelector('.nav-links');
            const navButtons = document.querySelector('.nav-buttons');

            // Clone only if elements exist
            if (navLinks) mobileMenu.appendChild(navLinks.cloneNode(true));
            if (navButtons) mobileMenu.appendChild(navButtons.cloneNode(true));

            nav.appendChild(mobileBtn);
            body.appendChild(mobileMenu);

            mobileBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('active');
                mobileBtn.classList.toggle('active');

                if (mobileBtn.classList.contains('active')) {
                    mobileBtn.innerHTML = `<i class="fas fa-times"></i>`;
                } else {
                    mobileBtn.innerHTML = `<i class="fas fa-bars"></i>`;
                }
            });

            // Mobil menüde tıklama sonrası menüyü kapat
            mobileMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    mobileMenu.classList.remove('active');
                    mobileBtn.classList.remove('active');
                    mobileBtn.innerHTML = `<i class="fas fa-bars"></i>`;
                });
            });
        }
    };

    createMobileMenu();
    window.addEventListener('resize', createMobileMenu); // Call on resize

    // Cihaz animasyonları
    const devices = document.querySelectorAll('.device');
    devices.forEach(device => {
        device.addEventListener('mouseover', () => {
            devices.forEach(d => d.classList.add('hover'));
        });

        device.addEventListener('mouseout', () => {
            devices.forEach(d => d.classList.remove('hover'));
        });
    });

    // Görseller için Lazy Loading
    const lazyLoadImages = () => {
        const lazyImages = document.querySelectorAll('img[data-src]');

        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                });
            });

            lazyImages.forEach(img => {
                imageObserver.observe(img);
            });
        } else {
            // Intersection Observer desteklenmiyor, alternatif yöntem kullan
            lazyImages.forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    };

    lazyLoadImages();

    // Sayfa yükleme animasyonu (main element check)
    const content = document.querySelector('main');
    if (content) {
        content.classList.add('loaded');
    }

    // Testimonial kartları için animasyon ve etkileşimler
    const initTestimonials = () => {
        const testimonialItems = document.querySelectorAll('.testimonial-item');
        const dotsContainer = document.querySelector('.nav-dots');
        const dots = document.querySelectorAll('.dot');
        const prevBtn = document.querySelector('.nav-btn.prev');
        const nextBtn = document.querySelector('.nav-btn.next');

        if (!testimonialItems.length || !dotsContainer || !prevBtn || !nextBtn) return;

        let currentIndex = 0;
        const totalItems = testimonialItems.length;

        // İlk kartı aktif yap
        testimonialItems[0].classList.add('active');

        // Dot'ları güncelle
        const updateDots = () => {
            dots.forEach((dot, index) => {
                dot.classList.toggle('active', index === currentIndex);
            });
        };

        // Kartları güncelle
        const updateCards = () => {
            testimonialItems.forEach((item, index) => {
                item.classList.remove('active', 'prev');

                if (index === currentIndex) {
                    item.classList.add('active');
                } else if (index === ((currentIndex - 1 + totalItems) % totalItems)) {
                    item.classList.add('prev');
                }
            });

            updateDots();
        };

        // Click olaylarını ekle
        prevBtn.addEventListener('click', () => {
            currentIndex = (currentIndex - 1 + totalItems) % totalItems;
            updateCards();
        });

        nextBtn.addEventListener('click', () => {
            currentIndex = (currentIndex + 1) % totalItems;
            updateCards();
        });

        // Dot'lara click fonksiyonu ekle
        dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                currentIndex = index;
                updateCards();
            });
        });

        // Otomatik değiştirme için interval
        let interval = setInterval(() => {
            currentIndex = (currentIndex + 1) % totalItems;
            updateCards();
        }, 5000);

        // Mouse hover olunca interval'i durdur
        const testimonialsContainer = document.querySelector('.testimonials-container');
        if (testimonialsContainer) {
            testimonialsContainer.addEventListener('mouseenter', () => {
                clearInterval(interval);
            });

            testimonialsContainer.addEventListener('mouseleave', () => {
                interval = setInterval(() => {
                    currentIndex = (currentIndex + 1) % totalItems;
                    updateCards();
                }, 5000);
            });
        }
    };

    // Değerlendirme kartlarını başlat
    initTestimonials();

    // Scrolled classını animasyon için ekle
    setTimeout(() => {
        document.querySelector('main')?.classList.add('loaded');
    }, 200);
});

// Utility function to check if element is in viewport
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
        rect.top <= (window.innerHeight || document.documentElement.clientHeight) * 0.8 &&
        rect.bottom >= 0
    );
}

// Page transition for links
document.querySelectorAll('a[href]:not([target="_blank"])').forEach(link => {
    link.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href.startsWith('#') || href.indexOf('://') > -1) return;

        e.preventDefault();
        document.body.classList.add('page-transition');

        setTimeout(() => {
            window.location.href = href;
        }, 300);
    });
});

// Şifre gösterme/gizleme butonları için fonksiyon
document.addEventListener('DOMContentLoaded', function () {
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');

    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Hedef input elementini bul
            const targetId = this.hasAttribute('data-target') ?
                this.getAttribute('data-target') : 'password';
            const targetInput = document.getElementById(targetId);

            if (!targetInput) return;

            // Şifre tipini değiştir
            const currentType = targetInput.getAttribute('type');
            const newType = currentType === 'password' ? 'text' : 'password';
            targetInput.setAttribute('type', newType);

            // İkonu değiştir
            const icon = this.querySelector('i');
            if (icon) {
                if (newType === 'password') {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                } else {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            }
        });
    });
});
