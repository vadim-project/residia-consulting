// ============================================================
// RESIDIA Consulting — Migration Analyzer v2.0
// AI-Powered Deep Branch Logic | Scoring Engine | Lead Gate
// ============================================================

// ─── 1. SCORING & STATE ─────────────────────────────────────

const AnalyzerState = {
    currentStepId: null,
    answers: {},            // { questionId: { value, label } }
    history: [],            // stack of step IDs for back navigation
    contactInfo: {},        // { name, phone, telegram }
    redFlags: [],           // accumulate detected red flags
    score: {
        overall: 100,       // starts at 100, deductions applied
        risk: 0,            // 0–30
        documentReadiness: 100,
        stabilityScore: 100,
        immigrationTrust: 100,
        employerReliability: 100,
        residenceContinuity: 100,
        incomeQuality: 100
    },
    conversationHistory: [],  // for AI multi-turn
    aiMode: false,            // true when we hand off to AI deep dive

    reset() {
        this.currentStepId = null;
        this.answers = {};
        this.history = [];
        this.contactInfo = {};
        this.redFlags = [];
        this.score = { overall: 100, risk: 0, documentReadiness: 100,
            stabilityScore: 100, immigrationTrust: 100, employerReliability: 100,
            residenceContinuity: 100, incomeQuality: 100 };
        this.conversationHistory = [];
        this.aiMode = false;
    },

    applyScoring(scoringObj) {
        if (!scoringObj) return;
        if (scoringObj.overall)             this.score.overall             = Math.max(0, this.score.overall             + scoringObj.overall);
        if (scoringObj.risk)                this.score.risk                = Math.min(30, this.score.risk               + scoringObj.risk);
        if (scoringObj.documentReadiness)   this.score.documentReadiness   = Math.max(0, this.score.documentReadiness   + scoringObj.documentReadiness);
        if (scoringObj.stabilityScore)      this.score.stabilityScore      = Math.max(0, this.score.stabilityScore      + scoringObj.stabilityScore);
        if (scoringObj.immigrationTrust)    this.score.immigrationTrust    = Math.max(0, this.score.immigrationTrust    + scoringObj.immigrationTrust);
        if (scoringObj.employerReliability) this.score.employerReliability = Math.max(0, this.score.employerReliability + scoringObj.employerReliability);
        if (scoringObj.residenceContinuity) this.score.residenceContinuity = Math.max(0, this.score.residenceContinuity + scoringObj.residenceContinuity);
        if (scoringObj.incomeQuality)       this.score.incomeQuality       = Math.max(0, this.score.incomeQuality       + scoringObj.incomeQuality);
        if (scoringObj.redFlag)             this.redFlags.push(scoringObj.redFlag);
    },

    addAnswer(questionId, valueId, label, scoring) {
        this.answers[questionId] = { value: valueId, label };
        this.applyScoring(scoring);
    },

    getFinalScore() {
        const s = this.score;
        const subscores = [s.documentReadiness, s.stabilityScore, s.immigrationTrust,
                           s.employerReliability, s.residenceContinuity, s.incomeQuality];
        const avg = subscores.reduce((a, b) => a + b, 0) / subscores.length;
        return Math.max(0, Math.min(100, Math.round((s.overall * 0.4) + (avg * 0.6))));
    }
};

// ─── 2. STATIC DECISION TREE ────────────────────────────────
// Deep branching with 30+ nodes covering all major paths

const FLOW = {

    // ── ENTRY ──────────────────────────────────────────────

    main_goal: {
        question: "Что именно вас интересует?",
        subtitle: "Выберите наиболее подходящий вариант, чтобы система адаптировала юридические вопросы под ваш кейс.",
        type: "options",
        options: [
            { id: "goal_work", label: "💼 Планирую подачу на карту побыта по работе", next: "nationality", scoring: {} },
            { id: "goal_cukr", label: "🇺🇦 Планирую подачу на карту CUKR", next: "ukr_status", scoring: {} },
            { id: "goal_family", label: "👨‍👩‍👧 Планирую подачу на карту побыта по воссоединению семьи", next: "nationality", scoring: {} },
            { id: "goal_speedup", label: "Уже подан, хочу ускорить дело", next: "urzad_location", scoring: { stabilityScore: +10 } },
        ]
    },

    // ── ВЕТКА: УСКОРЕНИЕ ДЕЛА (PONAGLENIE) ─────────────────
    
   urzad_location: {
        question: "В какой воеводский ужонд подано ваше дело?",
        type: "options",
        options: [
            { id: "urzad_mazowiecki", label: "🏢 Мазовецкий (Варшава)", next: "waiting_time_input", scoring: {}, expected_wait: 12 },
            { id: "urzad_dolnoslaski", label: "🌉 Нижнесилезский (Вроцлав)", next: "waiting_time_input", scoring: { risk: +1 }, expected_wait: 16 },
            { id: "urzad_malopolski", label: "🐉 Малопольский (Краков)", next: "waiting_time_input", scoring: {}, expected_wait: 5 },
            { id: "urzad_opolski", label: "🏰 Опольский (самые долгие сроки)", next: "waiting_time_input", scoring: { risk: +2 }, expected_wait: 19 },
            { id: "urzad_other", label: "🌍 Другой ужонд (в среднем)", next: "waiting_time_input", scoring: {}, expected_wait: 10 }
        ]
    },

    waiting_time_input: {
        question: "Сколько полных месяцев прошло с момента подачи заявления?",
        subtitle: "Закон отводит 60 дней на выдачу решения, но реальная статистика другая. Введите число месяцев:",
        type: "input_number",
        placeholder: "Например: 8",
        next: "fingerprints_status" 
    },

    fingerprints_status: {
        question: "Вы уже сдали отпечатки пальцев и получили красную печать в паспорт?",
        type: "options",
        options: [
            { id: "fingers_yes", label: "Да, отпечатки сданы, печать стоит", next: "wezwanie_status", scoring: { documentReadiness: +20, stabilityScore: +10 } },
            { id: "fingers_no_letter", label: "Нет, даже не было письма с датой", next: "wezwanie_status", scoring: { documentReadiness: -15, risk: +2 } },
            { id: "fingers_missed", label: "Пропустил(а) дату сдачи отпечатков", next: "wezwanie_status", scoring: { overall: -20, risk: +8, redFlag: "Пропуск сдачи отпечатков может привести к оставлению дела без рассмотрения" } }
        ]
    },

    wezwanie_status: {
        question: "Присылал ли вам инспектор письма (Wezwanie) с просьбой донести документы?",
        type: "options",
        options: [
            { id: "wez_no", label: "Нет, писем не было", next: "lead_gate", scoring: { stabilityScore: +5 } },
            { id: "wez_yes_done", label: "Да, документы донесены в срок", next: "lead_gate", scoring: { documentReadiness: +10 } },
            { id: "wez_yes_missed", label: "Да, но я не успел(а) / проигнорировал(а)", next: "lead_gate", scoring: { overall: -25, risk: +10, redFlag: "Невыполнение требований Wezwanie — главная причина отказа" } }
        ]
    },

    nationality: {
        question: "Какое у вас гражданство?",
        subtitle: "Это определяет базовые права и ограничения для вашего кейса.",
        type: "options",
        options: [
            { id: "ua", label: "🇺🇦 Украина", next: "ukr_status", scoring: { immigrationTrust: +5 } },
            { id: "by", label: "🇧🇾 Беларусь", next: "stay_basis", scoring: {} },
            { id: "ru", label: "🇷🇺 Россия", next: "stay_basis", scoring: { immigrationTrust: -10, redFlag: "Гражданство РФ — повышенная проверка в 2025–2026" } },
            { id: "kz", label: "🇰🇿 Казахстан / Средняя Азия", next: "stay_basis", scoring: {} },
            { id: "md", label: "🇲🇩 Молдова / Грузия", next: "stay_basis", scoring: {} },
            { id: "other_eu", label: "🇪🇺 Гражданин ЕС", next: "eu_path", scoring: { overall: +15 } },
            { id: "other", label: "🌍 Другое гражданство", next: "stay_basis", scoring: {} },
        ]
    },

    // ── UKR-SPECIFIC ───────────────────────────────────────
    ukr_status: {
        question: "Вы находитесь в Польше по статусу временной защиты (UKR)?",
        subtitle: "Это определяет, можете ли вы подать на CUKR или обычный pobyt.",
        type: "options",
        options: [
            { id: "ukr_yes_active", label: "Да, статус UKR активен", next: "ukr_details", scoring: { stabilityScore: +10 } },
            { id: "ukr_expired", label: "Статус UKR истёк или я его не продлевал(а)", next: "stay_basis", scoring: { overall: -10, risk: +3, redFlag: "Истёкший UKR-статус создаёт риск нелегального пребывания" } },
            { id: "ukr_no", label: "Нет, прибыл(а) не как украинец по защите", next: "stay_basis", scoring: {} },
        ]
    },

    ukr_details: {
        question: "Укажите детали вашего UKR-статуса:",
        subtitle: "Для CUKR важны соблюдение условий пребывания.",
        type: "options",
        options: [
            { id: "ukr_work", label: "Официально работаю, PESEL UKR есть", next: "pesel_status", scoring: { overall: +10, employerReliability: +5 } },
            { id: "ukr_no_work", label: "PESEL UKR есть, но работаю неофициально", next: "pesel_status", scoring: { overall: -5, risk: +3, redFlag: "Неофициальная работа при статусе UKR — риск лишения статуса" } },
            { id: "ukr_exits", label: "Выезжал(а) за пределы Польши более чем на 30 дней", next: "pesel_status", scoring: { overall: -15, risk: +5, residenceContinuity: -20, redFlag: "Выезд >30 дней прерывает непрерывность для CUKR/pobytu stałego" } },
            { id: "ukr_clean", label: "Всё чисто: не выезжал(а), работаю, нарушений нет", next: "pesel_status", scoring: { overall: +15, immigrationTrust: +10 } },
        ]
    },

    // ── GENERAL STAY BASIS ─────────────────────────────────
    stay_basis: {
        question: "На каком основании вы сейчас находитесь в Польше?",
        subtitle: "Ваш текущий правовой статус — ключевой параметр оценки.",
        type: "options",
        options: [
            { id: "visa_d_work", label: "Рабочая виза D (зарплатная / для высококвал.)", next: "visa_expiry", scoring: { overall: +5 } },
            { id: "visa_d_other", label: "Национальная виза D (другое основание)", next: "visa_expiry", scoring: {} },
            { id: "bezwiz", label: "Безвизовый режим (биометрический паспорт)", next: "bezwiz_days", scoring: { risk: +2 } },
            { id: "stamp", label: "Штамп в паспорте (ожидаю решения по заявке)", next: "stamp_details", scoring: { stabilityScore: +5 } },
            { id: "karta_active", label: "Действующая Карта Побыту", next: "karta_details", scoring: { overall: +10, stabilityScore: +10 } },
            { id: "student_visa", label: "Студенческая виза / разрешение на обучение", next: "study_details", scoring: {} },
            { id: "expired_docs", label: "Документы просрочены / нет легального основания", next: "overstay_details", scoring: { overall: -25, risk: +10, immigrationTrust: -20, redFlag: "КРИТИЧНО: Незаконное пребывание — угроза депортации и запрета въезда" } },
        ]
    },

    // ── PESEL / MELDUNEK ───────────────────────────────────
    pesel_status: {
        question: "Есть ли у вас PESEL и meldуnek (регистрация по адресу)?",
        type: "options",
        options: [
            { id: "pesel_meldunek", label: "Есть PESEL и meldunek по текущему адресу", next: "employment_basis", scoring: { documentReadiness: +15 } },
            { id: "pesel_no_meld", label: "PESEL есть, но meldunek отсутствует или устарел", next: "employment_basis", scoring: { documentReadiness: -10, risk: +2, redFlag: "Отсутствие meldunku при подаче — частая причина wezwanie" } },
            { id: "no_pesel", label: "PESEL нет", next: "employment_basis", scoring: { documentReadiness: -20, risk: +3, redFlag: "Без PESEL подача документов значительно усложнена" } },
        ]
    },

    // ── VISA / BEZWIZ DETAILS ──────────────────────────────
    visa_expiry: {
        question: "Когда истекает ваша виза?",
        type: "options",
        options: [
            { id: "visa_3m_plus", label: "Более 3 месяцев", next: "employment_basis", scoring: { stabilityScore: +10 } },
            { id: "visa_1_3m", label: "1–3 месяца (время подавать документы)", next: "employment_basis", scoring: { risk: +2 } },
            { id: "visa_30d", label: "Менее 30 дней (критический срок!)", next: "employment_basis", scoring: { overall: -10, risk: +5, redFlag: "Виза истекает менее чем через 30 дней — срочная подача" } },
        ]
    },

    bezwiz_days: {
        question: "Сколько дней из 90 безвизового периода вы уже использовали?",
        subtitle: "Правило 90/180: не более 90 дней в любом 180-дневном периоде.",
        type: "options",
        options: [
            { id: "bw_safe", label: "Менее 60 дней — запас есть", next: "employment_basis", scoring: {} },
            { id: "bw_tight", label: "60–80 дней — срок поджимает", next: "employment_basis", scoring: { risk: +4, overall: -5, redFlag: "Мало дней безвиза — необходима срочная стратегия" } },
            { id: "bw_over", label: "Уже превысил(а) 90 дней", next: "employment_basis", scoring: { overall: -20, risk: +8, immigrationTrust: -15, redFlag: "КРИТИЧНО: Превышен лимит безвизового пребывания" } },
        ]
    },

    stamp_details: {
        question: "Детали вашего ожидания решения (штамп в паспорте):",
        type: "options",
        options: [
            { id: "stamp_ok", label: "Подан вовремя, оснований для отказа нет", next: "employment_basis", scoring: { stabilityScore: +10 } },
            { id: "stamp_wezwanie", label: "Получил(а) wezwanie (запрос доп. документов)", next: "wezwanie_details", scoring: { risk: +5, overall: -5 } },
            { id: "stamp_long", label: "Жду более 18 месяцев", next: "employment_basis", scoring: { risk: +2 } },
        ]
    },

    wezwanie_details: {
        question: "Что именно запросили в wezwanie?",
        type: "options",
        options: [
            { id: "wez_income", label: "Документы о доходах / договор с работодателем", next: "employment_basis", scoring: { risk: +2 } },
            { id: "wez_residence", label: "Подтверждение проживания / meldunek", next: "employment_basis", scoring: { risk: +3, redFlag: "Wezwanie о месте жительства — риск сомнений в реальности пребывания" } },
            { id: "wez_marriage", label: "Доказательства брака / совместной жизни", next: "employment_basis", scoring: { risk: +5, redFlag: "Wezwanie о браке — индикатор подозрения в фиктивном браке" } },
            { id: "wez_employer", label: "Информация о работодателе / его деятельности", next: "employment_basis", scoring: { risk: +4, redFlag: "Wezwanie об работодателе — возможная проверка реальности трудоустройства" } },
            { id: "wez_other", label: "Другое / не уверен(а)", next: "employment_basis", scoring: { risk: +2 } },
        ]
    },

    karta_details: {
        question: "Когда истекает ваша Карта Побыту и на каком основании она выдана?",
        type: "options",
        options: [
            { id: "kp_1y_work", label: "До 1 года, рабочее основание — продление", next: "employment_basis", scoring: { overall: +5 } },
            { id: "kp_3y_work", label: "2–3 года, рабочее основание", next: "employment_basis", scoring: { overall: +10, stabilityScore: +10 } },
            { id: "kp_expires_soon", label: "Карта истекает в течение 3 месяцев", next: "employment_basis", scoring: { risk: +3 } },
            { id: "kp_family", label: "На основании воссоединения семьи / брака", next: "family_path", scoring: {} },
        ]
    },

    overstay_details: {
        question: "Как давно истекли ваши документы?",
        subtitle: "Каждый день незаконного пребывания увеличивает риск.",
        type: "options",
        options: [
            { id: "ov_7d", label: "Менее 7 дней — только что истекли", next: "employment_basis", scoring: { overall: -5, risk: +3 } },
            { id: "ov_30d", label: "Истекли 7–30 дней назад", next: "employment_basis", scoring: { overall: -15, risk: +6 } },
            { id: "ov_3m", label: "Более месяца назад", next: "employment_basis", scoring: { overall: -25, risk: +10, immigrationTrust: -20 } },
        ]
    },

    // ── EMPLOYMENT PATH ────────────────────────────────────
    employment_basis: {
        question: "Какой у вас основной источник дохода / тип занятости в Польше?",
        subtitle: "Это определяет тип подаваемого разрешения и требования к документам.",
        type: "options",
        options: [
            { id: "emp_umowa_pracę", label: "💼 Umowa o pracę (трудовой договор)", next: "employer_check", scoring: { incomeQuality: +15, overall: +5 } },
            { id: "emp_zlecenie", label: "📋 Umowa zlecenie / o dzieło", next: "employer_check", scoring: { incomeQuality: +5 } },
            { id: "emp_blue_card", label: "🌐 Высококвалифицированный специалист (Blue Card)", next: "blue_card_path", scoring: { overall: +15, incomeQuality: +20 } },
            { id: "emp_jdg", label: "🏢 JDG (собственный бизнес / ИП)", next: "jdg_path", scoring: {} },
            { id: "emp_sp_zoo", label: "🏗️ Sp. z o.o. (ООО / учредитель)", next: "jdg_path", scoring: { incomeQuality: +5 } },
            { id: "emp_student", label: "🎓 Студент (учёба — основное основание)", next: "study_details", scoring: {} },
            { id: "emp_family", label: "👨‍👩‍👧 Воссоединение семьи / брак с гражданином ПЛ/ЕС", next: "family_path", scoring: {} },
            { id: "emp_no_income", label: "❌ Нет официального дохода в Польше", next: "no_income_path", scoring: { overall: -20, risk: +6, incomeQuality: -30, redFlag: "Нет официального дохода — базовое требование для большинства оснований не выполнено" } },
        ]
    },

    // ── EMPLOYER CHECK (for umowa) ────────────────────────
    employer_check: {
        question: "Расскажите о вашем работодателе:",
        type: "options",
        options: [
            { id: "emp_large", label: "Крупная/средняя известная компания (50+ сотрудников)", next: "salary_level", scoring: { employerReliability: +20, overall: +5 } },
            { id: "emp_small", label: "Малый бизнес, 5–50 сотрудников, есть сайт", next: "employer_foreigners", scoring: { employerReliability: +10 } },
            { id: "emp_micro", label: "Микро-компания, <5 человек или без сайта", next: "employer_foreigners", scoring: { employerReliability: -10, risk: +3, redFlag: "Работодатель-микрокомпания без сайта — повышенный риск проверки" } },
            { id: "emp_recent", label: "Компания существует менее 1 года", next: "employer_foreigners", scoring: { employerReliability: -15, risk: +4, redFlag: "Работодатель-новичок (<1 года) — красный флаг для ужонда" } },
            { id: "emp_change", label: "Я недавно сменил(а) работодателя (менее 3 мес.)", next: "employer_foreigners", scoring: { employerReliability: -5, risk: +2, redFlag: "Смена работодателя менее 3 месяцев назад требует пересогласования" } },
        ]
    },

    employer_foreigners: {
        question: "Есть ли у работодателя опыт найма иностранцев?",
        type: "options",
        options: [
            { id: "emp_for_yes", label: "Да, регулярно нанимает иностранцев, знаком с процессом", next: "salary_level", scoring: { employerReliability: +10 } },
            { id: "emp_for_no", label: "Нет опыта с иностранцами, первый раз", next: "salary_level", scoring: { employerReliability: -5, risk: +2 } },
            { id: "emp_for_unknown", label: "Не знаю", next: "salary_level", scoring: {} },
        ]
    },

    salary_level: {
        question: "Какова ваша официальная зарплата по договору?",
        subtitle: "Минимальная зарплата в Польше в 2026 году — 4 666 PLN brutto.",
        type: "options",
        options: [
            { id: "sal_high", label: "Выше 7 000 PLN brutto (сильная позиция)", next: "previous_refusals", scoring: { incomeQuality: +20, overall: +10 } },
            { id: "sal_mid", label: "4 666 – 7 000 PLN brutto (достаточно)", next: "previous_refusals", scoring: { incomeQuality: +10 } },
            { id: "sal_min", label: "Минималка — 4 666 PLN brutto", next: "previous_refusals", scoring: { incomeQuality: 0 } },
            { id: "sal_low", label: "Ниже минималки / нестабильный доход", next: "previous_refusals", scoring: { incomeQuality: -15, overall: -10, risk: +4, redFlag: "Зарплата ниже минималки — базовое требование не выполнено" } },
        ]
    },

    // ── BLUE CARD PATH ─────────────────────────────────────
    blue_card_path: {
        question: "Параметры для Blue Card (EU):",
        subtitle: "Blue Card требует зарплату ≥ 150% средней по Польше (~10 500 PLN brutto в 2026).",
        type: "options",
        options: [
            { id: "bc_salary_ok", label: "Зарплата ≥ 10 500 PLN brutto + профильное образование", next: "previous_refusals", scoring: { overall: +20, incomeQuality: +25, immigrationTrust: +10 } },
            { id: "bc_salary_border", label: "Зарплата 8 000–10 500 PLN brutto", next: "previous_refusals", scoring: { overall: +5, risk: +3 } },
            { id: "bc_no_diploma", label: "Нет диплома о высшем образовании", next: "employment_basis", scoring: { overall: -15, risk: +4, redFlag: "Blue Card требует высшего образования — без диплома основание недоступно" } },
        ]
    },

    // ── JDG PATH ──────────────────────────────────────────
    jdg_path: {
        question: "Детали вашего бизнеса (JDG / Sp. z o.o.):",
        type: "options",
        options: [
            { id: "jdg_real_revenue", label: "Стабильные обороты, польские клиенты, есть фактуры", next: "jdg_zus", scoring: { incomeQuality: +15, employerReliability: +10 } },
            { id: "jdg_b2b_one", label: "Один клиент (B2B с одной компанией)", next: "jdg_zus", scoring: { risk: +4, incomeQuality: 0, redFlag: "JDG с одним клиентом — риск переквалификации в фиктивный бизнес" } },
            { id: "jdg_new", label: "Бизнес открыт менее 6 месяцев назад", next: "jdg_zus", scoring: { incomeQuality: -10, risk: +4, redFlag: "JDG <6 мес. — нет истории доходов, стабильность неочевидна" } },
            { id: "jdg_low_revenue", label: "Обороты минимальные или нестабильные", next: "jdg_zus", scoring: { incomeQuality: -20, overall: -10, risk: +5, redFlag: "Низкий оборот JDG — ужонд может счесть бизнес нежизнеспособным" } },
        ]
    },

    jdg_zus: {
        question: "Статус оплаты ZUS и US (налоги):",
        type: "options",
        options: [
            { id: "zus_ok", label: "ZUS и US оплачены вовремя, задолженностей нет", next: "previous_refusals", scoring: { immigrationTrust: +10, overall: +5 } },
            { id: "zus_arrears", label: "Есть задолженность по ZUS или налогам", next: "previous_refusals", scoring: { overall: -20, risk: +7, immigrationTrust: -20, redFlag: "КРИТИЧНО: Задолженность по ZUS/US — автоматический отказ" } },
            { id: "zus_unknown", label: "Не знаю текущий статус", next: "previous_refusals", scoring: { risk: +2 } },
        ]
    },

    // ── STUDY PATH ─────────────────────────────────────────
    study_details: {
        question: "Детали вашего обучения в Польше:",
        type: "options",
        options: [
            { id: "study_uni", label: "Государственный или аккредитованный частный вуз (uczelnia)", next: "study_attendance", scoring: { immigrationTrust: +10 } },
            { id: "study_policealna", label: "Полицеальная школа / курсы языка", next: "study_attendance", scoring: { risk: +3, redFlag: "Полицеальная школа — повышенная проверка на фиктивность обучения" } },
            { id: "study_mba", label: "MBA / профессиональная программа (платная)", next: "study_attendance", scoring: {} },
        ]
    },

    study_attendance: {
        question: "Посещаемость и академический статус:",
        type: "options",
        options: [
            { id: "att_regular", label: "Регулярное посещение, нет задолженностей", next: "previous_refusals", scoring: { immigrationTrust: +10 } },
            { id: "att_poor", label: "Плохая посещаемость / под угрозой отчисления", next: "previous_refusals", scoring: { overall: -15, risk: +6, redFlag: "Низкая посещаемость — признак фиктивного обучения, высокий риск отказа" } },
            { id: "att_leave", label: "Академический отпуск", next: "previous_refusals", scoring: { risk: +3, redFlag: "Академический отпуск прерывает основание для студенческого ВНЖ" } },
        ]
    },

    // ── FAMILY PATH ────────────────────────────────────────
    family_path: {
        question: "На каком семейном основании?",
        type: "options",
        options: [
            { id: "fam_spouse_pl", label: "Супруг(а) — гражданин Польши", next: "marriage_details", scoring: { overall: +15 } },
            { id: "fam_spouse_eu", label: "Супруг(а) — гражданин ЕС (не Польши)", next: "marriage_details", scoring: { overall: +10 } },
            { id: "fam_spouse_kp", label: "Супруг(а) — иностранец с Картой Побыту", next: "marriage_details", scoring: { overall: +5 } },
            { id: "fam_child_pl", label: "Мой ребёнок — гражданин Польши", next: "previous_refusals", scoring: { overall: +20, immigrationTrust: +15 } },
            { id: "fam_parent_pl", label: "Мои родители — граждане Польши", next: "previous_refusals", scoring: { overall: +15 } },
        ]
    },

    marriage_details: {
        question: "Детали вашего брака:",
        type: "options",
        options: [
            { id: "mar_3y_joint", label: "В браке >2 лет, живём вместе, есть общие дети", next: "previous_refusals", scoring: { immigrationTrust: +20, overall: +10 } },
            { id: "mar_fresh", label: "Бракосочетание менее 1 года назад", next: "previous_refusals", scoring: { risk: +4, redFlag: "Свежий брак (<1 года) — стандартная проверка на фиктивность" } },
            { id: "mar_separate_addr", label: "Разные адреса регистрации у супругов", next: "previous_refusals", scoring: { risk: +6, overall: -10, redFlag: "Раздельные адреса супругов — серьёзный индикатор фиктивного брака" } },
            { id: "mar_no_lang", label: "Не говорим на общем языке / культурный барьер", next: "previous_refusals", scoring: { risk: +3, redFlag: "Отсутствие общего языка — дополнительный риск при интервью" } },
        ]
    },

    // ── EU CITIZENS ────────────────────────────────────────
    eu_path: {
        question: "Вы гражданин ЕС — ваш путь значительно проще.",
        subtitle: "Для граждан ЕС доступна упрощённая регистрация без karta pobytu.",
        type: "options",
        options: [
            { id: "eu_register", label: "Хочу зарегистрировать пребывание (zaświadczenie)", next: "previous_refusals", scoring: { overall: +30 } },
            { id: "eu_family_non_eu", label: "Хочу легализовать члена семьи — не гражданина ЕС", next: "family_path", scoring: { overall: +15 } },
        ]
    },

    // ── NO INCOME PATH ─────────────────────────────────────
    no_income_path: {
        question: "Есть ли у вас другие подтверждённые источники средств к существованию?",
        type: "options",
        options: [
            { id: "ni_savings", label: "Собственные накопления на счёте польского банка (от 30 000 PLN)", next: "previous_refusals", scoring: { overall: +5, incomeQuality: +10 } },
            { id: "ni_family_support", label: "Финансовое обеспечение от члена семьи в Польше", next: "previous_refusals", scoring: { incomeQuality: 0 } },
            { id: "ni_nothing", label: "Нет ни доходов, ни накоплений в Польше", next: "previous_refusals", scoring: { overall: -30, risk: +8, redFlag: "КРИТИЧНО: Полное отсутствие средств — подача невозможна без срочной корректировки ситуации" } },
        ]
    },

    // ── PREVIOUS REFUSALS & HISTORY ────────────────────────
    previous_refusals: {
        question: "Была ли у вас когда-либо история отказов или нарушений в Польше / ЕС?",
        type: "options",
        options: [
            { id: "hist_clean", label: "Нет, история чистая", next: "criminal_check", scoring: { immigrationTrust: +10 } },
            { id: "hist_refusal_pl", label: "Был отказ в Польше (odmowa decyzji)", next: "refusal_details", scoring: { overall: -15, risk: +6, immigrationTrust: -15, redFlag: "Предыдущий отказ в Польше — требует детальной стратегии обжалования" } },
            { id: "hist_refusal_eu", label: "Был отказ в другой стране ЕС", next: "refusal_details", scoring: { overall: -10, risk: +4, redFlag: "Отказ в стране ЕС отображается в базах Шенгена" } },
            { id: "hist_deportation", label: "Депортация или запрет въезда в ЕС", next: "refusal_details", scoring: { overall: -40, risk: +15, immigrationTrust: -40, redFlag: "КРИТИЧНО: Депортация/запрет въезда — требуется специализированный юрист" } },
            { id: "hist_violations", label: "Нарушения (штрафы STRAŻ, незаконная работа)", next: "refusal_details", scoring: { overall: -10, risk: +5, immigrationTrust: -10, redFlag: "Зафиксированные нарушения снижают доверие ужонда" } },
        ]
    },

    refusal_details: {
        question: "Причина отказа или нарушения:",
        type: "options",
        options: [
            { id: "ref_docs", label: "Недостаток документов / технический отказ", next: "criminal_check", scoring: { risk: +1 } },
            { id: "ref_income", label: "Недостаточный доход / фиктивная занятость", next: "criminal_check", scoring: { risk: +4, overall: -5 } },
            { id: "ref_fraud", label: "Подозрение в мошенничестве / фиктивный брак", next: "criminal_check", scoring: { overall: -20, risk: +8, immigrationTrust: -20, redFlag: "Подозрение в мошенничестве в прошлом — критически сложный кейс" } },
            { id: "ref_unknown", label: "Не знаю официальной причины", next: "criminal_check", scoring: { risk: +2 } },
        ]
    },

    criminal_check: {
        question: "Есть ли у вас судимости (в Польше, стране гражданства или других странах ЕС)?",
        type: "options",
        options: [
            { id: "crim_none", label: "Нет судимостей", next: "residence_continuity", scoring: { immigrationTrust: +5 } },
            { id: "crim_minor", label: "Административные нарушения (мелкие)", next: "residence_continuity", scoring: { risk: +2 } },
            { id: "crim_serious", label: "Уголовная судимость (погашена или активная)", next: "residence_continuity", scoring: { overall: -30, risk: +10, immigrationTrust: -30, redFlag: "КРИТИЧНО: Уголовная судимость — автоматическое препятствие для большинства оснований" } },
        ]
    },

    // ── RESIDENCE CONTINUITY ──────────────────────────────
    residence_continuity: {
        question: "Как долго вы непрерывно проживаете в Польше?",
        subtitle: "Непрерывность пребывания критически важна для долгосрочных видов на жительство.",
        type: "options",
        options: [
            { id: "res_5y_plus", label: "5 лет и более (право на стały pobyt)", next: "family_situation", scoring: { overall: +15, residenceContinuity: +20, stabilityScore: +15 } },
            { id: "res_3_5y", label: "3–5 лет", next: "family_situation", scoring: { residenceContinuity: +10, stabilityScore: +10 } },
            { id: "res_1_3y", label: "1–3 года", next: "family_situation", scoring: { residenceContinuity: +5 } },
            { id: "res_less_1y", label: "Менее 1 года", next: "family_situation", scoring: {} },
            { id: "res_gaps", label: "Есть разрывы пребывания (выезды >90 дней)", next: "family_situation", scoring: { residenceContinuity: -20, risk: +4, redFlag: "Разрывы пребывания нарушают непрерывность — критично для długoterminowego резидентства" } },
        ]
    },

    // ── FAMILY SITUATION ──────────────────────────────────
    family_situation: {
        question: "Семейная ситуация при подаче:",
        type: "options",
        options: [
            { id: "fam_solo", label: "Подаюсь один(одна)", next: "lead_gate", scoring: {} },
            { id: "fam_with_spouse", label: "С супругом/супругой (будем подавать вместе)", next: "lead_gate", scoring: { documentReadiness: -5 } },
            { id: "fam_with_kids", label: "С несовершеннолетними детьми", next: "lead_gate", scoring: { documentReadiness: -5, risk: +1 } },
            { id: "fam_full", label: "Вся семья — супруг(а) + дети", next: "lead_gate", scoring: { documentReadiness: -10, risk: +2 } },
        ]
    },

    // ── LEAD GATE ─────────────────────────────────────────
    lead_gate: {
        type: "lead_gate",
        question: "Анализ готов на 95%",
        subtitle: "Введите ваши контакты, чтобы получить полный персональный отчёт с рекомендациями."
    },

    // ── AI DEEP DIVE (after lead gate) ───────────────────
    ai_analysis: {
        type: "ai_result"
    }
};

// ─── 3. PROGRESS TRACKER ────────────────────────────────────
let TOTAL_STEPS_ESTIMATE = 12;

function updateProgress(stepIndex) {
    const progressContainer = document.getElementById('analyzer-progress');
    const progressFill = document.getElementById('progress-fill');
    const stepCurrent = document.getElementById('step-current');
    const stepTotal = document.getElementById('step-total');
    if (!progressContainer || !progressFill) return;
    progressContainer.classList.remove('hidden');
    const pct = Math.min(95, Math.round(((stepIndex + 1) / TOTAL_STEPS_ESTIMATE) * 100));
    progressFill.style.width = pct + '%';
    if (stepCurrent) stepCurrent.textContent = stepIndex + 1;
    if (stepTotal) stepTotal.textContent = TOTAL_STEPS_ESTIMATE;
}

// ─── 4. RENDERER ───────────────────────────────────────────

function renderStep(stepId) {
    const step = FLOW[stepId];
    if (!step) { console.error('Unknown step:', stepId); return; }

    AnalyzerState.currentStepId = stepId;
    AnalyzerState.history.push(stepId);

    const container = document.getElementById('question-container');
    container.classList.remove('active');
    container.classList.add('hidden');

    updateProgress(AnalyzerState.history.length - 1);

    setTimeout(() => {
        if (step.type === 'lead_gate') {
            container.innerHTML = buildLeadGate();
            bindLeadGateEvents();
        } else if (step.type === 'ai_result') {
            container.innerHTML = buildLoadingScreen();
            runAIAnalysis();
        } else if (step.type === 'input_number') {
            // Рендерим шаг с полем ввода
            container.innerHTML = buildInputStep(step, stepId);
            bindInputButton(stepId);
        } else {
            container.innerHTML = buildOptionsStep(step, stepId);
            bindOptionButtons(stepId);
        }
        container.classList.remove('hidden');
        container.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 280);
}

function buildOptionsStep(step) {
    const redFlagAlert = AnalyzerState.redFlags.length > 0 && AnalyzerState.redFlags.length % 2 === 0
        ? `<div class="rf-alert">⚠️ Обнаружен потенциальный риск — уточняем детали вашего кейса…</div>`
        : '';

    const optionsHTML = step.options.map(opt => `
        <button class="analyzer-option-btn" data-option-id="${opt.id}" data-option-label="${opt.label.replace(/"/g, '&quot;')}">
            <span class="option-label">${opt.label}</span>
            <span class="option-arrow">→</span>
        </button>
    `).join('');

    return `
        ${redFlagAlert}
        <h2 class="analyzer-question-title">${step.question}</h2>
        ${step.subtitle ? `<p class="analyzer-question-subtitle">${step.subtitle}</p>` : ''}
        <div class="analyzer-options-grid">${optionsHTML}</div>
        ${AnalyzerState.history.length > 1 ? `<button class="btn-back" id="btn-back">← Назад</button>` : ''}
    `;
}

function bindOptionButtons(stepId) {
    const step = FLOW[stepId];
    document.querySelectorAll('.analyzer-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const optionId = btn.dataset.optionId;
            const label = btn.dataset.optionLabel;
            const selectedOpt = step.options.find(o => o.id === optionId);

            // === УМНОЕ ИЗМЕНЕНИЕ ДЛИНЫ КВИЗА ===
            if (optionId === 'goal_speedup') TOTAL_STEPS_ESTIMATE = 6;
            else if (optionId === 'goal_cukr') TOTAL_STEPS_ESTIMATE = 5;
            else if (optionId === 'goal_family') TOTAL_STEPS_ESTIMATE = 6;
            else if (optionId === 'goal_work') TOTAL_STEPS_ESTIMATE = 12;
            // ===================================

            AnalyzerState.addAnswer(stepId, optionId, label, selectedOpt.scoring);

            // Подсветка кнопки
            document.querySelectorAll('.analyzer-option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            setTimeout(() => renderStep(selectedOpt.next), 200);
        });
    });

    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            AnalyzerState.history.pop(); 
            const prev = AnalyzerState.history.pop(); 
            if (prev) renderStep(prev);
        });
    }
}

function buildInputStep(step, stepId) {
    return `
        <h2 class="analyzer-question-title">${step.question}</h2>
        ${step.subtitle ? `<p class="analyzer-question-subtitle">${step.subtitle}</p>` : ''}
        
        <div class="an-input-group" style="margin-bottom: 2rem; max-width: 250px; margin-left: auto; margin-right: auto;">
            <input type="number" id="an-num-input" placeholder="${step.placeholder}" min="0" max="60" 
                   style="font-size: 1.5rem; padding: 1rem; text-align: center; font-weight: 600;">
        </div>
        
        <div id="violation-alert" class="rf-alert hidden" style="text-align: left; margin-bottom: 2rem; font-size: 0.95rem;"></div>
        
        <button class="btn-solid" id="btn-next-step" style="width: 100%; max-width: 300px; margin: 0 auto; display: block;">Рассчитать сроки →</button>
        ${AnalyzerState.history.length > 1 ? `<button class="btn-back" id="btn-back" style="display:block; margin: 1.5rem auto 0;">← Назад</button>` : ''}
    `;
}

function bindInputButton(stepId) {
    const step = FLOW[stepId];
    const btnNext = document.getElementById('btn-next-step');
    const input = document.getElementById('an-num-input');
    const alertBox = document.getElementById('violation-alert');

    btnNext.addEventListener('click', () => {
        const val = parseInt(input.value);
        if (isNaN(val) || val < 0) {
            input.style.borderColor = '#ef4444';
            return;
        }
        
        input.style.borderColor = 'var(--border-color)';
        let warningText = "";
        
        // Математика сроков ожидания
        if (stepId === 'waiting_time_input') {
            const urzadId = AnalyzerState.answers['urzad_location']?.value;
            const urzadOpt = FLOW['urzad_location'].options.find(o => o.id === urzadId);
            const expectedWait = urzadOpt ? urzadOpt.expected_wait : 10;
            
            if (val >= expectedWait) {
                // Жесткое нарушение сроков
                AnalyzerState.redFlags.push(`Сроки нарушены: ожидание ${val} мес. (среднее ${expectedWait} мес.)`);
                AnalyzerState.applyScoring({ risk: +4, stabilityScore: -10 });
                
                alertBox.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                alertBox.style.color = '#ef4444';
                alertBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                warningText = `⚠️ <strong>Обнаружено нарушение сроков!</strong><br><br>Среднее время ожидания в вашем ужонде — ${expectedWait} мес. Вы ждете уже ${val} мес. Вам необходимо срочно подавать официальное Ponaglenie (жалобу на бездействие).`;
            } else {
                // В пределах нормы ужонда
                const left = expectedWait - val;
                alertBox.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                alertBox.style.color = 'var(--text-color)';
                alertBox.style.borderColor = 'var(--accent-color)';
                warningText = `ℹ️ <strong>В пределах нормы (для 2026 года).</strong><br><br>Среднее время ожидания в выбранном ужонде — ${expectedWait} мес. Примерная дата вашей децизии: через <strong>~${left} мес.</strong>`;
            }
        }
        
        // Записываем ответ в историю для финального отчета
        AnalyzerState.answers[stepId] = { value: val, label: `${val} месяцев` };
        
        // Показываем вердикт на 4 секунды, затем переводим на следующий шаг
        alertBox.innerHTML = warningText;
        alertBox.classList.remove('hidden');
        btnNext.style.display = 'none'; // Прячем кнопку, чтобы клиент прочитал текст
        input.disabled = true; // Блокируем ввод
        
        setTimeout(() => {
            renderStep(step.next);
        }, 4000);
    });

    // Обработка кнопки "Назад"
    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            AnalyzerState.history.pop(); 
            const prev = AnalyzerState.history.pop(); 
            if (prev) renderStep(prev);
        });
    }
}
// ─── 5. LEAD GATE ──────────────────────────────────────────

function buildLeadGate() {
    const score = AnalyzerState.getFinalScore();
    const riskCount = AnalyzerState.redFlags.length;

    return `
        <div class="lead-gate-wrapper">
            <div class="lead-gate-badge">Анализ завершён на 95%</div>
            <h2 class="analyzer-question-title">Ваш предварительный результат<span class="text-accent">.</span></h2>

            <div class="score-preview-row">
                <div class="score-circle score-${getScoreClass(score)}">
                    <span class="score-number">${score}</span>
                    <span class="score-label">из 100</span>
                </div>
                <div class="score-summary">
                    <div class="score-summary-title">${getScoreTitle(score)}</div>
                    <p class="score-summary-text">${getScoreSummary(score, riskCount)}</p>
                    ${riskCount > 0 ? `<div class="red-flag-count">🚩 Выявлено рисков: <strong>${riskCount}</strong></div>` : ''}
                </div>
            </div>

            <div class="lead-gate-divider">
                <span>Для получения полного анализа, плана действий и стоимости</span>
            </div>

            <form id="analyzer-lead-form" class="lead-form" novalidate>
                <div class="an-input-group">
                    <label for="an-name">Ваше имя *</label>
                    <input type="text" id="an-name" placeholder="Имя" autocomplete="given-name" required>
                </div>
                <div class="an-input-group">
                    <label for="an-phone">Телефон (WhatsApp / Viber) *</label>
                    <input type="tel" id="an-phone" placeholder="+48XXXXXXXXX" autocomplete="tel">
                    <span id="an-phone-error" class="error-msg" style="display:none">Формат: +48XXXXXXXXX</span>
                </div>
                <div class="an-input-group">
                    <label for="an-telegram">Telegram (необязательно)</label>
                    <input type="text" id="an-telegram" placeholder="@username">
                </div>
                <p class="lead-privacy-note">
                    Нажимая кнопку, вы соглашаетесь с <a href="privacy.html" target="_blank">политикой конфиденциальности</a>.
                    Данные используются только для подготовки вашего отчёта.
                </p>
                <button type="submit" class="btn-solid" id="btn-lead-submit" style="width:100%;justify-content:center;">
                    Получить полный анализ →
                </button>
            </form>
        </div>
    `;
}

const MAKE_WEBHOOK = 'https://hook.eu1.make.com/toyydkhpex3x7t5huytu2lwv4okfsgx8';

// Builds the richest possible payload for Notion via Make
function buildWebhookPayload(name, phone, telegram) {
    const score       = AnalyzerState.getFinalScore();
    const basePrice   = calcPrice(score, AnalyzerState.redFlags.length);
    const s           = AnalyzerState.score;
    const answers     = AnalyzerState.answers;

    // "Type of lead" — главное основание из анкеты
    const empAnswer  = answers['employment_basis'];
    const basisMap   = {
        emp_umowa_pracę: 'Umowa o pracę',
        emp_zlecenie:    'Umowa zlecenie',
        emp_blue_card:   'Blue Card',
        emp_jdg:         'JDG / Бизнес',
        emp_sp_zoo:      'Sp. z o.o.',
        emp_student:     'Студент',
        emp_family:      'Воссоединение семьи',
        emp_no_income:   'Нет дохода'
    };
    const typeOfLead = empAnswer ? (basisMap[empAnswer.value] || empAnswer.label) : 'Не указано';

    // "Rysk" — уровень риска словом
    const riskLevel = s.risk >= 12 ? 'Критический'
                    : s.risk >= 7  ? 'Высокий'
                    : s.risk >= 3  ? 'Средний'
                    : 'Низкий';

    // Полный список ответов как читаемый текст
    const answersText = Object.entries(answers)
        .filter(([k]) => !['client_name', 'client_phone'].includes(k))
        .map(([k, v]) => `${k}: ${v.label}`)
        .join('\n');

    return {
        // ── Notion columns ──────────────────────────────
        name,
        phone,
        telegram:      telegram || '',
        type_of_lead:  typeOfLead,
        rysk:          riskLevel,
        price:         basePrice,

        // ── Extended scoring (Make может маппить в доп. колонки) ──
        score_overall:              score,
        score_risk_points:          s.risk,
        score_document_readiness:   s.documentReadiness,
        score_stability:            s.stabilityScore,
        score_immigration_trust:    s.immigrationTrust,
        score_employer_reliability: s.employerReliability,
        score_residence_continuity: s.residenceContinuity,
        score_income_quality:       s.incomeQuality,

        // ── Red flags ──────────────────────────────────
        red_flags_count: AnalyzerState.redFlags.length,
        red_flags:       AnalyzerState.redFlags.join(' | ') || 'нет',

        // ── Full answers dump ──────────────────────────
        answers_full: answersText,

        // ── Meta ──────────────────────────────────────
        source:     'analyzer.html',
        submitted_at: new Date().toISOString(),
        page_url:   window.location.href
    };
}

async function sendToWebhook(payload) {
    try {
        await fetch(MAKE_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log('[Webhook] ✓ Лид отправлен в Make →', payload);
    } catch (err) {
        // silent — не блокируем UX при ошибке сети
        console.warn('[Webhook] ✗ Ошибка отправки:', err);
    }
}

function bindLeadGateEvents() {
    const form = document.getElementById('analyzer-lead-form');
    if (!form) return;
    const phoneRegex = /^\+48\d{9}$/;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name     = document.getElementById('an-name').value.trim();
        const phone    = document.getElementById('an-phone').value.trim();
        const telegram = document.getElementById('an-telegram').value.trim();
        const phoneError = document.getElementById('an-phone-error');

        if (!name) { document.getElementById('an-name').parentElement.classList.add('has-error'); return; }
        if (!phoneRegex.test(phone)) { phoneError.style.display = 'block'; return; }
        phoneError.style.display = 'none';

        AnalyzerState.contactInfo = { name, phone, telegram };

        const submitBtn = document.getElementById('btn-lead-submit');
        submitBtn.classList.add('is-loading');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Генерируем ваш отчёт…';

        // ── Fire webhook (non-blocking) ──
        const payload = buildWebhookPayload(name, phone, telegram);
        sendToWebhook(payload); // без await — не задерживаем UX

        renderStep('ai_analysis');
    });
}

// ─── 6. AI ANALYSIS ENGINE ─────────────────────────────────

function buildLoadingScreen() {
    return `
        <div class="ai-loading-screen text-center">
            <div class="ai-loading-spinner"></div>
            <h2 class="analyzer-question-title" style="margin-top:2rem;">Генерируем ваш персональный отчёт</h2>
            <p class="analyzer-question-subtitle">AI анализирует ваш кейс по 12 критериям миграционного права…</p>
            <div class="ai-loading-steps" id="ai-loading-steps">
                <div class="ai-step ai-step-active">📋 Анализируем правовую базу кейса</div>
                <div class="ai-step">🔍 Проверяем red flags и противоречия</div>
                <div class="ai-step">📊 Рассчитываем вероятности и сроки</div>
                <div class="ai-step">📝 Формируем персональный план действий</div>
            </div>
        </div>
    `;
}

function animateLoadingSteps() {
    const steps = document.querySelectorAll('.ai-step');
    let idx = 0;
    const interval = setInterval(() => {
        if (idx < steps.length) {
            steps.forEach(s => s.classList.remove('ai-step-active'));
            steps[idx].classList.add('ai-step-active', 'ai-step-done');
            idx++;
        } else {
            clearInterval(interval);
        }
    }, 1800);
}

async function runAIAnalysis() {
    animateLoadingSteps();

    const score = AnalyzerState.getFinalScore();
    const answersText = Object.entries(AnalyzerState.answers)
        .map(([k, v]) => `${k}: ${v.label}`)
        .join('\n');
    const redFlagsText = AnalyzerState.redFlags.length > 0
        ? AnalyzerState.redFlags.join('\n')
        : 'Красных флагов не обнаружено';

    const subscores = AnalyzerState.score;

    const systemPrompt = `Ты — старший юрист-эксперт по миграционному праву Польши с 15-летним опытом. 
Твоя задача — на основании анкеты клиента сформировать персональный юридический экспресс-анализ кейса на получение karta pobytu / ВНЖ в Польше.

Формат ответа: строго JSON (без markdown, без \`\`\`). Структура:
{
  "headline": "Одна фраза-вердикт о кейсе (до 15 слов)",
  "overall_verdict": "2-3 предложения общей оценки ситуации клиента",
  "main_basis": "Рекомендуемое основание для подачи (1-2 предложения)",
  "alternative_bases": ["альтернатива 1", "альтернатива 2"],
  "strengths": ["плюс 1", "плюс 2", "плюс 3"],
  "critical_issues": ["проблема 1", "проблема 2"],
  "urgent_actions": ["срочное действие 1", "срочное действие 2", "срочное действие 3"],
  "wezwanie_probability": "Низкая / Средняя / Высокая",
  "refusal_probability": "Низкая / Средняя / Высокая",
  "timeline": "Ориентировочные сроки получения решения",
  "doc_checklist": ["документ 1", "документ 2", "документ 3", "документ 4", "документ 5"],
  "closing_advice": "1-2 предложения финального совета"
}`;

    const userPrompt = `Вот данные анкеты клиента RESIDIA Consulting:

ОТВЕТЫ КЛИЕНТА:
${answersText}

ОЦЕНКИ СИСТЕМЫ:
- Итоговый скор: ${score}/100
- Уровень риска: ${subscores.risk}/30
- Готовность документов: ${subscores.documentReadiness}/100
- Стабильность: ${subscores.stabilityScore}/100
- Доверие ужонда: ${subscores.immigrationTrust}/100
- Надёжность работодателя: ${subscores.employerReliability}/100
- Непрерывность пребывания: ${subscores.residenceContinuity}/100
- Качество дохода: ${subscores.incomeQuality}/100

ВЫЯВЛЕННЫЕ КРАСНЫЕ ФЛАГИ:
${redFlagsText}

Имя клиента: ${AnalyzerState.contactInfo.name || 'клиент'}

Сформируй персональный юридический анализ. Будь конкретным, используй реальные юридические термины польского миграционного права (karta pobytu, decyzja, wezwanie, odmowa, straż graniczna, ZUS, US, PESEL, meldunek, pobyt stały, CUKR и т.д.). Тон: профессиональный, эмпатичный, без агрессивных продаж, но с чёткой рекомендацией обратиться к специалисту по сложным вопросам.`;

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "claude-sonnet-4-20250514",
                max_tokens: 1000,
                messages: [
                    { role: "user", content: systemPrompt + "\n\n" + userPrompt }
                ]
            })
        });

        const data = await response.json();
        const rawText = data.content.map(b => b.text || '').join('');

        let analysis;
        try {
            const clean = rawText.replace(/```json|```/g, '').trim();
            analysis = JSON.parse(clean);
        } catch {
            analysis = null;
        }

        renderFinalResults(analysis, score);

    } catch (err) {
        console.error('AI Error:', err);
        renderFinalResults(null, score);
    }
}

// ─── 7. RESULTS SCREEN ────────────────────────────────────

// Price calculation based on case complexity
function calcPrice(score, redFlagsCount) {
    let base = 1150;
    // Complexity surcharges
    if (score < 50)          base += 500;   // critical case
    else if (score < 65)     base += 300;   // high complexity
    else if (score < 80)     base += 150;   // medium complexity
    if (redFlagsCount >= 3)  base += 300;   // many red flags
    else if (redFlagsCount >= 1) base += 100;
    // Family surcharge
    const famAnswer = AnalyzerState.answers['family_situation'];
    if (famAnswer && (famAnswer.value === 'fam_with_kids' || famAnswer.value === 'fam_full')) base += 400;
    else if (famAnswer && famAnswer.value === 'fam_with_spouse') base += 250;
    // Business / Blue Card surcharge
    const empAnswer = AnalyzerState.answers['employment_basis'];
    if (empAnswer && (empAnswer.value === 'emp_jdg' || empAnswer.value === 'emp_sp_zoo' || empAnswer.value === 'emp_blue_card')) base += 300;
    return base;
}

function buildPriceBlock(basePrice) {
    const discountPrice = Math.round(basePrice * 0.9 / 10) * 10; // -10%, rounded to 10
    const isComplex = basePrice > 1150;

    return `
        <div class="price-block" id="price-block">
            <div class="price-block-top">
                <div class="price-label-col">
                    <span class="price-block-title">Стоимость сопровождения</span>
                    <span class="price-block-sub">Оплата — после подачи документов</span>
                </div>
                <div class="price-numbers" id="price-numbers">
                    <span class="price-current" id="price-current">${basePrice} PLN</span>
                </div>
            </div>
            ${isComplex ? `<p class="price-complexity-note">⚠️ Стоимость выше базовой (1 150 PLN) из-за сложности вашего кейса. Точная сумма фиксируется на консультации.</p>` : ''}
            <div class="price-payment-note">
                <span class="price-payment-icon">✓</span>
                Оплата производится только после подачи всех документов в ужонд — вы ничем не рискуете до результата.
            </div>
        </div>
    `;
}

function buildShareBlock(basePrice) {
    const discountPrice = Math.round(basePrice * 0.9 / 10) * 10;
    const shareUrl = encodeURIComponent(window.location.href.split('?')[0]);
    const shareText = encodeURIComponent('Проверил(а) свои шансы на ВНЖ в Польше через анализатор RESIDIA — рекомендую пройти! 🇵🇱');

    return `
        <div class="share-block" id="share-block">
            <div class="share-block-inner">
                <div class="share-discount-badge">−10% скидка</div>
                <h3 class="share-title">Поделитесь анализатором — получите скидку</h3>
                <p class="share-desc">Отправьте ссылку другу или опубликуйте в соцсетях. После того как вы поделитесь — цена обновится прямо здесь.</p>
                <div class="share-buttons">
                    <button class="share-btn share-btn-tg" onclick="handleShare('telegram', ${basePrice}, ${discountPrice}, 'https://t.me/share/url?url=${shareUrl}&text=${shareText}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.018 9.51c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 14.338l-2.95-.924c-.642-.204-.654-.642.136-.95l11.526-4.446c.535-.194 1.003.13.68.23z"/></svg>
                        Telegram
                    </button>
                    <button class="share-btn share-btn-wa" onclick="handleShare('whatsapp', ${basePrice}, ${discountPrice}, 'https://wa.me/?text=${shareText}%20${shareUrl}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.559 4.121 1.535 5.854L.057 23.5l5.797-1.521A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.894a9.878 9.878 0 01-5.036-1.378l-.361-.214-3.741.981.999-3.648-.235-.374A9.855 9.855 0 012.105 12C2.105 6.59 6.59 2.105 12 2.105S21.895 6.59 21.895 12 17.41 21.895 12 21.895z"/></svg>
                        WhatsApp
                    </button>
                    <button class="share-btn share-btn-copy" onclick="handleShare('copy', ${basePrice}, ${discountPrice}, '')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        Скопировать ссылку
                    </button>
                </div>
                <p class="share-already" id="share-status"></p>
            </div>
        </div>
    `;
}

function handleShare(method, basePrice, discountPrice, url) {
    if (method === 'telegram' || method === 'whatsapp') {
        window.open(url, '_blank');
    } else if (method === 'copy') {
        navigator.clipboard.writeText(window.location.href.split('?')[0]).catch(() => {});
    }
    // Activate discount after sharing
    activateDiscount(basePrice, discountPrice);
}

function activateDiscount(basePrice, discountPrice) {
    const priceNumbers = document.getElementById('price-numbers');
    const shareStatus = document.getElementById('share-status');
    const shareBtn = document.getElementById('btn-dash-share');

    // Защита от двойного клика
    if (!priceNumbers || priceNumbers.dataset.discounted === 'true') return;
    priceNumbers.dataset.discounted = 'true';

    // Зачеркиваем старую цену и пишем новую зеленую (через inline-стили для надежности)
    priceNumbers.innerHTML = `
        <span style="text-decoration: line-through; color: var(--text-muted); font-size: 1.2rem; margin-right: 8px;">${basePrice}</span>
        <span style="color: var(--accent-color);">${discountPrice} PLN</span>
    `;

    // Выводим сообщение о промокоде
    if (shareStatus) {
        shareStatus.innerHTML = '✓ Скидка 10% успешно применена! Промокод: <strong>SHARE10</strong>';
        shareStatus.style.color = 'var(--accent-color)';
    }
    
    // Прячем кнопку шеринга, раз скидка уже получена
    if (shareBtn) {
        shareBtn.style.display = 'none';
    }
}

function renderFinalResults(analysis, score) {
    const container = document.getElementById('question-container');
    const progressContainer = document.getElementById('analyzer-progress');
    if (progressContainer) {
        document.getElementById('progress-fill').style.width = '100%';
        document.getElementById('step-current').textContent = TOTAL_STEPS_ESTIMATE;
    }

    const name = AnalyzerState.contactInfo.name || 'Клиент';
    const scoreClass = getScoreClass(score);
    const redFlags = AnalyzerState.redFlags;
    const basePrice = calcPrice(score, redFlags.length);
    const isSpeedupPath = AnalyzerState.answers['main_goal']?.value === 'goal_speedup';

    // Фолбеки (оставил твои тексты, только сжал)
    const fallbackDefault = {
        headline: "Анализ завершён — требуется консультация специалиста",
        overall_verdict: "Кейс требует профессиональной оценки для выбора стратегии.",
        main_basis: "Определяется на консультации.",
        strengths: ["Риски выявлены", "Инициатива проявлена"],
        critical_issues: redFlags.length > 0 ? redFlags.slice(0, 2) : ["Необходим анализ бумаг"],
        urgent_actions: ["Записаться на консультацию", "Проверить ZUS"],
        wezwanie_probability: score < 60 ? "Высокая" : score < 80 ? "Средняя" : "Низкая",
        refusal_probability: score < 50 ? "Высокая" : score < 70 ? "Средняя" : "Низкая",
        timeline: "6–12 мес.",
        doc_checklist: ["Паспорт", "Умова", "PIT", "Мельдунек", "Фото"],
        closing_advice: "Стратегия кардинально меняет исход дела."
    };

    const fallbackSpeedup = {
        headline: "Выявлено нарушение сроков (KPA) со стороны Ужонда",
        overall_verdict: "Дело затянуто. У вас есть право на запуск процедуры Ponaglenie.",
        main_basis: "Жалоба на бездействие воеводы (Ponaglenie).",
        strengths: ["Отпечатки сданы", "Сроки KPA (60 дней) истекли"],
        critical_issues: ["Инспектор затягивает решение", "Справки могут устареть"],
        urgent_actions: ["Подать Ponaglenie", "Запросить Wgląd", "Обновить ZUS"],
        wezwanie_probability: "Низкая",
        refusal_probability: "Низкая",
        timeline: "1.5 – 3 мес.",
        doc_checklist: ["Внёсек со штампом", "Все Wezwanie", "Оплата пошлины", "Хронология"],
        closing_advice: "Дела с жалобами рассматриваются в приоритетном порядке."
    };

    const a = analysis || (isSpeedupPath ? fallbackSpeedup : fallbackDefault);

    container.classList.add('hidden');
    setTimeout(() => {
        let htmlTemplate = `
            <div class="dash-wrapper">
                
                <div class="dash-header">
                    <div class="dash-badge">${isSpeedupPath ? 'Анализ задержки' : 'Анализ шансов'}</div>
                    <h2 class="dash-title">${name}, ваш экспресс-разбор готов.</h2>
                    <p class="dash-quote">"${a.headline}"</p>
                </div>

                <div class="dash-metrics-ribbon">
                    <div class="dm-score dm-${scoreClass}">
                        <span class="dm-score-val">${score}</span>
                        <span class="dm-score-lbl">/100</span>
                    </div>
                    <div class="dm-divider"></div>
                    <div class="dm-item">
                        <span class="dm-label">${isSpeedupPath ? 'Риск без рассмотр.' : 'Риск wezwanie'}</span>
                        <span class="dm-val prob-${getProbClass(a.wezwanie_probability)}">${a.wezwanie_probability}</span>
                    </div>
                    <div class="dm-item">
                        <span class="dm-label">Риск отказа</span>
                        <span class="dm-val prob-${getProbClass(a.refusal_probability)}">${a.refusal_probability}</span>
                    </div>
                    <div class="dm-item">
                        <span class="dm-label">Сроки</span>
                        <span class="dm-val text-accent">${a.timeline}</span>
                    </div>
                </div>

                <div class="dash-grid">
                    <div class="dash-card">
                        <h4 class="dc-title">📋 Резюме и стратегия</h4>
                        <p class="dc-text"><strong>Вердикт:</strong> ${a.overall_verdict}</p>
                        <p class="dc-text"><strong>Цель:</strong> ${a.main_basis}</p>
                        
                        <h4 class="dc-title" style="margin-top: 1rem;">⚡ Первоочередные шаги</h4>
                        <ul class="dc-list">
                            ${a.urgent_actions.map(action => `<li>${action}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="dash-card">
                        <div class="dc-split">
                            <div class="dc-half">
                                <h4 class="dc-title green">✅ Плюсы</h4>
                                <ul class="dc-list-small">
                                    ${a.strengths.map(s => `<li>${s}</li>`).join('')}
                                </ul>
                            </div>
                            <div class="dc-half">
                                <h4 class="dc-title red">⚠️ Риски</h4>
                                <ul class="dc-list-small">
                                    ${a.critical_issues.map(i => `<li>${i}</li>`).join('')}
                                </ul>
                            </div>
                        </div>
                        ${redFlags.length > 0 ? `<div class="dc-flags">🚩 <strong>Красные флаги:</strong> ${redFlags.join('; ')}</div>` : ''}
                        
                        <h4 class="dc-title" style="margin-top: 1rem;">📁 Документы (чек-лист)</h4>
                        <div class="dc-tags">
                            ${a.doc_checklist.map(d => `<span class="dc-tag">${d}</span>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="dash-footer">
                    <div class="df-price-col">
                        <span class="df-price-lbl">Ведение дела:</span>
                        <div class="df-price-val" id="price-numbers">
                            <span class="price-current" id="price-current">${basePrice} PLN</span>
                        </div>
                        <span class="df-price-sub">Оплата после подачи</span>
                    </div>
                    <div class="df-cta-col">
                        <a href="https://t.me/residia_consulting" target="_blank" class="btn-solid df-btn">
                            ${isSpeedupPath ? 'Ускорить в Telegram →' : 'Узнать детали в Telegram →'}
                        </a>
                        <button class="btn-outline df-btn-share" id="btn-dash-share">
                            🔗 Поделиться (-10%)
                        </button>
                    </div>
                </div>
                <p class="share-already" id="share-status" style="text-align:center; margin-top:0.5rem;"></p>

            </div>
        `;
        
        container.innerHTML = htmlTemplate;
        container.classList.remove('hidden');
        container.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // === ВЕШАЕМ НАТИВНЫЙ ШЕРИНГ СРАЗУ ПОСЛЕ ОТРИСОВКИ ===
        const btnShare = document.getElementById('btn-dash-share');
        if (btnShare) {
            btnShare.addEventListener('click', async () => {
                const shareData = {
                    title: 'Оценка шансов на ВНЖ - RESIDIA',
                    text: 'Проверил(а) свои шансы на ВНЖ в Польше через анализатор RESIDIA. Рекомендую пройти! 🇵🇱',
                    url: window.location.href.split('?')[0]
                };
                
                try {
                    // Если браузер поддерживает системное меню шеринга (мобилки/Mac)
                    if (navigator.share) {
                        await navigator.share(shareData);
                    } else {
                        // Фолбэк для старых ПК: копируем в буфер обмена
                        await navigator.clipboard.writeText(shareData.url);
                    }
                    // Включаем скидку, если человек поделился
                    activateDiscount(basePrice, Math.round(basePrice * 0.9 / 10) * 10);
                } catch (err) {
                    console.log('Пользователь отменил шеринг', err);
                }
            });
        }
        // ====================================================

    }, 300);
}

// ─── 8. HELPERS ────────────────────────────────────────────

function buildSubScoreBar(label, value) {
    const clamped = Math.max(0, Math.min(100, value));
    let barClass = 'bar-good';
    if (clamped < 50) barClass = 'bar-bad';
    else if (clamped < 75) barClass = 'bar-medium';
    return `
        <div class="subscore-row">
            <span class="subscore-label">${label}</span>
            <div class="subscore-track">
                <div class="subscore-fill ${barClass}" style="width:${clamped}%"></div>
            </div>
            <span class="subscore-value">${clamped}</span>
        </div>
    `;
}

function getScoreClass(score) {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

function getScoreTitle(score) {
    if (score >= 80) return 'Сильный кейс';
    if (score >= 65) return 'Хорошие шансы';
    if (score >= 50) return 'Требует доработки';
    if (score >= 35) return 'Высокий риск';
    return 'Критическая ситуация';
}

function getScoreSummary(score, riskCount) {
    if (score >= 75) return `Ваша ситуация выглядит стабильно. ${riskCount > 0 ? `Обнаружено ${riskCount} факторов, требующих внимания.` : 'Красных флагов не выявлено.'}`;
    if (score >= 50) return `Есть усложняющие факторы. Выявлено ${riskCount} рисков — требуется их устранение до подачи.`;
    return `Обнаружены критические риски (${riskCount}). Самостоятельная подача сопряжена с высокой вероятностью отказа.`;
}

function getProbClass(prob) {
    if (prob === 'Низкая') return 'low';
    if (prob === 'Средняя') return 'medium';
    return 'high';
}

// ─── 9. INLINE STYLES FOR ANALYZER ────────────────────────
// Injected to avoid requiring changes to styles.css

function injectAnalyzerStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* ── Question Subtitle ── */
        .analyzer-question-subtitle {
            color: var(--text-muted);
            font-size: 0.95rem;
            margin-bottom: 1.5rem;
            line-height: 1.5;
        }

        /* ── Options ── */
        .analyzer-options-grid {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
            margin-bottom: 1.5rem;
        }
        .analyzer-option-btn {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1rem 1.25rem;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            cursor: pointer;
            text-align: left;
            font-size: 0.95rem;
            color: var(--text-color);
            transition: border-color 0.2s, background 0.2s, transform 0.15s;
            font-family: var(--font-main);
        }
        .analyzer-option-btn:hover {
            border-color: var(--accent-color);
            transform: translateX(4px);
        }
        .analyzer-option-btn.selected {
            border-color: var(--accent-color);
            background: rgba(16, 185, 129, 0.08);
        }
        .option-label { flex: 1; }
        .option-arrow { color: var(--accent-color); font-size: 1.1rem; margin-left: 1rem; }

        /* ── Back button ── */
        .btn-back {
            background: none;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 0.9rem;
            padding: 0.5rem 0;
            font-family: var(--font-main);
        }
        .btn-back:hover { color: var(--text-color); }

        /* ── Red Flag Alert ── */
        .rf-alert {
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 4px;
            padding: 0.75rem 1rem;
            font-size: 0.85rem;
            color: #ef4444;
            margin-bottom: 1.5rem;
        }

        /* ── Lead Gate ── */
        .lead-gate-wrapper { max-width: 520px; margin: 0 auto; }
        .lead-gate-badge {
            display: inline-block;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.1em;
            padding: 0.4rem 1rem;
            border: 1px solid var(--accent-color);
            border-radius: 2rem;
            color: var(--accent-color);
            margin-bottom: 1.5rem;
        }
        .score-preview-row {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        .score-circle {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            border: 3px solid;
        }
        .score-circle.score-high { border-color: var(--accent-color); color: var(--accent-color); }
        .score-circle.score-medium { border-color: #f59e0b; color: #f59e0b; }
        .score-circle.score-low { border-color: #ef4444; color: #ef4444; }
        .score-number { font-size: 1.8rem; font-weight: 600; line-height: 1; }
        .score-label { font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
        .score-summary-title { font-weight: 600; margin-bottom: 0.4rem; }
        .score-summary-text { font-size: 0.9rem; color: var(--text-muted); }
        .red-flag-count { font-size: 0.85rem; color: #ef4444; margin-top: 0.5rem; }
        .lead-gate-divider {
            text-align: center;
            font-size: 0.8rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.08em;
            margin: 1.5rem 0;
        }
        .lead-form { display: flex; flex-direction: column; gap: 1rem; }
        .an-input-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .an-input-group label { font-size: 0.85rem; font-weight: 500; }
        .an-input-group input {
            padding: 0.85rem 1rem;
            border: 1px solid var(--border-color);
            border-radius: 3px;
            background: var(--bg-color);
            color: var(--text-color);
            font-size: 1rem;
            font-family: var(--font-main);
        }
        .an-input-group input:focus { outline: none; border-color: var(--accent-color); }
        .error-msg { color: #ef4444; font-size: 0.8rem; }
        .lead-privacy-note { font-size: 0.78rem; color: var(--text-muted); line-height: 1.4; }
        .lead-privacy-note a { color: var(--accent-color); }

        /* ── AI Loading ── */
        .ai-loading-screen { padding: 3rem 0; }
        .ai-loading-spinner {
            width: 56px;
            height: 56px;
            border: 3px solid var(--border-color);
            border-top-color: var(--accent-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .ai-loading-steps { display: flex; flex-direction: column; gap: 0.75rem; margin-top: 2rem; text-align: left; }
        .ai-step {
            padding: 0.75rem 1rem;
            border-radius: 3px;
            border: 1px solid var(--border-color);
            font-size: 0.9rem;
            color: var(--text-muted);
            transition: all 0.3s;
        }
        .ai-step.ai-step-active {
            border-color: var(--accent-color);
            color: var(--text-color);
            background: rgba(16, 185, 129, 0.06);
        }
        .ai-step.ai-step-done { color: var(--text-muted); }

        /* ── Results ── */
        .results-wrapper { max-width: 680px; margin: 0 auto; }
        .results-header { margin-bottom: 2rem; }
        .results-title { font-size: clamp(1.5rem, 3vw, 2rem); margin-bottom: 0.75rem; }
        .results-headline-quote {
            font-size: 1rem;
            color: var(--text-muted);
            font-style: italic;
            border-left: 3px solid var(--accent-color);
            padding-left: 1rem;
        }

        /* Score Dashboard */
        .results-score-dashboard {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 1.5rem;
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
        }
        @media (max-width: 600px) {
            .results-score-dashboard { grid-template-columns: 1fr; }
            .score-preview-row { flex-direction: column; text-align: center; }
        }
        .score-main-block {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 1rem 1.5rem;
            border-radius: 4px;
            min-width: 120px;
            border: 2px solid;
        }
        .score-main-block.score-high { border-color: var(--accent-color); }
        .score-main-block.score-medium { border-color: #f59e0b; }
        .score-main-block.score-low { border-color: #ef4444; }
        .score-big-number { font-size: 3rem; font-weight: 700; line-height: 1; }
        .score-main-block.score-high .score-big-number { color: var(--accent-color); }
        .score-main-block.score-medium .score-big-number { color: #f59e0b; }
        .score-main-block.score-low .score-big-number { color: #ef4444; }
        .score-out-of { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .score-title-label { font-size: 0.85rem; font-weight: 600; margin-top: 0.4rem; }
        .score-subscores { display: flex; flex-direction: column; gap: 0.6rem; }
        .subscore-row { display: flex; align-items: center; gap: 0.75rem; }
        .subscore-label { font-size: 0.8rem; color: var(--text-muted); width: 160px; flex-shrink: 0; }
        @media (max-width: 480px) { .subscore-label { width: 110px; font-size: 0.72rem; } }
        .subscore-track { flex: 1; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; }
        .subscore-fill { height: 100%; border-radius: 3px; transition: width 0.6s ease; }
        .bar-good { background: var(--accent-color); }
        .bar-medium { background: #f59e0b; }
        .bar-bad { background: #ef4444; }
        .subscore-value { font-size: 0.8rem; font-weight: 600; width: 30px; text-align: right; }

        /* Result cards */
        .result-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 1.25rem 1.5rem;
            margin-bottom: 1rem;
        }
        .result-card.accent-border { border-left: 3px solid var(--accent-color); }
        .result-card.accent-border-green { border-left: 3px solid var(--accent-color); background: rgba(16, 185, 129, 0.04); }
        .result-card.result-card-green { border-left: 3px solid var(--accent-color); }
        .result-card.result-card-red { border-left: 3px solid #ef4444; }
        .result-card.result-card-redflag { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.04); }
        .result-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem; }
        .result-card-label { font-weight: 600; font-size: 0.9rem; }
        .result-card-text { color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; }

        .result-list { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
        .result-list li { font-size: 0.9rem; color: var(--text-muted); padding-left: 1.25rem; position: relative; }
        .result-list li::before { content: '•'; position: absolute; left: 0; color: var(--accent-color); }
        .result-list-ordered { counter-reset: result-counter; }
        .result-list-ordered li { counter-increment: result-counter; }
        .result-list-ordered li::before { content: counter(result-counter) '.'; color: var(--accent-color); font-weight: 600; }

        .result-checklist { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
        .result-checklist li { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.9rem; }
        .check-box { color: var(--accent-color); flex-shrink: 0; }

        .alt-bases { margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .alt-bases-label { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.3rem; width: 100%; }
        .alt-basis-tag {
            font-size: 0.8rem;
            padding: 0.25rem 0.75rem;
            border: 1px solid var(--border-color);
            border-radius: 2rem;
            color: var(--text-muted);
        }

        .results-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        @media (max-width: 540px) { .results-two-col { grid-template-columns: 1fr; } }

        .results-three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
        @media (max-width: 540px) { .results-three-col { grid-template-columns: 1fr; } }
        .prob-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 1rem;
            text-align: center;
        }
        .prob-label { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; }
        .prob-value { font-weight: 700; font-size: 1.1rem; }
        .prob-value.prob-low { color: var(--accent-color); }
        .prob-value.prob-medium { color: #f59e0b; }
        .prob-value.prob-high { color: #ef4444; }
        .prob-value.prob-neutral { color: var(--text-color); font-size: 0.9rem; }

        /* CTA */
        .results-cta-block { margin-top: 2.5rem; padding: 2rem 1.5rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 6px; }
        .cta-title { font-size: 1.25rem; margin-bottom: 0.75rem; }
        .cta-subtitle { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 1.5rem; line-height: 1.5; }
        .cta-buttons-group { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem; }
        .cta-btn-primary { text-decoration: none; }
        .cta-disclaimer { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.75rem; }

        /* Existing risk badges kept */
        .risk-badge { padding: 0.3rem 0.75rem; border-radius: 2rem; font-size: 0.78rem; font-weight: 600; }
        .risk-low { background: rgba(16,185,129,0.15); color: #10B981; }
        .risk-medium { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .risk-high { background: rgba(239,68,68,0.15); color: #ef4444; }

        /* Mixed input step */
        .analyzer-mixed-form { display: flex; flex-direction: column; gap: 1rem; }
        .an-input-group { display: flex; flex-direction: column; gap: 0.4rem; }
        .analyzer-select {
            padding: 0.85rem 1rem;
            border: 1px solid var(--border-color);
            border-radius: 3px;
            background: var(--bg-color);
            color: var(--text-color);
            font-size: 1rem;
            font-family: var(--font-main);
        }

        /* Transition */
        .analyzer-step { transition: opacity 0.28s ease; }
        .hidden { display: none !important; }
        #question-container.active { animation: fadeSlideIn 0.3s ease; }
        @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
        }

        /* ── PRICE BLOCK ── */
        .price-block {
            background: var(--card-bg);
            border: 2px solid var(--text-color);
            border-radius: 6px;
            padding: 1.5rem;
            margin: 2rem 0 1rem;
        }
        .price-block-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 1rem;
        }
        .price-label-col { display: flex; flex-direction: column; gap: 0.25rem; }
        .price-block-title { font-weight: 700; font-size: 1rem; }
        .price-block-sub { font-size: 0.8rem; color: var(--accent-color); font-weight: 600; }
        .price-numbers { display: flex; align-items: center; gap: 0.75rem; }
        .price-current { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; }
        .price-old {
            font-size: 1.6rem;
            font-weight: 700;
            color: var(--text-muted);
            position: relative;
            display: inline-block;
        }
        .price-old::after {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            width: 0;
            height: 2px;
            background: #ef4444;
            transform: translateY(-50%);
            transition: width 0.5s ease 0.1s;
        }
        .price-old.strikethrough-animate::after { width: 100%; }
        .price-new {
            font-size: 2rem;
            font-weight: 700;
            color: var(--accent-color);
            opacity: 0;
            transform: translateY(6px);
            transition: opacity 0.4s ease 0.5s, transform 0.4s ease 0.5s;
        }
        .price-new.price-new-animate { opacity: 1; transform: translateY(0); }
        .price-complexity-note {
            font-size: 0.82rem;
            color: #f59e0b;
            background: rgba(245,158,11,0.08);
            border-radius: 3px;
            padding: 0.5rem 0.75rem;
            margin-bottom: 0.75rem;
        }
        .price-payment-note {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            font-size: 0.85rem;
            color: var(--text-muted);
            border-top: 1px solid var(--border-color);
            padding-top: 0.75rem;
        }
        .price-payment-icon { color: var(--accent-color); font-weight: 700; flex-shrink: 0; }

        /* ── SHARE BLOCK ── */
        .share-block {
            background: linear-gradient(135deg, rgba(16,185,129,0.06) 0%, transparent 100%);
            border: 2px dashed var(--accent-color);
            border-radius: 6px;
            padding: 1.5rem;
            margin: 1rem 0 2rem;
            transition: border-style 0.3s, background 0.3s;
        }
        .share-block.share-done {
            border-style: solid;
            background: rgba(16,185,129,0.06);
        }
        .share-discount-badge {
            display: inline-block;
            background: var(--accent-color);
            color: #fff;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            padding: 0.3rem 0.75rem;
            border-radius: 2rem;
            margin-bottom: 0.75rem;
        }
        .share-title { font-size: 1.05rem; font-weight: 700; margin-bottom: 0.5rem; }
        .share-desc { font-size: 0.88rem; color: var(--text-muted); margin-bottom: 1.25rem; line-height: 1.5; }
        .share-buttons { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
        .share-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.7rem 1.1rem;
            border-radius: 4px;
            border: 1px solid var(--border-color);
            background: var(--card-bg);
            color: var(--text-color);
            font-size: 0.875rem;
            font-family: var(--font-main);
            cursor: pointer;
            transition: all 0.2s;
            font-weight: 500;
        }
        .share-btn:hover { border-color: var(--accent-color); transform: translateY(-1px); }
        .share-btn-tg:hover { color: #2aabee; border-color: #2aabee; }
        .share-btn-wa:hover { color: #25d366; border-color: #25d366; }
        .share-btn-copy:hover { color: var(--accent-color); }
        .share-already { font-size: 0.85rem; font-weight: 600; min-height: 1.2em; transition: color 0.3s; }
    `;
    document.head.appendChild(style);
}


// ─── 10. INIT ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    injectAnalyzerStyles();

    // === АНИМАЦИЯ ПЕЧАТАЮЩЕГОСЯ ТЕКСТА ===
    const typingContainer = document.getElementById('typing-text');
    let typingTimer = null;

    if (typingContainer) {
        const fullText = "Привет, я умный анализатор шансов ВНЖ от ";
        let index = 0;
        
        function typeEffect() {
            if (index < fullText.length) {
                typingContainer.innerHTML += fullText.charAt(index);
                index++;
                typingTimer = setTimeout(typeEffect, 45);
            } else {
                // Вставляем бренд с классом плавного проявления fade-in-brand
                typingContainer.innerHTML += '<span class="text-accent fade-in-brand">Residia.</span>';
                
                // Убираем мигающий курсор чуть позже, чтобы он не исчезал обрывисто
                setTimeout(() => {
                    const cursor = document.querySelector('.typing-cursor');
                    if (cursor) cursor.style.display = 'none';
                }, 1000);
            }
        }
        setTimeout(typeEffect, 300);
    }
    // =====================================

    const btnStart = document.getElementById('btn-start-analyzer');
    const stepOnboarding = document.getElementById('step-onboarding');
    const questionContainer = document.getElementById('question-container');

    if (btnStart && stepOnboarding && questionContainer) {
        btnStart.addEventListener('click', () => {
            if (typingTimer) clearTimeout(typingTimer); 

            AnalyzerState.reset();
            TOTAL_STEPS_ESTIMATE = 12;
            
            stepOnboarding.classList.remove('active');
            stepOnboarding.classList.add('hidden');
            questionContainer.classList.remove('hidden');
            renderStep('main_goal');
        });
    }
});

