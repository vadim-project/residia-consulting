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