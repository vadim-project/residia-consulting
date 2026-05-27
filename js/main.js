document.addEventListener('DOMContentLoaded', () => {
    /* === 1. ТЕМНАЯ/СВЕТЛАЯ ТЕМА === */
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'light';
    htmlElement.setAttribute('data-theme', savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    /* === 2. КОНТАКТНАЯ ФОРМА (ГЛАВНАЯ СТРАНИЦА) === */
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {  
        const cfSuccess = document.getElementById('cf-success');
        const submitBtn = contactForm.querySelector('.btn-contact-submit');
        const phoneRegex = /^\+48\d{9}$/;

        const fields = {
            name: document.getElementById('cf-name'),
            phone: document.getElementById('cf-phone'),
            telegram: document.getElementById('cf-telegram'),
            service: document.getElementById('cf-service'),
        };

        Object.values(fields).forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    input.parentElement.classList.remove('has-error');
                });
            }
        });

        const validate = () => {
            let valid = true;
            if (!fields.name.value.trim()) { fields.name.parentElement.classList.add('has-error'); valid = false; }
            const cleanPhone = fields.phone.value.replace(/[\s\-]/g, '');
            if (!phoneRegex.test(cleanPhone)) { fields.phone.parentElement.classList.add('has-error'); valid = false; }
            if (!fields.service.value) { fields.service.parentElement.classList.add('has-error'); valid = false; }
            return valid;
        };

        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!validate()) return;
            submitBtn.classList.add('is-loading');
            submitBtn.disabled = true;

            try {
                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    body: new FormData(contactForm),
                    headers: { 'Accept': 'application/json' }
                });

                if (response.ok) {
                    contactForm.classList.add('hidden');
                    cfSuccess.classList.remove('hidden');
                } else { throw new Error(); }
            } catch (err) {
                alert('Ошибка отправки. Пожалуйста, напишите нам в Telegram @residia_consulting');
                submitBtn.classList.remove('is-loading');
                submitBtn.disabled = false;
            }
        });
    }

    /* === 3. ЛОГИКА ПЛАВАЮЩИХ КНОПОК И МОДАЛКИ === */
    const fabToggle = document.getElementById('fab-toggle');
    const fabWrapper = document.getElementById('fab-wrapper');
    const chatFab = document.getElementById('open-modal-fab');
    const modal = document.getElementById('callback-modal');
    const closeBtn = document.getElementById('close-modal-btn');
    const modalForm = document.getElementById('modal-callback-form');

    // Клик по кнопке соцсетей
    if (fabToggle && fabWrapper) {
        fabToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            fabWrapper.classList.toggle('is-open');
            
            // Прячем/показываем кнопку чата
            if (chatFab) {
                if (fabWrapper.classList.contains('is-open')) {
                    chatFab.classList.add('is-hidden');
                } else {
                    chatFab.classList.remove('is-hidden');
                }
            }
        });
    }

    // Функция закрытия модалки
    function closeModal() {
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = ''; // Возвращаем скролл
            const successMsg = document.getElementById('md-success-msg');
            if (successMsg) successMsg.classList.add('hidden');
        }
    }

    // Клик по новой кнопке чата
    if (chatFab && modal) {
        chatFab.addEventListener('click', (e) => {
            e.stopPropagation();
            if (modal.classList.contains('hidden')) {
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden'; // Блокируем фон
            } else {
                closeModal(); // Двойной клик закрывает форму
            }
        });
    }

    // Клик по документу (Глобальное закрытие)
    document.addEventListener('click', (event) => {
        // Закрываем меню соцсетей, если клик мимо
        if (fabWrapper && fabWrapper.classList.contains('is-open') && !fabWrapper.contains(event.target)) {
            fabWrapper.classList.remove('is-open');
            if (chatFab) chatFab.classList.remove('is-hidden'); // Возвращаем чат
        }
        // Закрываем модалку, если клик по темному фону
        if (modal && !modal.classList.contains('hidden') && event.target === modal) {
            closeModal();
        }
    });

    // Клик по крестику модалки
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Отправка модальной формы в Make
    if (modalForm) {
        const MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/w1bmm599qgefp88bcyx56aw9nx49t28o';

        modalForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('md-name').value.trim();
            const phone = document.getElementById('md-phone').value.trim();
            const comment = document.getElementById('md-comment').value.trim();

            if (!name || !phone) { alert('Пожалуйста, укажите ваше имя и номер телефона.'); return; }

            const submitBtn = document.getElementById('btn-modal-submit');
            submitBtn.textContent = 'Отправка заявки...';
            submitBtn.disabled = true;

            const payload = {
                name: name,
                phone: phone,
                comment: comment || 'Без комментария',
                source: 'floating_modal_chat',
                submitted_at: new Date().toISOString()
            };

            try {
                await fetch(MAKE_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                modalForm.reset();
                document.getElementById('md-success-msg').classList.remove('hidden');
                setTimeout(closeModal, 2500); // Автозакрытие
            } catch (error) {
                console.error('Ошибка отправки лида:', error);
                alert('Произошла ошибка соединения. Попробуйте отправить форму повторно.');
            } finally {
                submitBtn.textContent = 'И мы с вами свяжемся →';
                submitBtn.disabled = false;
            }
        });
    }
});

/* === 4. АНИМАЦИИ И РЕНДЕР СЕРВИСОВ === */
const services = [
    { id: '01', tag: 'B2C', title: 'Карта CUKR', desc: 'Переход с временной защиты на ВНЖ сроком на 3 года для граждан Украины. Упрощенная процедура легализации.' },
    { id: '02', tag: 'B2C', title: 'Замена прав', desc: 'Полное сопровождение процесса обмена иностранного водительского удостоверения на польское.' },
    { id: '03', tag: 'B2C', title: 'Karta Pobytu', desc: 'ВНЖ на основании работы, бизнеса или воссоединения семьи. От аудита документов до получения пластика.' },
    { id: '04', tag: 'B2C', title: 'Blue Card (EU)', desc: 'Оформление ВНЖ для высококвалифицированных специалистов. Ускоренная процедура.' }
];

function renderServices() {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    services.forEach(service => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.dataset.category = service.tag.toLowerCase();
        card.innerHTML = `<div class="card-bg-number">${service.id}</div>
            <div class="card-content"><div class="card-tag">${service.tag}</div><h3>${service.title}</h3><p>${service.desc}</p></div>`;
        grid.appendChild(card);
    });
}
renderServices();

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.15 });

    document.querySelectorAll('.service-card, .feature-card, .stat-item').forEach(el => {
        el.classList.add('animate-on-scroll');
        observer.observe(el);
    });
}
initScrollAnimations();

function initStickyHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) header.classList.add('scrolled');
        else header.classList.remove('scrolled');
    });
}
initStickyHeader();