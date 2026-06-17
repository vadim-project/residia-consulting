// ============================================================
// RESIDIA Consulting — Migration Analyzer v2.0
// AI-Powered Deep Branch Logic | Scoring Engine | Lead Gate
// ============================================================

// ─── 1. SCORING & STATE ─────────────────────────────────────

const AnalyzerState = {
    currentStepId: null,
    answers: {},            
    history: [],       
    downloadedPdf: false,     
    contactInfo: {},        
    redFlags: [],           
    docExpiryDays: null,    
    score: {
        overall: 60,        
        risk: 0,            
        documentReadiness: 50,  
        stabilityScore: 60,
        immigrationTrust: 60,
        employerReliability: 60,
        residenceContinuity: 60,
        incomeQuality: 50   
    },
    conversationHistory: [],  
    aiMode: false,            

    reset() {
        this.currentStepId = null;
        this.answers = {};
        this.history = [];
        this.downloadedPdf = false;
        this.contactInfo = {};
        this.redFlags = [];
        this.docExpiryDays = null;
        this.score = { overall: 60, risk: 0, documentReadiness: 50,
            stabilityScore: 60, immigrationTrust: 60, employerReliability: 60,
            residenceContinuity: 60, incomeQuality: 50 };
        this.conversationHistory = [];
        this.aiMode = false;
        this.notionPageId = null;
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
        const delta = {
            overall:             scoring?.overall             || 0,
            risk:                scoring?.risk                || 0,
            documentReadiness:   scoring?.documentReadiness   || 0,
            stabilityScore:      scoring?.stabilityScore      || 0,
            immigrationTrust:    scoring?.immigrationTrust    || 0,
            employerReliability: scoring?.employerReliability || 0,
            residenceContinuity: scoring?.residenceContinuity || 0,
            incomeQuality:       scoring?.incomeQuality       || 0,
            redFlag:             scoring?.redFlag             || null,
        };
        this.answers[questionId] = { value: valueId, label, delta };
        this.applyScoring(scoring);
    },

    rollbackAnswer(questionId) {
        const ans = this.answers[questionId];
        if (!ans) return;
        if (ans.delta) {
            const d = ans.delta;
            this.score.overall             = Math.min(100, this.score.overall             - d.overall);
            this.score.risk                = Math.max(0,   this.score.risk                - d.risk);
            this.score.documentReadiness   = Math.min(100, this.score.documentReadiness   - d.documentReadiness);
            this.score.stabilityScore      = Math.min(100, this.score.stabilityScore      - d.stabilityScore);
            this.score.immigrationTrust    = Math.min(100, this.score.immigrationTrust    - d.immigrationTrust);
            this.score.employerReliability = Math.min(100, this.score.employerReliability - d.employerReliability);
            this.score.residenceContinuity = Math.min(100, this.score.residenceContinuity - d.residenceContinuity);
            this.score.incomeQuality       = Math.min(100, this.score.incomeQuality       - d.incomeQuality);
            if (d.redFlag) {
                const idx = this.redFlags.indexOf(d.redFlag);
                if (idx > -1) this.redFlags.splice(idx, 1);
            }
        }
        delete this.answers[questionId];
    },

    getDeadlineInfo() {
        const days = this.docExpiryDays;
        if (!days || days <= 0) return null;
        const submitByDate = new Date();
        submitByDate.setDate(submitByDate.getDate() + days - 14);
        const formatted = submitByDate.toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        return {
            daysLeft:   days,
            submitBy:   formatted,
            isUrgent:   days <= 45,
            isCritical: days <= 14,
        };
    },

    getFinalScore() {
        const s = this.score;
        const subscores = [s.documentReadiness, s.stabilityScore, s.immigrationTrust,
                           s.employerReliability, s.residenceContinuity, s.incomeQuality];
        const avg = subscores.reduce((a, b) => a + b, 0) / subscores.length;
        let finalScore = Math.max(0, Math.min(100, Math.round((s.overall * 0.4) + (avg * 0.6))));

        const answers = this.answers;
        const goal = answers['main_goal']?.value;
        const contract = answers['work_contract_type']?.value;
        const cukrIncome = answers['cukr_income']?.value;
        const famWork = answers['fam_relative_work']?.value;

        if (goal === 'goal_work' && contract === 'w_no_contract') {
            finalScore = Math.min(finalScore, 15);
        } else if (goal === 'goal_cukr' && cukrIncome === 'c_inc_none') {
            finalScore = Math.min(finalScore, 15);
        } else if (goal === 'goal_family' && famWork === 'f_work_no') {
            finalScore = Math.min(finalScore, 10);
        }

        if (answers['previous_refusals']?.value === 'hist_deportation') {
            finalScore = Math.min(finalScore, 8);
        }
        if (answers['criminal_check']?.value === 'crim_serious') {
            finalScore = Math.min(finalScore, 12);
        }

        return finalScore;
    }
};

// ─── 2. STATIC DECISION TREE ────────────────────────────────

const FLOW = {

    start_status: {
        question: "Каков ваш текущий статус легализации?",
        subtitle: "Выберите подходящий вариант, чтобы адаптировать юридический разбор под вашу ситуацию.",
        type: "options",
        options: [
            { id: "status_submitted", label: "⏳ Я уже подан на карту побыта (жду решение)", next: "urzad_location", scoring: {} },
            { id: "status_planning", label: "📅 Я только планирую подачу документов", next: "main_goal", scoring: {} }
        ]
    },

    main_goal: {
        question: "Что именно вас интересует?",
        subtitle: "Выберите наиболее подходящий вариант, чтобы система адаптировала юридические вопросы под ваш кейс.",
        type: "options",
        options: [
            { id: "goal_work", label: "Карта побыта по работе", next: "urzad_location", scoring: {} },
            { id: "goal_cukr", label: "Подача на карту CUKR", next: "urzad_location", scoring: {} },
            { id: "goal_family", label: "Карта побыта/Воссоединение семьи", next: "urzad_location", scoring: {} },
            { id: "goal_staly", label: "Карта сталого побыта", next: "urzad_location", scoring: {} },
            { id: "goal_resident", label: "Карта долгосрочного резидента ЕС", next: "urzad_location", scoring: {} }
        ]
    },

    staly_basis: {
        question: "На каком основании вы планируете запрашивать Карту Сталого Побыта?",
        subtitle: "Для этой карты необходимы веские основания, связанные с происхождением или семейным статусом.",
        type: "options",
        options: [
            { id: "staly_kp", label: "У меня есть действующая Карта Поляка", next: "staly_integration", scoring: { overall: +20, immigrationTrust: +20 } },
            { id: "staly_roots", label: "У меня есть документы, подтверждающие польские корни", next: "staly_integration", scoring: { overall: +15, immigrationTrust: +15 } },
            { id: "staly_marriage", label: "Брак с гражданином / гражданкой Польши", next: "staly_marriage_dates", scoring: { overall: +10 } },
            { id: "staly_long_residence", label: "Проживание в Польше более 5 лет по работе", next: "nationality", scoring: { overall: -30, risk: +40 } }
        ]
    },

    staly_marriage_dates: {
        question: "Соответствуете ли вы временным критериям подачи по браку?",
        subtitle: "Закон требует одновременного выполнения двух условий по срокам на момент подачи.",
        type: "options",
        options: [
            { id: "staly_m_ok", label: "В браке > 3 лет, и последние 2 года живу в Польше по ВНЖ", next: "nationality", scoring: { overall: +20, residenceContinuity: +20 } },
            { id: "staly_m_fail", label: "Брак менее 3 лет ИЛИ по ВНЖ живу в Польше менее 2 лет", next: "nationality", scoring: { overall: -40, risk: +50 } }
        ]
    },

    staly_integration: {
        question: "Сможете ли вы подтвердить намерение остаться в Польше?",
        subtitle: "Инспекторы тщательно проверяют экономическую и социальную связь со страной.",
        type: "options",
        options: [
            { id: "staly_int_yes", label: "Да, официально работаю / учусь или арендую жилье", next: "nationality", scoring: { overall: +15, stabilityScore: +15 } },
            { id: "staly_int_no", label: "Пока нет (только переехал или работаю неофициально)", next: "nationality", scoring: { overall: -10, risk: +15 } }
        ]
    },

    resident_years: {
        question: "Сколько полных лет вы непрерывно проживаете в Польше?",
        subtitle: "Для получения статуса Резидента ЕС закон требует минимум 5 лет непрерывного легального пребывания.",
        type: "options",
        options: [
            { id: "res_5y_ok", label: "5 лет и более", next: "resident_basis", scoring: { residenceContinuity: +20, stabilityScore: +15 } },
            { id: "res_5y_fail", label: "Менее 5 лет", next: "resident_basis", scoring: { overall: -40, risk: +50 } }
        ]
    },

    resident_basis: {
        question: "На каком основании вы находились в Польше большую часть этих 5 лет?",
        subtitle: "Студенческий стаж учитывается Ужондом по особому коэффициенту.",
        type: "options",
        options: [
            { id: "res_base_work", label: "По работе, бизнесу или воссоединению семьи", next: "resident_language", scoring: { stabilityScore: +15, employerReliability: +10 } },
            { id: "res_base_study", label: "В основном по учебе (студенческая карта / виза)", next: "resident_language", scoring: { overall: -20, risk: +30 } }
        ]
    },

    resident_language: {
        question: "Есть ли у вас подтверждение знания польского языка (уровень B1)?",
        subtitle: "Без подтвержденного знания языка подача на статус Резидента ЕС невозможна.",
        type: "options",
        options: [
            { id: "res_lang_cert", label: "Да, гос. сертификат B1 или диплом польского ВУЗа", next: "resident_income_history", scoring: { documentReadiness: +25, overall: +15 } },
            { id: "res_lang_szkola", label: "Да, есть диплом полицеальной школы", next: "resident_income_history", scoring: { documentReadiness: +15, overall: +10 } },
            { id: "res_lang_plan", label: "Пока нет, планирую сдавать гос. экзамен", next: "resident_income_history", scoring: { documentReadiness: -15, risk: +15 } },
            { id: "res_lang_none", label: "Нет и не планирую сдавать", next: "resident_income_history", scoring: { overall: -50, risk: +50 } }
        ]
    },

    resident_income_history: {
        question: "Каков статус вашей занятости и меняли ли вы работу за последние 3 года?",
        subtitle: "Инспектор затребует налоговые декларации (PIT) за последние 3 года для проверки стабильности дохода.",
        type: "options",
        options: [
            { id: "res_inc_stable", label: "Работаю официально, за 3 года работу не менял(а) / без перерывов", next: "nationality", scoring: { incomeQuality: +25, stabilityScore: +20, overall: +15 } },
            { id: "res_inc_gaps", label: "Работаю официально, но часто менял(а) работу, были периоды без дохода", next: "nationality", scoring: { incomeQuality: -15, risk: +20 } },
            { id: "res_inc_nowork", label: "На данный момент официально не работаю", next: "nationality", scoring: { overall: -40, risk: +50, incomeQuality: -30 } }
        ]
    },

    fam_relative_work: {
        question: "Работает ли официально член семьи, к которому вы переезжаете?",
        subtitle: "Наличие стабильного источника дохода у принимающей стороны — обязательное условие для воссоединения.",
        type: "options",
        options: [
            { id: "f_work_yes", label: "💼 Да, работает по найму (Umowa o pracę / Zlecenie)", next: "fam_relative_status", scoring: { incomeQuality: +15 } },
            { id: "f_work_biz", label: "🏢 Да, ведет свой бизнес (JDG / Sp. z o.o.)", next: "fam_relative_status", scoring: { incomeQuality: +15 } },
            { id: "f_work_no", label: "❌ Нет, не работает / Работает неофициально", next: "fam_relative_status", scoring: { overall: -30, incomeQuality: -30, risk: +8, redFlag: "Без официального дохода принимающей стороны получить карту по воссоединению семьи невозможно." } }
        ]
    },

    fam_relative_status: {
        question: "Какой статус пребывания в Польше у вашего родственника?",
        subtitle: "От статуса принимающей стороны зависят ваши права (например, доступ к рынку труда без дополнительных разрешений).",
        type: "options",
        options: [
            { id: "f_stat_karta", label: "💳 Временный ВНЖ (Karta Pobytu czasowego)", next: "fam_count_input", scoring: { stabilityScore: +10 } },
            { id: "f_stat_blue", label: "🌐 Blue Card / Сталый побыт / Резидент ЕС", next: "fam_count_input", scoring: { immigrationTrust: +15, stabilityScore: +15, overall: +10 } },
            { id: "f_stat_pl", label: "🇵🇱 Гражданство Польши (Паспорт)", next: "fam_count_input", scoring: { immigrationTrust: +25, overall: +15 } },
            { id: "f_stat_visa", label: "⏳ Национальная виза / Печать (ждет решения)", next: "fam_count_input", scoring: { risk: +5, redFlag: "Воссоединение семьи обычно требует, чтобы родственник уже имел вид на жительство (Карту Побыту) или национальный статус." } }
        ]
    },

    fam_count_input: {
        question: "Сколько членов семьи будут подаваться на ВНЖ вместе с вами?",
        subtitle: "Укажите количество человек (включая вас и детей), не считая принимающего родственника:",
        type: "input_number",
        placeholder: "Например: 2",
        next: "fam_income_input"
    },

    fam_income_input: {
        question: "Укажите официальный чистый доход вашего родственника в месяц (нетто, на руки):",
        subtitle: "Сумма в PLN, подтвержденная договором, фактурами или налоговой декларацией (PIT):",
        type: "input_number",
        placeholder: "Например: 6000",
        next: "lead_gate"
    },

    cukr_pesel: {
        question: "Каков статус вашего PESEL UKR на сегодняшний день?",
        subtitle: "Карта CUKR доступна только лицам, имеющим активный статус временной защиты.",
        type: "options",
        options: [
            { id: "c_pesel_active", label: "🟢 Активен, нарушений и сбоев не было", next: "cukr_exits", scoring: { immigrationTrust: +15, stabilityScore: +10 } },
            { id: "c_pesel_restored", label: "🟡 Был аннулирован, но я его официально восстановил(а)", next: "cukr_exits", scoring: { risk: +2 } },
            { id: "c_pesel_lost", label: "🔴 Статус утрачен / база показывает обычный PESEL", next: "cukr_exits", scoring: { overall: -30, risk: +10, redFlag: "Карта CUKR невозможна без активного статуса временной защиты (обязательно наличие отметки UKR)." } }
        ]
    },

    cukr_exits: {
        question: "Выезжали ли вы за пределы Польши на срок более 30 дней за один выезд?",
        subtitle: "Однократный выезд из Польши более чем на 30 дней автоматически аннулирует статус временной защиты по закону.",
        type: "options",
        options: [
            { id: "c_exits_none", label: "❌ Нет, не выезжал(а) или выезды были короткими (<30 дней)", next: "cukr_income", scoring: { residenceContinuity: +20, overall: +10 } },
            { id: "c_exits_long", label: "⚠️ Да, был минимум один выезд дольше чем на 30 дней", next: "cukr_income", scoring: { overall: -25, risk: +8, residenceContinuity: -30, redFlag: "Выезд из Польши >30 дней прерывает легальность пребывания для CUKR и требует полного обнуления/восстановления статуса." } }
        ]
    },

    cukr_income: {
        question: "Есть ли у вас официальный источник дохода в Польше на данный момент?",
        subtitle: "Закон требует ведения стабильной экономической или трудовой деятельности на день подачи заявления.",
        type: "options",
        options: [
            { id: "c_inc_work", label: "💼 Да, официально работаю (Umowa o pracę / Zlecenie)", next: "cukr_zus", scoring: { incomeQuality: +15 } },
            { id: "c_inc_jdg", label: "🏢 Да, веду бизнес (ИП / JDG / Sp. z o.o.)", next: "cukr_zus", scoring: { incomeQuality: +20 } },
            { id: "c_inc_none", label: "❌ Нет официального дохода / Работаю неофициально", next: "cukr_zus", scoring: { overall: -20, incomeQuality: -30, risk: +6, redFlag: "Отсутствие официального дохода на момент подачи — прямое основание для отказа в карте CUKR." } }
        ]
    },

    cukr_zus: {
        question: "Своевременно ли отчисляются за вас взносы в ZUS (страхование)?",
        type: "options",
        options: [
            { id: "c_zus_ok", label: "Да, работодатель / бухгалтер всё оплачивает, долгов нет", next: "lead_gate", scoring: { documentReadiness: +20, immigrationTrust: +10 } },
            { id: "c_zus_no", label: "Взносы не платятся / есть задолженность по налогам", next: "lead_gate", scoring: { overall: -25, risk: +8, redFlag: "Задолженность перед ZUS или налоговой (US) заблокирует одобрение карты CUKR." } },
            { id: "c_zus_unknown", label: "Не знаю / Не проверял(а) выписку", next: "lead_gate", scoring: { risk: +2 } }
        ]
    },

    work_contract_type: {
        question: "По какому типу договора вы работаете?",
        subtitle: "Тип договора напрямую влияет на стабильность кейса и требования к документам.",
        type: "options",
        options: [
            { id: "w_umowa_prace", label: "💼 Umowa o pracę (Трудовой договор)", next: "work_salary", scoring: { incomeQuality: +20, stabilityScore: +10 } },
            { id: "w_umowa_zlecenie", label: "📋 Umowa Zlecenie (Договор подряда)", next: "work_salary", scoring: { incomeQuality: +5 } },
            { id: "w_b2b_jdg", label: "🏢 B2B контракт (своё ИП / JDG)", next: "jdg_path", scoring: { incomeQuality: +10 } }, 
            { id: "w_agency", label: "🏭 Работаю через агенцию (Agencja Pracy)", next: "work_salary", scoring: { employerReliability: -15, risk: +3, redFlag: "Работа через агенцию требует дополнительных договоров (umowa outsourcingowa), что усложняет проверку ужондом." } },
            { id: "w_no_contract", label: "❌ Пока нет договора / Ищу работу", next: "work_legal_status", scoring: { overall: -20, incomeQuality: -30, risk: +5, redFlag: "Для подачи по работе необходимо иметь активный договор." } }
        ]
    },

    work_salary: {
        question: "Какова ваша официальная зарплата брутто в месяц?",
        subtitle: "С 2026 года минимальная зарплата в Польше составляет 4 666 PLN brutto.",
        type: "options",
        options: [
            { id: "ws_high", label: "Более 7 000 PLN brutto (Высокая)", next: "work_zus", scoring: { incomeQuality: +20, overall: +10 } },
            { id: "ws_mid", label: "От 4 666 до 7 000 PLN brutto", next: "work_zus", scoring: { incomeQuality: +10 } },
            { id: "ws_min", label: "Ровно минималка (4 666 PLN)", next: "work_zus", scoring: { incomeQuality: 0 } },
            { id: "ws_low", label: "Ниже 4 666 PLN / Часть ставки", next: "work_zus", scoring: { incomeQuality: -20, overall: -15, risk: +5, redFlag: "Официальная ЗП ниже минимальной (4666 PLN) — гарантированный отказ, если это единственный источник дохода." } }
        ]
    },

    work_zus: {
        question: "Оплачивает ли работодатель за вас налоги и взносы ZUS?",
        type: "options",
        options: [
            { id: "wz_yes", label: "Да, всё оплачивается официально", next: "work_employer_size", scoring: { immigrationTrust: +15, documentReadiness: +10 } },
            { id: "wz_student", label: "Я студент до 26 лет (ZUS не платится по закону)", next: "work_employer_size", scoring: { documentReadiness: +10 } },
            { id: "wz_no", label: "Нет, получаю часть денег «в конверте»", next: "work_employer_size", scoring: { overall: -30, risk: +8, immigrationTrust: -20, redFlag: "КРИТИЧНО: Отсутствие отчислений в ZUS делает невозможным получение карты побыту." } },
            { id: "wz_unknown", label: "Не уверен(а) / Не проверял(а)", next: "work_employer_size", scoring: { risk: +3, redFlag: "Рекомендуется проверить статус отчислений через платформу PUE ZUS перед подачей." } }
        ]
    },

    work_employer_size: {
        question: "Насколько крупная компания, в которой вы работаете?",
        subtitle: "Ужонд по-разному проверяет корпорации и мелкий бизнес.",
        type: "options",
        options: [
            { id: "we_big", label: "Крупная компания (более 50 сотрудников)", next: "work_legal_status", scoring: { employerReliability: +20 } },
            { id: "we_mid", label: "Средний или малый бизнес (есть офис и сайт)", next: "work_legal_status", scoring: { employerReliability: +10 } },
            { id: "we_micro", label: "Микробизнес (оформлен недавно, 1-2 человека)", next: "work_legal_status", scoring: { employerReliability: -10, risk: +3, redFlag: "Микро-компании часто подвергаются дополнительным проверкам (Wezwanie) на предмет фиктивности." } }
        ]
    },

    work_legal_status: {
        question: "На каком основании вы сейчас находитесь в Польше?",
        subtitle: "Важно подать документы до истечения легального пребывания.",
        type: "options",
        options: [
            { id: "wls_active", label: "Действующая виза / Безвиз / Старая Карта", next: "lead_gate", scoring: { stabilityScore: +15 } },
            { id: "wls_stamp", label: "Уже есть штамп в паспорте (жду решения)", next: "lead_gate", scoring: { stabilityScore: +5 } },
            { id: "wls_illegal", label: "Документы просрочены", next: "lead_gate", scoring: { overall: -30, risk: +10, redFlag: "Подача с просроченными документами требует специальной юридической процедуры (przywrócenie terminu)." } }
        ]
    },

   urzad_location: {
        question: "В какой воеводский ужонд подано ваше дело?",
        type: "options",
        options: [
            { id: "urzad_mazowiecki", label: "Мазовецкое (Варшава)", next: "main_goal", scoring: {}, expected_wait: 12 },
            { id: "urzad_dolnoslaski", label: "Нижнесилезское (Вроцлав)", next: "main_goal", scoring: { risk: +1 }, expected_wait: 16 },
            { id: "urzad_wielkopolskie", label: "Великопольское (Познань)", next: "main_goal", scoring: { risk: +1 }, expected_wait: 11 },
            { id: "urzad_opolskie", label: "Опольское (Ополе)", next: "main_goal", scoring: { risk: +2 }, expected_wait: 19 },
            { id: "urzad_pomorskie", label: "Поморское (Гданьск)", next: "main_goal", scoring: {}, expected_wait: 10 },
            { id: "urzad_slaskie", label: "Силезское (Катовице)", next: "main_goal", scoring: {}, expected_wait: 9 },
            { id: "urzad_malopolskie", label: "Малопольское (Краков)", next: "main_goal", scoring: {}, expected_wait: 5 },
            { id: "urzad_lodzkie", label: "Лодзинское (Лодзь)", next: "main_goal", scoring: {}, expected_wait: 7 },
            { id: "urzad_zachodniopomorskie", label: "Западнопоморское (Щецин)", next: "main_goal", scoring: {}, expected_wait: 9 },
            { id: "urzad_lubelskie", label: "Люблинское (Люблин)", next: "main_goal", scoring: {}, expected_wait: 5 },
            { id: "urzad_podkarpackie", label: "Подкарпатское (Жешув)", next: "main_goal", scoring: {}, expected_wait: 6 },
            { id: "urzad_kujawskopomorskie", label: "Куявско-Поморское (Быдгощ / Торунь)", next: "main_goal", scoring: {}, expected_wait: 7 },
            { id: "urzad_podlaskie", label: "Подляское (Белосток)", next: "main_goal", scoring: {}, expected_wait: 6 },
            { id: "urzad_lubuskie", label: "Любушское (Гожув / Зелёна-Гура)", next: "main_goal", scoring: {}, expected_wait: 8 },
            { id: "urzad_warminskomazurskie", label: "Варминско-Мазурское (Ольштын)", next: "main_goal", scoring: {}, expected_wait: 6 },
            { id: "urzad_swietokrzyskie", label: "Свентокшиское (Кельце)", next: "main_goal", scoring: {}, expected_wait: 4 }
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

    doc_expiry_days: {
        question: "Сколько дней осталось до истечения вашего документа?",
        subtitle: "Введите точное количество дней. Система рассчитает крайний срок подачи и предупредит о рисках.",
        type: "input_number",
        placeholder: "Например: 45",
        next: "employment_basis"
    },

    stay_basis: {
        question: "На каком основании вы сейчас находитесь в Польше?",
        subtitle: "Ваш текущий правовой статус — ключевой параметр оценки.",
        type: "options",
        options: [
            { id: "visa_d_work", label: "Рабочая виза D (зарплатная / для высококвал.)", next: "doc_expiry_days", scoring: { overall: +5 } },
            { id: "visa_d_other", label: "Национальная виза D (другое основание)", next: "doc_expiry_days", scoring: {} },
            { id: "bezwiz", label: "Безвизовый режим (биометрический паспорт)", next: "bezwiz_days", scoring: { risk: +2 } },
            { id: "stamp", label: "Штамп в паспорте (ожидаю решения по заявке)", next: "stamp_details", scoring: { stabilityScore: +5 } },
            { id: "karta_active", label: "Действующая Карта Побыту", next: "doc_expiry_days", scoring: { overall: +10, stabilityScore: +10 } },
            { id: "student_visa", label: "Студенческая виза / разрешение на обучение", next: "doc_expiry_days", scoring: {} },
            { id: "expired_docs", label: "Документы просрочены / нет легального основания", next: "overstay_details", scoring: { overall: -25, risk: +10, immigrationTrust: -20, redFlag: "КРИТИЧНО: Незаконное пребывание — угроза депортации и запрета въезда" } },
        ]
    },

    pesel_status: {
        question: "Есть ли у вас PESEL и meldуnek (регистрация по адресу)?",
        type: "options",
        options: [
            { id: "pesel_meldunek", label: "Есть PESEL и meldunek по текущему адресу", next: "employment_basis", scoring: { documentReadiness: +15 } },
            { id: "pesel_no_meld", label: "PESEL есть, но meldunek отсутствует или устарел", next: "employment_basis", scoring: { documentReadiness: -10, risk: +2, redFlag: "Отсутствие meldunku при подаче — частая причина wezwanie" } },
            { id: "no_pesel", label: "PESEL нет", next: "employment_basis", scoring: { documentReadiness: -20, risk: +3, redFlag: "Без PESEL подача документов значительно усложнена" } },
        ]
    },

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

    jdg_path: {
        question: "Детали вашего бизнеса (JDG / Sp. z o.o.):",
        type: "options",
        options: [
            { id: "jdg_real_revenue", label: "Стабильные обороты, польские клиенты, есть фактуры", next: "work_legal_status", scoring: { incomeQuality: +15, employerReliability: +10 } },
            { id: "jdg_b2b_one", label: "Один клиент (B2B с одной компанией)", next: "work_legal_status", scoring: { risk: +4, incomeQuality: 0, redFlag: "JDG с одним клиентом — риск переквалификации в фиктивный бизнес" } },
            { id: "jdg_new", label: "Бизнес открыт менее 6 месяцев назад", next: "work_legal_status", scoring: { incomeQuality: -10, risk: +4, redFlag: "JDG <6 мес. — нет истории доходов, стабильность неочевидна" } },
            { id: "jdg_low_revenue", label: "Обороты минимальные или нестабильные", next: "work_legal_status", scoring: { incomeQuality: -20, overall: -10, risk: +5, redFlag: "Низкий оборот JDG — ужонд может счесть бизнес нежизнеспособным" } },
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

    eu_path: {
        question: "Вы гражданин ЕС — ваш путь значительно проще.",
        subtitle: "Для граждан ЕС доступна упрощённая регистрация без karta pobytu.",
        type: "options",
        options: [
            { id: "eu_register", label: "Хочу зарегистрировать пребывание (zaświadczenie)", next: "previous_refusals", scoring: { overall: +30 } },
            { id: "eu_family_non_eu", label: "Хочу легализовать члена семьи — не гражданина ЕС", next: "family_path", scoring: { overall: +15 } },
        ]
    },

    no_income_path: {
        question: "Есть ли у вас другие подтверждённые источники средств к существованию?",
        type: "options",
        options: [
            { id: "ni_savings", label: "Собственные накопления на счёте польского банка (от 30 000 PLN)", next: "previous_refusals", scoring: { overall: +5, incomeQuality: +10 } },
            { id: "ni_family_support", label: "Финансовое обеспечение от члена семьи в Польше", next: "previous_refusals", scoring: { incomeQuality: 0 } },
            { id: "ni_nothing", label: "Нет ни доходов, ни накоплений в Польше", next: "previous_refusals", scoring: { overall: -30, risk: +8, redFlag: "КРИТИЧНО: Полное отсутствие средств — подача невозможна без срочной корректировки ситуации" } },
        ]
    },

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

    lead_gate: {
        type: "lead_gate",
        question: "Анализ готов на 95%",
        subtitle: "Введите ваши контакты, чтобы получить полный персональный отчёт с рекомендациями."
    },

    ai_analysis: {
        type: "ai_result"
    }
};

// ─── 3. PROGRESS TRACKER ────────────────────────────────────

function getDynamicTotalSteps() {
    const answers = AnalyzerState.answers;
    let total = 8; 

    if (answers['main_goal']) {
        const goal = answers['main_goal'].value;
        if (goal === 'goal_speedup') total = 7;
        else if (goal === 'goal_cukr') total = 7;
        else if (goal === 'goal_family') total = 7;
        else if (goal === 'goal_work') {
            total = 8; 
            if (answers['work_contract_type']) {
                const contract = answers['work_contract_type'].value;
                if (contract === 'w_no_contract') total = 5; 
                else if (contract === 'w_b2b_jdg') total = 7; 
            }
        }
    }
    
    const actualSteps = Math.max(AnalyzerState.history.length, 1);
    return Math.max(total, actualSteps);
}

function updateProgress(stepIndex) {
    const progressContainer = document.getElementById('analyzer-progress');
    const progressFill = document.getElementById('progress-fill');
    const stepCurrent = document.getElementById('step-current');
    const stepTotal = document.getElementById('step-total');
    if (!progressContainer || !progressFill) return;
    
    const currentTotal = getDynamicTotalSteps();
    const current = Math.min(currentTotal, stepIndex + 1);
    
    const pct = Math.min(95, Math.round((current / currentTotal) * 100));
    
    progressFill.style.width = pct + '%';
    if (stepCurrent) stepCurrent.textContent = current;
    if (stepTotal) stepTotal.textContent = currentTotal;
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

    if (step.type === 'lead_gate') {
        const progressFill = document.getElementById('progress-fill');
        const stepCurrent = document.getElementById('step-current');
        const stepTotal = document.getElementById('step-total'); 
        
        const total = getDynamicTotalSteps();
        
        if (progressFill) progressFill.style.width = '95%';
        if (stepCurrent) stepCurrent.textContent = total; 
        if (stepTotal) stepTotal.textContent = total; 
    } else if (step.type !== 'ai_result') {
        updateProgress(AnalyzerState.history.length - 1);
    }

    setTimeout(() => {
        if (step.type === 'lead_gate') {
            container.innerHTML = buildLeadGate();
            bindLeadGateEvents();
        } else if (step.type === 'ai_result') {
            container.innerHTML = buildLoadingScreen();
            animateLoadingSteps();
            runAIAnalysis();
        } else if (step.type === 'input_number') {
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

            AnalyzerState.addAnswer(stepId, optionId, label, selectedOpt.scoring);

            // Если человек уже подан, автоматически симулируем выбор цели "Ускорение дела"
            // Это позволит всем остальным функциям корректно распознавать и собирать speedup-сценарий
            if (stepId === 'start_status' && optionId === 'status_submitted') {
                AnalyzerState.answers['main_goal'] = { 
                    value: 'goal_speedup', 
                    label: 'Ускорение вашего дела', 
                    delta: { stabilityScore: +10 } 
                };
            }

            document.querySelectorAll('.analyzer-option-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            let nextStep = selectedOpt.next;
            
            if (stepId === 'urzad_location') {
                const goal = AnalyzerState.answers['main_goal']?.value;
                if (goal === 'goal_work') nextStep = 'work_contract_type';
                else if (goal === 'goal_cukr') nextStep = 'cukr_pesel';
                else if (goal === 'goal_family') nextStep = 'fam_relative_work';
                else if (goal === 'goal_speedup') nextStep = 'waiting_time_input';
                // Новые типы планирования направляем в общую ветку проверки базовых критериев (гражданство/основания)
                else if (goal === 'goal_staly') nextStep = 'staly_basis';
                else if (goal === 'goal_resident') nextStep = 'resident_years';
            }

            setTimeout(() => renderStep(nextStep), 200);
        });
    });

    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            AnalyzerState.history.pop(); 
            const prev = AnalyzerState.history.pop(); 
            
            AnalyzerState.rollbackAnswer(prev); 
            
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
        let displayTime = 4000; 
        
        if (stepId === 'waiting_time_input') {
            const urzadId = AnalyzerState.answers['urzad_location']?.value;
            const urzadOpt = FLOW['urzad_location'].options.find(o => o.id === urzadId);
            const expectedWait = urzadOpt ? urzadOpt.expected_wait : 10;
            
            if (val >= expectedWait) {
                AnalyzerState.redFlags.push(`Сроки нарушены: ожидание ${val} мес. (среднее ${expectedWait} мес.)`);
                AnalyzerState.applyScoring({ risk: +4, stabilityScore: -10 });
                alertBox.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                alertBox.style.color = '#ef4444';
                alertBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                warningText = `⚠️ <strong>Обнаружено нарушение сроков!</strong><br><br>Среднее время ожидания в вашем ужонде — ${expectedWait} мес. Вы ждете уже ${val} мес. Вам необходимо срочно подавать официальное Ponaglenie (жалобу на бездействие).`;
            } else {
                const left = expectedWait - val;
                alertBox.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                alertBox.style.color = 'var(--text-color)';
                alertBox.style.borderColor = 'var(--accent-color)';
                warningText = `ℹ️ <strong>В пределах нормы (для 2026 года).</strong><br><br>Среднее время ожидания в выбранном ужонде — ${expectedWait} мес. Примерная дата вашей децизии: через <strong>~${left} мес.</strong>`;
            }
        }
        
        else if (stepId === 'fam_count_input') {
            alertBox.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
            alertBox.style.color = 'var(--text-color)';
            alertBox.style.borderColor = 'var(--accent-color)';
            warningText = `✓ Данные зафиксированы. Переходим к расчету финансового критерия...`;
            displayTime = 1000; 
        }
        
        else if (stepId === 'fam_income_input') {
            const famCount = parseInt(AnalyzerState.answers['fam_count_input']?.value || 0);
            const totalFamilySize = 1 + famCount; 
            const requiredIncome = totalFamilySize * 1300;
            
            if (val >= requiredIncome) {
                AnalyzerState.applyScoring({ incomeQuality: +20, overall: +15 });
                alertBox.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
                alertBox.style.color = 'var(--text-color)';
                alertBox.style.borderColor = 'var(--accent-color)';
                warningText = `ℹ️ <strong>Финансовый критерий выполнен!</strong><br><br>Для вашей семьи из ${totalFamilySize} чел. (включая принимающую сторону) минимальный порог по закону составляет <strong>${requiredIncome} PLN</strong> (расчет: ~700 PLN/чел. на жилье + 600 PLN на жизнь). Доход в ${val} PLN полностью соответствует требованиям ужонда.`;
            } else {
                AnalyzerState.redFlags.push(`Недостаточный доход принимающей стороны: ${val} PLN при норме ${requiredIncome} PLN`);
                AnalyzerState.applyScoring({ incomeQuality: -25, overall: -20, risk: +5 });
                alertBox.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                alertBox.style.color = '#ef4444';
                alertBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                warningText = `⚠️ <strong>Недостаточно официального дохода!</strong><br><br>Для вашей семьи из ${totalFamilySize} чел. минимальный порог составляет <strong>${requiredIncome} PLN</strong> (600 PLN минимум на жизнь + ~700 PLN расходы на жилье за каждого). Текущий официальный доход ${val} PLN ниже нормы. Необходимо увеличить официальную ставку до подачи документов.`;
            }
        }

        else if (stepId === 'doc_expiry_days') {
            AnalyzerState.docExpiryDays = val;

            if (val <= 14) {
                AnalyzerState.applyScoring({ overall: -20, risk: +8,
                    redFlag: `КРИТИЧНО: До истечения документа ${val} дней — срочная подача` });
                alertBox.style.backgroundColor = 'rgba(239,68,68,0.08)';
                alertBox.style.color = '#ef4444';
                alertBox.style.borderColor = 'rgba(239,68,68,0.3)';
                warningText = `🚨 <strong>Критический срок!</strong><br><br>До истечения документа осталось всего <strong>${val} дней</strong>. Необходимо подавать документы немедленно — каждый день на счету.`;
            } else if (val <= 45) {
                AnalyzerState.applyScoring({ risk: +4,
                    redFlag: `Документ истекает через ${val} дней — подача срочная` });
                alertBox.style.backgroundColor = 'rgba(245,158,11,0.08)';
                alertBox.style.color = '#f59e0b';
                alertBox.style.borderColor = 'rgba(245,158,11,0.3)';
                warningText = `⚠️ <strong>Время поджимает.</strong><br><br>До истечения документа <strong>${val} дней</strong>. Оптимальное окно для подачи — ближайшие 2 недели. Учтём это в финальном расчёте.`;
            } else if (val <= 90) {
                alertBox.style.backgroundColor = 'rgba(16,185,129,0.08)';
                alertBox.style.color = 'var(--text-color)';
                alertBox.style.borderColor = 'var(--accent-color)';
                warningText = `✓ <strong>Запас есть.</strong><br><br>До истечения <strong>${val} дней</strong>. Рекомендуем подавать не позже чем за 30 дней до окончания. Продолжаем анализ.`;
            } else {
                alertBox.style.backgroundColor = 'rgba(16,185,129,0.08)';
                alertBox.style.color = 'var(--text-color)';
                alertBox.style.borderColor = 'var(--accent-color)';
                warningText = `✓ <strong>Времени достаточно.</strong><br><br>До истечения документа <strong>${val} дней</strong>. Данные зафиксированы — в финальном отчёте покажем точный дедлайн подачи.`;
            }
            displayTime = 2200;
        }
        
        let inputLabel = `${val}`;
        if (stepId === 'fam_income_input') inputLabel = `${val} PLN`;
        else if (stepId === 'fam_count_input') inputLabel = `${val} чел.`;
        else if (stepId === 'waiting_time_input') inputLabel = `${val} мес.`;
        else if (stepId === 'doc_expiry_days') inputLabel = `${val} дней`;
        AnalyzerState.answers[stepId] = { value: val, label: inputLabel };
        
        alertBox.innerHTML = warningText;
        alertBox.classList.remove('hidden');
        btnNext.style.display = 'none'; 
        input.disabled = true; 
        
        setTimeout(() => {
            renderStep(step.next);
        }, displayTime);
    });

    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            AnalyzerState.history.pop(); 
            const prev = AnalyzerState.history.pop(); 
            
            AnalyzerState.rollbackAnswer(prev);
            
            if (prev) renderStep(prev);
        });
    }
}

function buildLeadGate() {
    const score = AnalyzerState.getFinalScore();
    const riskCount = AnalyzerState.redFlags.length;
    const urzad = AnalyzerState.answers['urzad_location']?.label || 'вашем воеводстве';

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

            <div class="lead-gate-benefits" style="background: var(--bg-color); padding: 1rem; border-radius: 4px; margin-bottom: 1.5rem; text-align: left; border-left: 3px solid var(--accent-color);">
                <p style="font-size: 0.95rem; font-weight: 600; margin-bottom: 0.5rem;">Оставьте контакты, чтобы <span style="color: var(--accent-color);">моментально открыть</span> на следующем экране:</p>
                <ul style="font-size: 0.85rem; color: var(--text-muted); padding-left: 1.2rem; margin-bottom: 0.8rem;">
                    <li>Детальный разбор ваших красных флагов</li>
                    <li>Точные сроки рассмотрения дела в <b>${urzad}</b> воеводстве</li>
                    <li>Пошаговый план действий под ваш кейс</li>
                </ul>
                <div style="font-size: 0.8rem; color: var(--text-color); display: flex; align-items: center; gap: 5px;">
                    <span style="color: #f59e0b;">★★★★★</span> 4.9/5 оценка клиентов
                </div>
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
                
                <p class="lead-privacy-note" style="display: flex; align-items: flex-start; gap: 0.5rem; margin-top: 0.5rem;">
                    <span style="font-size: 1rem; color: var(--accent-color);">🔒</span>
                    <span>Мы гарантируем конфиденциальность. <b>Результат откроется сразу на этой странице.</b> Контакты нужны для отправки копии отчета и на случай, если вам понадобится помощь специалиста.</span>
                </p>
                
                <button type="submit" class="btn-solid" id="btn-lead-submit" style="width:100%;justify-content:center; margin-top: 0.5rem;">
                    Открыть полный анализ прямо сейчас →
                </button>
            </form>
        </div>
    `;
}

function bindLeadGateEvents() {
    const form = document.getElementById('analyzer-lead-form');
    if (!form) return;
    const phoneRegex = /^\+?[0-9\s\-\(\)]{9,15}$/;

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

        if (typeof fbq === 'function') {
            fbq('track', 'Lead', { content_name: 'Analyzer Completed' });
        }

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
    }, 900);
}

function runAIAnalysis() {
    const score = AnalyzerState.getFinalScore();
    setTimeout(() => {
        renderFinalResults(null, score);
    }, 4 * 900 + 200);
}

// ─── 7. RESULTS SCREEN ────────────────────────────────────

// ── Цены жёстко зафиксированы по требованию ──
//   • Карта побыта (стандарт): 1300 PLN  (300 PLN аванс + 1000 PLN после подачи)
//   • Ускорение (goal_speedup): 500 PLN  (только ускорение — Ponaglenie)
// ── Цены в зависимости от типа дела ──
function calcPrice(goal) {
    if (goal === 'goal_speedup') return 500;
    if (goal === 'goal_staly' || goal === 'goal_resident') return 1600;
    return 1300;
}

function renderFinalResults(analysis, originalScore) {
    const container = document.getElementById('question-container');
    const progressContainer = document.getElementById('analyzer-progress');

    let score = originalScore;
    let criticalRiskMessage = null;
    const answers = AnalyzerState.answers;
    
    const goal = answers['main_goal']?.value;
    const contract = answers['work_contract_type']?.value;
    const cukrIncome = answers['cukr_income']?.value;
    const famWork = answers['fam_relative_work']?.value;

    const stalyBasis = answers['staly_basis']?.value;
    const stalyMarriage = answers['staly_marriage_dates']?.value;

    const resYears = answers['resident_years']?.value;
    const resBasis = answers['resident_basis']?.value;
    const resLang = answers['resident_language']?.value;
    const resInc = answers['resident_income_history']?.value;

    if (goal === 'goal_work' && contract === 'w_no_contract') {
        score = Math.min(score, 15);
        criticalRiskMessage = "Вы выбрали ВНЖ по работе, но у вас пока нет официального контракта. Без Umowa o pracę, Zlecenie или B2B Ужонд выдаст 100% отказ. Сначала необходимо легализовать ваш доход.";
    }
    else if (goal === 'goal_cukr' && cukrIncome === 'c_inc_none') {
        score = Math.min(score, 15);
        criticalRiskMessage = "По закону для карты CUKR строго обязательно иметь официальный источник дохода в Польше на момент подачи. У вас его нет, поэтому шансы на одобрение минимальны.";
    }
    else if (goal === 'goal_family' && famWork === 'f_work_no') {
        score = Math.min(score, 10);
        criticalRiskMessage = "Для воссоединения семьи принимающий родственник обязан иметь стабильный официальный доход в Польше. Без подтвержденного дохода Ужонд не одобрит вам Карту Побыту.";
    }
    else if (goal === 'goal_staly' && stalyBasis === 'staly_long_residence') {
        score = Math.min(score, 15);
        criticalRiskMessage = "Запрос Сталого Побыта на основании 5 лет проживания не предусмотрен законом. Данный критерий подходит исключительно для получения статуса долгосрочного резидента ЕС. Вам нужно изменить программу подачи.";
    }
    else if (goal === 'goal_staly' && stalyBasis === 'staly_marriage' && stalyMarriage === 'staly_m_fail') {
        score = Math.min(score, 10);
        criticalRiskMessage = "Не соблюдены временные рамки. Для получения Сталого Побыта по браку ваш союз должен длиться не менее 3 лет, и как минимум 2 года из них вы обязаны непрерывно находиться в Польше по текущему ВНЖ.";
    }

    else if (goal === 'goal_staly' && stalyBasis === 'staly_marriage' && stalyMarriage === 'staly_m_fail') {
        score = Math.min(score, 10);
        criticalRiskMessage = "Не соблюдены временные рамки. Для получения Сталого Побыта по браку ваш союз должен длиться не менее 3 лет, и как минимум 2 года из них вы обязаны непрерывно находиться в Польше по текущему ВНЖ.";
    }

    // ── СТОП-ФАКТОРЫ ДЛЯ РЕЗИДЕНТА ЕС ──
    else if (goal === 'goal_resident' && resYears === 'res_5y_fail') {
        score = Math.min(score, 10);
        criticalRiskMessage = "Закон требует минимум 5 лет непрерывного пребывания в Польше для статуса Резидента ЕС. На данный момент вам нужно подаваться на обычный временный вид на жительство (Karta Czasowego Pobytu).";
    }
    else if (goal === 'goal_resident' && resLang === 'res_lang_none') {
        score = Math.min(score, 5);
        criticalRiskMessage = "Без государственного сертификата владения польским языком на уровне B1 (или польского диплома) статус Резидента ЕС получить невозможно. Это абсолютное требование закона.";
    }
    else if (goal === 'goal_resident' && resInc === 'res_inc_nowork') {
        score = Math.min(score, 15);
        criticalRiskMessage = "На момент подачи заявления на Резидента ЕС у вас должен быть стабильный и регулярный источник дохода (действующий контракт). Сейчас подача приведет к отказу.";
    }

    if (stalyBasis === 'staly_long_residence' && !AnalyzerState.redFlags.includes("Неверно выбран тип постоянного вида на жительство (требуется Резидент ЕС)")) {
        AnalyzerState.redFlags.push("Неверно выбран тип постоянного вида на жительство (требуется Резидент ЕС)");
    }
    if (stalyMarriage === 'staly_m_fail' && !AnalyzerState.redFlags.includes("Недостаточный срок нахождения в браке или проживания по ВНЖ")) {
        AnalyzerState.redFlags.push("Недостаточный срок нахождения в браке или проживания по ВНЖ");
    }
    if (answers['staly_integration']?.value === 'staly_int_no' && !AnalyzerState.redFlags.includes("Слабая экономическая/социальная интеграция (риск признания фиктивного намерения селиться)")) {
        AnalyzerState.redFlags.push("Слабая экономическая/социальная интеграция (риск признания фиктивного намерения селиться)");
    }
    // ── КРАСНЫЕ ФЛАГИ ДЛЯ РЕЗИДЕНТА ЕС ──
    if (resBasis === 'res_base_study' && !AnalyzerState.redFlags.includes("Срок пребывания по учебе засчитывается только на 50%")) {
        AnalyzerState.redFlags.push("Срок пребывания по учебе засчитывается только на 50%");
    }
    if (resLang === 'res_lang_szkola' && !AnalyzerState.redFlags.includes("Диплом полицеальной школы принимается только до сентября")) {
        AnalyzerState.redFlags.push("Диплом полицеальной школы принимается только до сентября");
    }
    if (resLang === 'res_lang_plan' && !AnalyzerState.redFlags.includes("Подача документов невозможна до получения сертификата B1")) {
        AnalyzerState.redFlags.push("Подача документов невозможна до получения сертификата B1");
    }
    if (resInc === 'res_inc_gaps' && !AnalyzerState.redFlags.includes("Перерывы в трудоустройстве: Ужонд будет детально изучать PIT-ы за 3 года")) {
        AnalyzerState.redFlags.push("Перерывы в трудоустройстве: Ужонд будет детально изучать PIT-ы за 3 года");
    }

    const name = AnalyzerState.contactInfo.name || 'Клиент';
    const scoreClass = getScoreClass(score); 
    const redFlags = AnalyzerState.redFlags;
    
    const isSpeedupPath = goal === 'goal_speedup';
    const isStalyOrResident = goal === 'goal_staly' || goal === 'goal_resident';
    const basePrice = calcPrice(goal);

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
        timeline: "до 35 дней",
        doc_checklist: ["Внёсек со штампом", "Все Wezwanie", "Оплата пошлины", "Хронология"],
        closing_advice: "Дела с жалобами рассматриваются в приоритетном порядке."
    };

    const a = analysis || (isSpeedupPath ? fallbackSpeedup : fallbackDefault);

    const urzadId = answers['urzad_location']?.value;
    if (urzadId && FLOW['urzad_location']) {
        const urzadOpt = FLOW['urzad_location'].options.find(o => o.id === urzadId);
        if (isSpeedupPath) {
            a.timeline = "до 35 дней";
        } else if (urzadOpt && urzadOpt.expected_wait) {
            const minWait = urzadOpt.expected_wait;
            const maxWait = minWait + 3;
            a.timeline = `${minWait}–${maxWait} мес.`;
        }
    } else if (isSpeedupPath) {
        a.timeline = "до 35 дней";
    }

    AnalyzerState.finalPrice = basePrice;
    AnalyzerState.finalTimeline = a.timeline;

    const MAKE_WEBHOOK_URL = 'https://hook.eu1.make.com/58m3066jyr2wr7pm5g6ql6zvb2utponu';

    let answersLog = `🎯 РЕЗУЛЬТАТ АНАЛИЗА: ${score} баллов\n`;
    if (criticalRiskMessage) answersLog += `🚨 СРАБОТАЛ СТОП-ФАКТОР: ${criticalRiskMessage}\n`;
    answersLog += `-----------------------------------\n\n`;
    
    if (AnalyzerState.history && AnalyzerState.history.length > 0) {
        AnalyzerState.history.forEach((stepId, index) => {
            const step = FLOW[stepId];
            if (step && step.type !== 'onboarding' && step.type !== 'lead_gate' && step.question) {
                let answerText = AnalyzerState.answers[stepId] ? AnalyzerState.answers[stepId].label : 'Нет данных';
                answersLog += `❓ ${step.question}\n👉 ${answerText}\n\n`;
            }
        });
    }

    fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: AnalyzerState.contactInfo.name || 'Без имени',
            phone: AnalyzerState.contactInfo.phone || 'Без телефона',
            telegram: AnalyzerState.contactInfo.telegram || '',
            service: 'Анализатор ВНЖ (AI)', 
            source: 'analyzer_quiz',       
            comment: answersLog,
            submitted_at: new Date().toISOString(),
            analyzer_score: score,
            analyzer_price: basePrice,       
            analyzer_timeline: a.timeline,   
            downloaded_pdf: false,
        })
    }).then(res => res.json()).then(data => AnalyzerState.notionPageId = data.notion_page_id || null).catch(e => console.error(e));
    
    if (progressContainer) document.getElementById('progress-fill').style.width = '100%';

    const criticalHtml = criticalRiskMessage ? `
        <div class="result-card accent-border" style="border-left-color: #EF4444; background-color: rgba(239, 68, 68, 0.05); margin-bottom: 1.5rem;">
            <div class="result-card-header"><span class="result-card-label" style="color: #EF4444;">🚨 Критический риск отказа</span></div>
            <p class="result-card-text" style="color: #EF4444; font-weight: 500;">${criticalRiskMessage}</p>
        </div>` : '';

    container.classList.add('hidden');
    setTimeout(() => {

        let priceCtaHtml = '';
        
        if (isSpeedupPath) {
            priceCtaHtml = `
            <div class="dash-price-cta">
                <div class="dpc-price-col">
                    <span class="dpc-label">Ускорение (Ponaglenie)</span>
                    <div class="dpc-value">500 <span class="dpc-currency">PLN</span></div>
                    <span class="dpc-hint">Срок: <strong>до 35 дней</strong></span>
                </div>
                <div class="dpc-cta-col">
                    <a href="https://t.me/residia_consulting" target="_blank" class="btn-solid df-btn">🚀 Ускорить дело →</a>
                    <p class="fomo-response-hint">⚡ Ответим за 12 минут · 47 человек за неделю с нами</p>
                    <div class="dpc-secondary">
                        <button class="btn-outline df-btn-sec" id="btn-transfer-case">👨‍💼 Передать мой кейс специалисту</button>
                    </div>
                </div>
            </div>`;
        } else if (isStalyOrResident) {
            priceCtaHtml = `
            <div class="dash-price-cta">
                <div class="dpc-price-col">
                    <span class="dpc-label">Сталый побыт / Резидент ЕС</span>
                    <div class="dpc-value">1600 <span class="dpc-currency">PLN</span></div>
                    <span class="dpc-hint"><strong>600 PLN</strong> — аванс &nbsp;·&nbsp; <strong>1000 PLN</strong> — после подачи</span>
                </div>
                <div class="dpc-cta-col">
                    <a href="https://t.me/residia_consulting" target="_blank" class="btn-solid df-btn">📋 Разобрать кейс бесплатно →</a>
                    <p class="fomo-response-hint">⚡ Ответим за 12 минут · 47 человек за неделю с нами</p>
                    <div class="dpc-secondary">
                        <button class="btn-outline df-btn-sec" id="btn-transfer-case">👨‍💼 Передать мой кейс специалисту</button>
                    </div>
                </div>
            </div>`;
        } else {
            priceCtaHtml = `
            <div class="dash-price-cta">
                <div class="dpc-price-col">
                    <span class="dpc-label">Сопровождение под ключ</span>
                    <div class="dpc-value">1300 <span class="dpc-currency">PLN</span></div>
                    <span class="dpc-hint"><strong>300 PLN</strong> — аванс &nbsp;·&nbsp; <strong>1000 PLN</strong> — после подачи</span>
                </div>
                <div class="dpc-cta-col">
                    <a href="https://t.me/residia_consulting" target="_blank" class="btn-solid df-btn">📋 Разобрать кейс бесплатно →</a>
                    <p class="fomo-response-hint">⚡ Ответим за 12 минут · 47 человек за неделю с нами</p>
                    <div class="dpc-secondary">
                        <button class="btn-outline df-btn-sec" id="btn-transfer-case">👨‍💼 Передать мой кейс специалисту</button>
                    </div>
                </div>
            </div>`;
        }

        container.innerHTML = `
            <div class="dash-wrapper">
                <div class="dash-header">
                    <div class="dash-badge">${isSpeedupPath ? 'Анализ задержки' : 'Анализ шансов'}</div>
                    <h2 class="dash-title">${name}, ваш экспресс-разбор готов.</h2>
                    <p class="dash-quote">"${a.headline}"</p>
                </div>
                ${criticalHtml}
                <div class="dash-metrics-ribbon">
                    <div class="dm-score dm-${scoreClass}"><span class="dm-score-val">${score}</span><span class="dm-score-lbl">/100</span></div>
                    <div class="dm-divider"></div>
                    <div class="dm-item"><span class="dm-label">${isSpeedupPath ? 'Риск задержки' : 'Риск wezwanie'}</span><span class="dm-val prob-${getProbClass(a.wezwanie_probability)}">${a.wezwanie_probability}</span></div>
                    <div class="dm-item"><span class="dm-label">Риск отказа</span><span class="dm-val prob-${getProbClass(a.refusal_probability)}">${a.refusal_probability}</span></div>
                    <div class="dm-item"><span class="dm-label">Примерные сроки:</span><span class="dm-val text-accent">${a.timeline}</span></div>
                </div>
                ${priceCtaHtml}
                <div class="dash-grid">
                    <div class="dash-card">
                        <h4 class="dc-title">Резюме и стратегия</h4>
                        <p class="dc-text"><strong>Вердикт:</strong> ${a.overall_verdict}</p>
                        <p class="dc-text"><strong>Цель:</strong> ${a.main_basis}</p>
                        <h4 class="dc-title" style="margin-top: 1rem;">Первоочередные шаги</h4>
                        <ul class="dc-list">${a.urgent_actions.map(action => `<li>${action}</li>`).join('')}</ul>
                    </div>
                    <div class="dash-card">
                        <div class="dc-split">
                            <div class="dc-half"><h4 class="dc-title green">✅ Плюсы</h4><ul class="dc-list-small">${a.strengths.map(s => `<li>${s}</li>`).join('')}</ul></div>
                            <div class="dc-half"><h4 class="dc-title red">⚠️ Риски</h4><ul class="dc-list-small">${a.critical_issues.map(i => `<li>${i}</li>`).join('')}</ul></div>
                        </div>
                        ${redFlags.length > 0 ? `<div class="dc-flags">🚩 <strong>Красные флаги:</strong> ${redFlags.join('; ')}</div>` : ''}
                        <h4 class="dc-title" style="margin-top: 1rem;">📁 Документы</h4>
                        <div class="dc-tags">${a.doc_checklist.map(d => `<span class="dc-tag">${d}</span>`).join('')}</div>
                    </div>
                </div>
            </div>
        `;
        
        container.classList.remove('hidden');
        container.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const btnTransfer = document.getElementById('btn-transfer-case');
        if (btnTransfer) {
            btnTransfer.addEventListener('click', () => {
                if (btnTransfer.disabled) return;
                btnTransfer.disabled = true;
                btnTransfer.textContent = '⏳ Отправка...';
                fetch(MAKE_WEBHOOK_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: AnalyzerState.contactInfo.name, phone: AnalyzerState.contactInfo.phone, source: 'analyzer_call_request' })
                }).then(() => {
                    btnTransfer.textContent = '✅ Заявка отправлена';
                    btnTransfer.style.borderColor = 'var(--accent-color)';
                    btnTransfer.style.color = 'var(--accent-color)';
                });
            });
        }
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
    if (score >= 82) return 'Сильный кейс';
    if (score >= 68) return 'Хорошие шансы';
    if (score >= 50) return 'Требует доработки';
    if (score >= 30) return 'Высокий риск';
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

        /* ── Подсказка под главным CTA (под кнопкой, по центру) ── */
        .fomo-response-hint {
            font-size: 0.78rem;
            color: var(--accent-color);
            margin: 0;
            font-weight: 500;
            text-align: center;
            line-height: 1.4;
        }

        /* ── CONSEQUENCES BLOCK ── */
        .consequences-block {
            margin: 1.5rem 0;
            border: 1px solid rgba(239,68,68,0.2);
            border-radius: 8px;
            overflow: hidden;
        }
        .csq-title {
            background: rgba(239,68,68,0.07);
            padding: 0.75rem 1.25rem;
            font-size: 0.85rem;
            font-weight: 700;
            color: #ef4444;
            border-bottom: 1px solid rgba(239,68,68,0.15);
        }
        .csq-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0;
        }
        @media (max-width: 600px) { .csq-grid { grid-template-columns: 1fr; } }
        .csq-item {
            display: flex;
            align-items: flex-start;
            gap: 0.6rem;
            padding: 0.85rem 1.1rem;
            font-size: 0.83rem;
            line-height: 1.45;
            border-bottom: 1px solid rgba(239,68,68,0.08);
            border-right: 1px solid rgba(239,68,68,0.08);
        }
        .csq-item:nth-child(even) { border-right: none; }
        .csq-item:nth-last-child(-n+2) { border-bottom: none; }
        .csq-red { color: var(--text-color); background: rgba(239,68,68,0.03); }
        .csq-orange { color: var(--text-color); background: rgba(245,158,11,0.03); }
        .csq-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }
        
        /* ── МАССИВНЫЙ БЛОК ЦЕНА + CTA (первый после метрик) ── */
        .dash-price-cta {
            display: flex;
            align-items: center;
            gap: 2rem;
            flex-wrap: wrap;
            background: var(--card-bg);
            border: 2px solid var(--text-color);
            border-radius: 8px;
            padding: 1.5rem 1.75rem;
        }
        .dpc-price-col {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
            min-width: 200px;
        }
        .dpc-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            font-weight: 700;
            letter-spacing: 0.05em;
            color: var(--text-muted);
        }
        .dpc-value {
            font-size: 2.6rem;
            font-weight: 800;
            line-height: 1;
            letter-spacing: -0.03em;
            color: var(--text-color);
        }
        .dpc-currency { font-size: 1.3rem; font-weight: 600; color: var(--text-muted); }
        .dpc-hint { font-size: 0.85rem; color: var(--text-muted); line-height: 1.4; }
        .dpc-hint strong { color: var(--text-color); }
        .dpc-cta-col {
            display: flex;
            flex-direction: column;
            gap: 0.6rem;
            flex: 1;
            min-width: 240px;
        }
        .dpc-cta-col .df-btn {
            width: 100%;
            justify-content: center;
            padding: 0.95rem 1rem;
            font-size: 1rem;
            font-weight: 700;
            text-align: center;
        }
        .dpc-secondary {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
            margin-top: 0.2rem;
        }
        .dpc-secondary .df-btn-sec {
            flex: 1;
            min-width: 150px;
            justify-content: center;
            padding: 0.6rem 0.5rem;
            font-size: 0.85rem;
            text-align: center;
            background: transparent;
            color: var(--text-color);
        }
        /* Адаптив: на мобильных всё в колонку, без выхода за экран */
        @media (max-width: 768px) {
            .dash-price-cta { flex-direction: column; align-items: stretch; padding: 1.25rem; }
            .dpc-price-col, .dpc-cta-col { min-width: unset; }
            .dpc-secondary { flex-direction: column; }
            .dpc-secondary .df-btn-sec { min-width: unset; width: 100%; }
        }

        .main-nav a.nav-analyzer {
            color: var(--text-color) !important;
            font-weight: 500 !important;
        }
        .main-nav a.nav-analyzer::before {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

// ─── 10. INIT ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    injectAnalyzerStyles();

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
                typingContainer.innerHTML += '<span class="text-accent fade-in-brand">Residia.</span>';
                
                setTimeout(() => {
                    const cursor = document.querySelector('.typing-cursor');
                    if (cursor) cursor.style.display = 'none';
                }, 1000);
            }
        }
        setTimeout(typeEffect, 300);
    }

    const btnStart = document.getElementById('btn-start-analyzer');
    const stepOnboarding = document.getElementById('step-onboarding');
    const questionContainer = document.getElementById('question-container');
    const progressContainer = document.getElementById('analyzer-progress');

    if (btnStart && stepOnboarding && questionContainer) {
        btnStart.addEventListener('click', () => {
            if (typingTimer) clearTimeout(typingTimer); 

            AnalyzerState.reset();
            
            stepOnboarding.classList.remove('active');
            stepOnboarding.classList.add('hidden');
            
            if (progressContainer) {
                progressContainer.classList.remove('hidden');
            }
            
            questionContainer.classList.remove('hidden');
            
            renderStep('start_status'); 
        });
    }

    // ── Бургер-меню (мобильная навигация) ──
    initBurgerMenu();
});

/**
 * Инициализация бургер-меню. Безопасна для всех страниц:
 * если кнопки .burger-btn нет — просто ничего не делает.
 * Защита от двойной инициализации через data-атрибут.
 */
function initBurgerMenu() {
    const burgerBtn = document.querySelector('.burger-btn');
    const mainNav   = document.querySelector('.main-nav');
    if (!burgerBtn || !mainNav) return;
    if (burgerBtn.dataset.bound === 'true') return;
    burgerBtn.dataset.bound = 'true';

    let overlay = document.querySelector('.nav-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'nav-overlay';
        document.body.appendChild(overlay);
    }

    const toggle = (open) => {
        const willOpen = open ?? !mainNav.classList.contains('active');
        mainNav.classList.toggle('active', willOpen);
        burgerBtn.classList.toggle('active', willOpen);
        document.body.classList.toggle('nav-open', willOpen);
        overlay.classList.toggle('active', willOpen);
    };

    burgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggle();
    });

    mainNav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => toggle(false));
    });

    // Клик вне панели закрывает меню
    document.addEventListener('click', (e) => {
        if (mainNav.classList.contains('active') &&
            !mainNav.contains(e.target) &&
            !burgerBtn.contains(e.target)) {
            toggle(false);
        }
    });
}