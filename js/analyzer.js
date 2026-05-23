// js/analyzer.js

// 1. Дерево вопросов (Конфиг воронки)
const questionsFlow = [
    {
        id: "main_goal",
        question: "Какой у вас сейчас основной вопрос по легализации в Польше?",
        options: [
            { id: "karta_pobytu", label: "Получение карты побыту", next: "current_status", scoring: { risk: 0, complexity: 1 } },
            { id: "stay_extension", label: "Продление пребывания", next: "current_status", scoring: { risk: 1, complexity: 1 } },
            { id: "doc_problems", label: "Проблемы с документами", next: "current_status", scoring: { risk: 2, complexity: 2 } },
            { id: "pesel_ukr", label: "PESEL UKR / статус UKR", next: "current_status", scoring: { risk: 0, complexity: 1 } },
            { id: "employer_change", label: "Смена работодателя", next: "current_status", scoring: { risk: 1, complexity: 2 } },
            { id: "after_refusal", label: "После отказа / сложная ситуация", next: "current_status", scoring: { risk: 3, complexity: 3 } },
            { id: "not_sure", label: "Пока не уверен(а)", next: "current_status", scoring: { risk: 0, complexity: 1 } }
        ]
    },
    {
        id: "current_status",
        question: "Какое у вас сейчас текущее основание для пребывания в Польше?",
        options: [
            { id: "visa_d", label: "Рабочая или иная виза (D)", next: "days_left", scoring: { risk: 0, complexity: 1 } },
            { id: "bezwiz", label: "Безвизовый режим (биометрия)", next: "days_left", scoring: { risk: 1, complexity: 1 } },
            { id: "pesel_ukr", label: "Статус UKR (PESEL UKR)", next: "ukr_zus_status", scoring: { risk: 0, complexity: 1 } },
            { id: "karta_pobytu_active", label: "Действующая Карта Побыту", next: "karta_expiry", scoring: { risk: 0, complexity: 1 } },
            { id: "stamp", label: "Печать в паспорте (ожидание карты)", next: "stamp_status", scoring: { risk: 1, complexity: 2 } },
            { id: "student", label: "Студенческий статус (без визы/карты)", next: "days_left", scoring: { risk: 0, complexity: 1 } },
            { id: "expired", label: "Документы просрочены / нет оснований", next: "overdue_details", scoring: { risk: 3, complexity: 3 } }
        ]
    }
];

// 2. Менеджер состояния (State Machine)
const AnalyzerState = {
    currentStepIndex: -1, // -1 означает Onboarding экран
    answers: {},
    totalSteps: 6, // Ориентировочное количество шагов для расчета прогресса [cite: 546]
    score: { riskPoints: 0, complexityPoints: 0 },

    // Инициализация при клике на "Начать анализ"
    start() {
        this.currentStepIndex = 0;
        this.updateProgress();
        this.renderCurrentStep();
    },

    // Сохранение ответа и переход дальше
    saveAnswer(questionId, optionId, scoring) {
        this.answers[questionId] = optionId;
        
        // Накапливаем скоринг рисков [cite: 553, 554]
        if (scoring) {
            this.score.riskPoints += scoring.risk;
            this.score.complexityPoints += scoring.complexity;
        }

        // Ищем выбранную опцию, чтобы узнать следующий шаг (next)
        const currentQuestion = questionsFlow[this.currentStepIndex];
        const selectedOption = currentQuestion.options.find(opt => opt.id === optionId);

        console.log(`[State] Ответ сохранен: ${questionId} -> ${optionId}. Текущий риск: ${this.score.riskPoints}`);

        // Логика переключения шагов (в MVP идем по индексу, далее сделаем граф ветвлений)
        this.next();
    },

    next() {
        this.currentStepIndex++;
        if (this.currentStepIndex < questionsFlow.length) {
            this.updateProgress();
            this.renderCurrentStep();
        } else {
            this.finishFlow();
        }
    },

    // Обновление прогресс-бара
    updateProgress() {
        const progressContainer = document.getElementById('analyzer-progress');
        const progressFill = document.getElementById('progress-fill');
        const stepCurrent = document.getElementById('step-current');
        const stepTotal = document.getElementById('step-total');

        if (progressContainer && progressFill) {
            progressContainer.classList.remove('hidden');
            
            // Считаем процент (Mobile UX: первый шаг уже показывает > 0%, чтобы вовлекать)
            const percentage = Math.round(((this.currentStepIndex + 1) / this.totalSteps) * 100);
            progressFill.style.width = `${percentage}%`;
            
            if (stepCurrent && stepTotal) {
                stepCurrent.textContent = this.currentStepIndex + 1;
                stepTotal.textContent = this.totalSteps;
            }
        }
    },

    // Динамический рендер вопроса на экран (Mobile-first layout)
    renderCurrentStep() {
        const questionContainer = document.getElementById('question-container');
        if (!questionContainer) return;

        const currentQuestion = questionsFlow[this.currentStepIndex];

        // Генерируем премиальную вертикальную разметку под мобильные экраны
        let optionsHTML = currentQuestion.options.map(option => `
            <button class="analyzer-option-btn" data-option-id="${option.id}">
                <span class="option-label">${option.label}</span>
                <span class="option-arrow">→</span>
            </button>
        `).join('');

        // Плавное скрытие старого и появление нового контента
        questionContainer.classList.add('hidden');
        
        setTimeout(() => {
            questionContainer.innerHTML = `
                <h2 class="analyzer-question-title">${currentQuestion.question}</h2>
                <div class="analyzer-options-grid">
                    ${optionsHTML}
                </div>
            `;
            
            questionContainer.classList.remove('hidden');
            questionContainer.classList.add('active');

            // Вешаем слушатели клика на новые кнопки вариантов
            const buttons = questionContainer.querySelectorAll('.analyzer-option-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const optionId = btn.dataset.optionId;
                    const selectedOption = currentQuestion.options.find(opt => opt.id === optionId);
                    this.saveAnswer(currentQuestion.id, optionId, selectedOption.scoring);
                });
            });
        }, 300); // Небольшой таймаут для плавности CSS-перехода
    },

    finishFlow() {
        console.log('[Routing] Опрос завершен. Переход к Lead Screen. Собранный стейт:', this.answers);
        // Сюда позже повесим рендер формы сбора контактов
    }
};

// Инициализация привязки к стартовой кнопке твоего analyzer.html
document.addEventListener('DOMContentLoaded', () => {
    const btnStartAnalyzer = document.getElementById('btn-start-analyzer');
    const stepOnboarding = document.getElementById('step-onboarding');
    const questionContainer = document.getElementById('question-container');

    if (btnStartAnalyzer && stepOnboarding && questionContainer) {
        btnStartAnalyzer.addEventListener('click', () => {
            stepOnboarding.classList.remove('active');
            stepOnboarding.classList.add('hidden');

            setTimeout(() => {
                questionContainer.classList.remove('hidden');
                AnalyzerState.start();
            }, 400);
        });
    }
});