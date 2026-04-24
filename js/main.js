document.addEventListener('DOMContentLoaded', () => {
    
    /* =========================================
       1. Тема (Dark/Light Mode)
       ========================================= */
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'light';

    // Применяем сохраненную тему сразу
    htmlElement.setAttribute('data-theme', savedTheme);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }

    /* =========================================
       2. Контактная форма (AJAX + Validation)
       ========================================= */
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

        // Сброс индикации ошибок при вводе
        Object.values(fields).forEach(input => {
            if (input) {
                input.addEventListener('input', () => {
                    input.parentElement.classList.remove('has-error');
                });
            }
        });

        const validate = () => {
            let valid = true;

            // Имя (обязательно)
            if (!fields.name.value.trim()) {
                fields.name.parentElement.classList.add('has-error');
                valid = false;
            }

            // Телефон (обязательно, формат +48 и 9 цифр)
            const cleanPhone = fields.phone.value.replace(/[\s\-]/g, '');
            if (!phoneRegex.test(cleanPhone)) {
                fields.phone.parentElement.classList.add('has-error');
                valid = false;
            }

            // Услуга (обязательно)
            if (!fields.service.value) {
                fields.service.parentElement.classList.add('has-error');
                valid = false;
            }

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
                } else {
                    throw new Error();
                }
            } catch (err) {
                alert('Ошибка отправки. Пожалуйста, напишите нам в Telegram @residia');
                submitBtn.classList.remove('is-loading');
                submitBtn.disabled = false;
            }
        });
    }

    /* =========================================
       3. Плавающая кнопка (FAB)
       ========================================= */
    const fabToggle = document.getElementById('fab-toggle');
    const fabWrapper = document.getElementById('fab-wrapper');

    if (fabToggle && fabWrapper) {
        fabToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            fabWrapper.classList.toggle('is-open');
        });

        // Закрытие меню при клике вне кнопки
        document.addEventListener('click', (event) => {
            if (!fabWrapper.contains(event.target)) {
                fabWrapper.classList.remove('is-open');
            }
        });
    }
});