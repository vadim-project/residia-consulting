// js/main.js

// Ждем полной загрузки DOM перед выполнением скриптов (это тоже хорошая практика)
document.addEventListener('DOMContentLoaded', () => {
    
    /* =========================================
       Интерактив 1: Dark Mode Toggle
       Требования: DOM Manipulation, Event Listener, localStorage
       ========================================= */
       
    const themeToggleBtn = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;

    // 1. Проверяем, есть ли сохраненная тема в localStorage
    const savedTheme = localStorage.getItem('theme');

    // Если тема была сохранена ранее, применяем ее
    if (savedTheme) {
        htmlElement.setAttribute('data-theme', savedTheme);
    }

    // 2. Вешаем слушатель событий на кнопку (Event Listener #1)
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            // Получаем текущую тему
            const currentTheme = htmlElement.getAttribute('data-theme');
            
            // Определяем новую тему
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            // Манипуляция DOM: меняем атрибут у тега <html>
            htmlElement.setAttribute('data-theme', newTheme);
            
            // Сохраняем выбор пользователя в localStorage
            localStorage.setItem('theme', newTheme);
        });
    }
});

/* =========================================
       Интерактив 2: Фильтрация услуг (setTimeout / API Mock)
       Требования: setTimeout, Event Listeners, DOM Manipulation
       ========================================= */
       
    const filterBtns = document.querySelectorAll('.filter-btn');
    const servicesGrid = document.getElementById('services-grid');
    const cards = document.querySelectorAll('.service-card');
    const loader = document.getElementById('loader');

    if (filterBtns.length > 0 && servicesGrid) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 1. Убираем класс active у всех кнопок и вешаем на нажатую
                filterBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const filterValue = e.target.getAttribute('data-filter');

                // 2. Имитация обращения к базе данных (setTimeout)
                // Сначала делаем сетку полупрозрачной и показываем лоадер
                servicesGrid.classList.add('opacity-0');
                loader.classList.remove('hidden');

                // Задержка 600мс для эффекта "работы сервера"
                setTimeout(() => {
                    // 3. Логика фильтрации (манипуляция DOM)
                    cards.forEach(card => {
                        if (filterValue === 'all' || card.getAttribute('data-category') === filterValue) {
                            card.style.display = 'block';
                        } else {
                            card.style.display = 'none';
                        }
                    });

                    // 4. Возвращаем прозрачность и прячем лоадер
                    servicesGrid.classList.remove('opacity-0');
                    loader.classList.add('hidden');
                }, 600);
            });
        });
    }

    /* =========================================
       Интерактив 3: Form Wizard & Validation
       Требования: RegExp, Event Listeners (input, submit), preventDefault
       ========================================= */
       
    const bookingForm = document.getElementById('booking-form');
    
    if (bookingForm) {
        const btnNext = document.getElementById('btn-next');
        const btnPrev = document.getElementById('btn-prev');
        const step1 = document.getElementById('step-1');
        const step2 = document.getElementById('step-2');
        const progressSteps = document.querySelectorAll('.progress-step');
        const formSuccess = document.getElementById('form-success');
        const wizardProgress = document.querySelector('.wizard-progress');

        // Инпуты Шага 1
        const nameInput = document.getElementById('name');
        const emailInput = document.getElementById('email');
        const phoneInput = document.getElementById('phone');

        // Регулярные выражения (RegExp)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        // Проверяем польский номер: строго +48 и 9 цифр (без пробелов для простоты)
        const phoneRegex = /^\+48\d{9}$/; 

        // Функция: Показать/скрыть ошибку (Манипуляция DOM)
        const showError = (input, show) => {
            const formGroup = input.parentElement;
            if (show) {
                formGroup.classList.add('has-error');
            } else {
                formGroup.classList.remove('has-error');
            }
        };

        // Event Listener #3: 'input'
        // Убираем красную подсветку, как только клиент начинает исправлять ошибку
        [nameInput, emailInput, phoneInput].forEach(input => {
            input.addEventListener('input', () => {
                showError(input, false);
            });
        });

        // Функция: Проверка полей перед переходом на Шаг 2
        const validateStep1 = () => {
            let isValid = true;

            // Проверка имени (не пустое)
            if (nameInput.value.trim() === '') {
                showError(nameInput, true);
                isValid = false;
            }

            // Проверка Email (через RegExp)
            if (!emailRegex.test(emailInput.value.trim())) {
                showError(emailInput, true);
                isValid = false;
            }

            // Проверка телефона (через RegExp, удаляем пробелы, если юзер их ввел)
            const cleanPhone = phoneInput.value.replace(/\s/g, ''); 
            if (!phoneRegex.test(cleanPhone)) {
                showError(phoneInput, true);
                isValid = false;
            }

            return isValid;
        };

        // Логика кнопки "Далее"
        btnNext.addEventListener('click', () => {
            if (validateStep1()) {
                // Прячем Шаг 1, показываем Шаг 2
                step1.classList.remove('active');
                step2.classList.add('active');
                
                // Обновляем прогресс-бар
                progressSteps[0].classList.remove('active');
                progressSteps[1].classList.add('active');
            }
        });

        // Логика кнопки "Назад"
        btnPrev.addEventListener('click', () => {
            step2.classList.remove('active');
            step1.classList.add('active');
            
            progressSteps[1].classList.remove('active');
            progressSteps[0].classList.add('active');
        });

        // Event Listener #4: 'submit'
        bookingForm.addEventListener('submit', (e) => {
            // Обязательное требование комиссии: отмена стандартного поведения
            e.preventDefault(); 
            
            // Здесь в реальном проекте был бы Fetch API для отправки на сервер
            // Но мы просто показываем красивое сообщение об успехе
            
            step2.classList.remove('active'); // Прячем форму
            wizardProgress.style.display = 'none'; // Прячем индикаторы шагов
            formSuccess.classList.remove('hidden'); // Показываем блок успеха
        });
    }

const fabToggle = document.getElementById('fab-toggle');
    const fabWrapper = document.getElementById('fab-wrapper'); // <--- поменяли

    if (fabToggle && fabWrapper) {
        fabToggle.addEventListener('click', () => {
            fabWrapper.classList.toggle('is-open'); // <--- поменяли
        });

        document.addEventListener('click', (event) => {
            if (!fabWrapper.contains(event.target) && fabWrapper.classList.contains('is-open')) {
                fabWrapper.classList.remove('is-open'); // <--- поменяли
            }
        });
    }