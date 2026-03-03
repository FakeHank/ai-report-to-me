export type Lang = 'en' | 'zh' | 'ja' | 'ko' | 'ru'

const translations: Record<string, Record<Lang, string>> = {
  // Daily report template
  'daily.title': {
    en: 'Daily Report',
    zh: '日报',
    ja: '日報',
    ko: '일일 보고서',
    ru: 'Дневной отчёт',
  },
  'daily.overview': {
    en: 'Overview',
    zh: '概览',
    ja: '概要',
    ko: '개요',
    ru: 'Обзор',
  },
  'daily.projectProgress': {
    en: 'Project Progress',
    zh: '项目进展',
    ja: 'プロジェクト進捗',
    ko: '프로젝트 진행',
    ru: 'Прогресс проектов',
  },
  'daily.whatWasDone': {
    en: 'What was done:',
    zh: '做了什么：',
    ja: 'やったこと：',
    ko: '한 일:',
    ru: 'Что сделано:',
  },
  'daily.frictionAndResolution': {
    en: 'Friction and resolution:',
    zh: '卡点和解决：',
    ja: '課題と解決：',
    ko: '문제와 해결:',
    ru: 'Трудности и решения:',
  },
  'daily.experienceSlices': {
    en: 'Experience Slices',
    zh: '经验切片',
    ja: '経験スライス',
    ko: '경험 슬라이스',
    ru: 'Срезы опыта',
  },
  'daily.experienceSlicesDesc': {
    en: '> Experience Slice = a complete "problem → exploration → solution" story that provides cognitive value without project context',
    zh: '> 经验切片 = 一个完整的"问题→探索→解决"故事，读者无需项目背景也能获得认知增量',
    ja: '> 経験スライス = プロジェクトの背景がなくても認知的価値を得られる「問題→探索→解決」の完全なストーリー',
    ko: '> 경험 슬라이스 = 프로젝트 배경 없이도 인지적 가치를 제공하는 완전한 "문제→탐색→해결" 이야기',
    ru: '> Срез опыта = полная история «проблема → исследование → решение», дающая познавательную ценность без контекста проекта',
  },
  'daily.sliceRequirement': {
    en: `Each slice must contain:

### [Specific descriptive title, not generic like "Handling XX issue"]
- **Background**: 1-2 sentences on what you were doing, what tech stack, what goal (so someone without project context can understand)
- **Problem**: What specific problem was encountered, what were the symptoms (error messages, unexpected behavior, performance issues, etc.)
- **Exploration**: What approaches were tried, why they didn't work, what was the turning point
- **Solution**: How it was ultimately resolved, specific to commands, configuration, code patterns
- **Transferable insight**: What universal principle is behind this experience, in what similar scenarios can it be reused`,
    zh: `每个切片必须包含：

### [具体描述性标题，不要泛泛的"XX问题的处理"]
- **背景**：用 1-2 句话说明在做什么、用什么技术栈、想达成什么目标（让没有项目上下文的人能理解场景）
- **问题**：具体遇到了什么问题，表现是什么（错误信息、异常行为、性能问题等）
- **踩坑过程**：尝试了什么方案、为什么没有用、关键的转折点是什么
- **解决方案**：最终怎么解决的，具体到命令、配置、代码模式
- **可迁移的认知**：这个经验背后的通用原则是什么，在什么类似场景下可以复用`,
    ja: `各スライスに必要な要素：

### [具体的で説明的なタイトル、「XX問題の処理」のような一般的なものは避ける]
- **背景**：何をしていたか、どの技術スタック、何を目指していたか（プロジェクトのコンテキストがない人でも理解できるように1-2文で）
- **問題**：具体的にどんな問題が発生したか、症状は何か（エラーメッセージ、異常な動作、パフォーマンス問題など）
- **試行錯誤**：どんなアプローチを試したか、なぜうまくいかなかったか、転機は何か
- **解決策**：最終的にどう解決したか、コマンド、設定、コードパターンまで具体的に
- **移転可能な知見**：この経験の背後にある普遍的な原則は何か、どのような類似シナリオで再利用できるか`,
    ko: `각 슬라이스에 포함해야 할 내용:

### [구체적이고 설명적인 제목, "XX 문제 처리"와 같은 일반적인 것은 피하기]
- **배경**: 무엇을 하고 있었는지, 어떤 기술 스택인지, 목표가 무엇이었는지 1-2문장으로 (프로젝트 컨텍스트 없이도 이해할 수 있도록)
- **문제**: 구체적으로 어떤 문제가 발생했는지, 증상은 무엇인지 (에러 메시지, 비정상 동작, 성능 문제 등)
- **탐색 과정**: 어떤 접근법을 시도했는지, 왜 안 됐는지, 전환점은 무엇이었는지
- **해결책**: 최종적으로 어떻게 해결했는지, 명령어, 설정, 코드 패턴까지 구체적으로
- **이전 가능한 인사이트**: 이 경험 뒤에 있는 보편적인 원칙은 무엇인지, 어떤 유사한 시나리오에서 재사용할 수 있는지`,
    ru: `Каждый срез должен содержать:

### [Конкретное описательное название, не общее типа "Обработка проблемы XX"]
- **Контекст**: 1-2 предложения о том, что делали, какой стек, какая цель (чтобы человек без контекста проекта мог понять)
- **Проблема**: Какая конкретная проблема возникла, каковы симптомы (сообщения об ошибках, неожиданное поведение, проблемы производительности и т.д.)
- **Исследование**: Какие подходы были опробованы, почему не сработали, что стало переломным моментом
- **Решение**: Как в итоге решили, с конкретными командами, конфигурацией, паттернами кода
- **Переносимый инсайт**: Какой универсальный принцип стоит за этим опытом, в каких похожих сценариях его можно применить`,
  },
  'daily.sliceFilterCriteria': {
    en: `Selection criteria:
- Only keep slices with "cognitive value" — the reader learns something they didn't know before
- Skip purely operational content (installing dependencies, creating files, fixing typos)
- Skip simple errors without exploration process (file not found, import path errors)
- Prefer: debugging processes with turning points, solution choices with tradeoffs, technical discoveries with depth
- If there are no worthwhile experience slices today, write "Today's work was routine development, no notable experience slices." — don't force it`,
    zh: `筛选标准：
- 只保留有"认知增量"的切片 — 读者看完后学到了之前不知道的东西
- 跳过纯操作性内容（安装依赖、创建文件、修复 typo）
- 跳过没有解决过程的简单错误（file not found、import 路径错误）
- 优先选择：调试过程有转折的、方案选择有 tradeoff 的、技术发现有深度的
- 如果当天没有值得写的经验切片，写"今天的工作以常规开发为主，没有特别值得记录的经验切片。"，不要硬凑`,
    ja: `選択基準：
- 「認知的価値」のあるスライスのみ残す — 読者が以前知らなかったことを学べる
- 純粋な操作内容はスキップ（依存関係のインストール、ファイル作成、タイポ修正）
- 探索プロセスのない単純なエラーはスキップ（file not found、importパスエラー）
- 優先：転機のあるデバッグプロセス、トレードオフのあるソリューション選択、深みのある技術的発見
- 当日に書くべき経験スライスがない場合は「今日の作業は通常の開発が中心で、特筆すべき経験スライスはありませんでした。」と書く — 無理に作らない`,
    ko: `선별 기준:
- "인지적 가치"가 있는 슬라이스만 유지 — 독자가 이전에 몰랐던 것을 배울 수 있어야 함
- 순수한 작업 내용 건너뛰기 (의존성 설치, 파일 생성, 오타 수정)
- 탐색 과정이 없는 단순한 에러 건너뛰기 (file not found, import 경로 에러)
- 우선 선택: 전환점이 있는 디버깅 과정, 트레이드오프가 있는 솔루션 선택, 깊이 있는 기술적 발견
- 당일 쓸 만한 경험 슬라이스가 없으면 "오늘의 작업은 일상적인 개발이 주였으며, 특별히 기록할 만한 경험 슬라이스는 없습니다."라고 쓰기 — 억지로 만들지 않기`,
    ru: `Критерии отбора:
- Оставляйте только срезы с «познавательной ценностью» — читатель узнаёт что-то новое
- Пропускайте чисто операционный контент (установка зависимостей, создание файлов, исправление опечаток)
- Пропускайте простые ошибки без процесса исследования (file not found, ошибки путей импорта)
- Предпочитайте: процессы отладки с поворотными моментами, выбор решений с компромиссами, технические открытия с глубиной
- Если за день нет достойных срезов, напишите «Сегодняшняя работа была рутинной разработкой, без заметных срезов опыта.» — не вымучивайте`,
  },
  'daily.aiReview': {
    en: 'AI Review',
    zh: 'AI 复盘',
    ja: 'AIレビュー',
    ko: 'AI 리뷰',
    ru: 'AI-анализ',
  },

  // Wrapped report template
  'wrapped.tokenFootnote': {
    en: '* Token usage data reflects only {source} — other CLIs do not provide token statistics.',
    zh: '* Token 消耗数仅反映 {source} 的数据，其他 CLI 不提供 token 统计。',
    ja: '* トークン消費データは {source} のみを反映しています。他のCLIはトークン統計を提供していません。',
    ko: '* 토큰 소비 데이터는 {source}만 반영합니다. 다른 CLI는 토큰 통계를 제공하지 않습니다.',
    ru: '* Данные о потреблении токенов отражают только {source} — другие CLI не предоставляют статистику токенов.',
  },
  'wrapped.vibeExamples': {
    en: '"Night Ghost", "Flip-Flopper", "Flash Raider", "Wall Builder", "Chatterbox Driver", "Refactor Addict"',
    zh: '"深夜幽灵型"、"反复横跳型"、"闪现游击型"、"砌墙专家型"、"话痨驱动型"、"重构上瘾型"',
    ja: '"深夜ゴースト型"、"優柔不断型"、"閃光ゲリラ型"、"壁職人型"、"おしゃべり駆動型"、"リファクタ中毒型"',
    ko: '"심야 유령형", "왔다갔다형", "번개 게릴라형", "벽돌쌓기 전문가형", "수다쟁이 드라이버형", "리팩터링 중독형"',
    ru: '"Ночной призрак", "Туда-сюда", "Молниеносный рейдер", "Строитель стен", "Болтун-водитель", "Рефакторинг-наркоман"',
  },
  'wrapped.vibeFormatRequirement': {
    en: '**Format requirement**: Start the section body with exactly this format on the first line:\n`**[emoji] [Type Name]**`\nFor example: `**🌙 Night Ghost**` or `**⚡ Flash Iterator**`',
    zh: '**格式要求**：在正文第一行使用此格式：\n`**[emoji] [类型名称]**`\n例如：`**🌙 深夜幽灵型**` 或 `**⚡ 闪电迭代者**`',
    ja: '**フォーマット要件**：本文の最初の行にこの形式を使用：\n`**[emoji] [タイプ名]**`\n例：`**🌙 深夜ゴースト型**` または `**⚡ 閃光イテレーター**`',
    ko: '**형식 요구사항**: 본문 첫 줄에 이 형식을 사용:\n`**[emoji] [타입 이름]**`\n예: `**🌙 심야 유령형**` 또는 `**⚡ 번개 반복자**`',
    ru: '**Требование к формату**: Начните раздел с первой строки в таком формате:\n`**[emoji] [Название типа]**`\nНапример: `**🌙 Ночной призрак**` или `**⚡ Молниеносный итератор**`',
  },

  // Startup check
  'startup.notConfigured': {
    en: '[AI Report] aireport not configured. Run `aireport install` for initial setup (select data sources, language, etc.).\n',
    zh: '[AI Report] aireport 尚未配置。请运行 `aireport install` 进行初始设置（选择数据源、语言等）。\n',
    ja: '[AI Report] aireport が設定されていません。`aireport install` を実行して初期設定を行ってください（データソース、言語などの選択）。\n',
    ko: '[AI Report] aireport가 구성되지 않았습니다. `aireport install`을 실행하여 초기 설정을 진행하세요 (데이터 소스, 언어 등 선택).\n',
    ru: '[AI Report] aireport не настроен. Запустите `aireport install` для начальной настройки (выбор источников данных, языка и т.д.).\n',
  },
  'startup.yesterdayPending': {
    en: '[AI Report] {count} session(s) yesterday, report pending. Type /dayreport to generate.',
    zh: '[AI Report] 昨天有 {count} 个 session，日报尚未生成。输入 /dayreport 查看日报。',
    ja: '[AI Report] 昨日 {count} セッション、レポート未生成。/dayreport で日報を生成してください。',
    ko: '[AI Report] 어제 {count}개 세션, 보고서 미생성. /dayreport로 일일 보고서를 생성하세요.',
    ru: '[AI Report] {count} сессий вчера, отчёт не создан. Введите /dayreport для генерации.',
  },
  'startup.yesterdayReport': {
    en: '[AI Report] Yesterday\'s report ({date}) · {project}:',
    zh: '[AI Report] 昨日日报 ({date}) · {project} 相关:',
    ja: '[AI Report] 昨日の日報 ({date}) · {project} 関連:',
    ko: '[AI Report] 어제 보고서 ({date}) · {project} 관련:',
    ru: '[AI Report] Вчерашний отчёт ({date}) · {project}:',
  },
  'startup.todayReport': {
    en: '[AI Report] Today\'s report ({date}) · {project}:',
    zh: '[AI Report] 今日日报 ({date}) · {project} 相关:',
    ja: '[AI Report] 今日の日報 ({date}) · {project} 関連:',
    ko: '[AI Report] 오늘 보고서 ({date}) · {project} 관련:',
    ru: '[AI Report] Сегодняшний отчёт ({date}) · {project}:',
  },

  // Habits analyzer
  'habits.directive': {
    en: 'Short commands, high-frequency interaction — you prefer to stay in control',
    zh: '短指令、高频交互 — 你倾向于保持控制',
    ja: '短いコマンド、高頻度のやり取り — コントロールを保つ傾向',
    ko: '짧은 명령어, 고빈도 상호작용 — 통제를 유지하는 것을 선호',
    ru: 'Короткие команды, частое взаимодействие — вы предпочитаете держать контроль',
  },
  'habits.delegative': {
    en: 'Long prompts, low-frequency check-ins — you trust AI with larger chunks',
    zh: '长提示词、低频检查 — 你信任AI处理更大块的任务',
    ja: '長いプロンプト、低頻度のチェック — AIにより大きなタスクを委任',
    ko: '긴 프롬프트, 저빈도 확인 — AI에게 더 큰 작업을 맡기는 것을 신뢰',
    ru: 'Длинные промпты, редкие проверки — вы доверяете ИИ крупные задачи',
  },
  'habits.mixed': {
    en: 'A mix of short directives and long delegations',
    zh: '短指令和长委托的混合风格',
    ja: '短いディレクティブと長い委任の混合スタイル',
    ko: '짧은 지시와 긴 위임의 혼합 스타일',
    ru: 'Смесь коротких директив и длинных делегирований',
  },

  // Improvements analyzer
  'improvements.prematureEndings.title': {
    en: 'Premature session endings',
    zh: '过早结束 Session',
    ja: 'セッションの早期終了',
    ko: '세션 조기 종료',
    ru: 'Преждевременное завершение сессий',
  },
  'improvements.prematureEndings.observation': {
    en: '{count} sessions ended with a Bash command, suggesting you often discover new issues at the end.',
    zh: '{count} 个 session 以 Bash 命令结束，说明你经常在结尾发现新问题。',
    ja: '{count} セッションがBashコマンドで終了しており、終了間際に新しい問題を発見する傾向があります。',
    ko: '{count}개 세션이 Bash 명령으로 끝났으며, 종료 시점에 새로운 문제를 자주 발견하는 것으로 보입니다.',
    ru: '{count} сессий завершились командой Bash, что указывает на частое обнаружение новых проблем в конце.',
  },
  'improvements.prematureEndings.suggestion': {
    en: 'Before wrapping up, ask AI "is there anything I missed?" to catch loose ends.',
    zh: '在结束前，问AI"还有什么遗漏吗？"来捕捉遗漏。',
    ja: '終了前にAIに「何か見落としはありますか？」と確認して、漏れを防ぎましょう。',
    ko: '마무리하기 전에 AI에게 "놓친 것이 없나요?"라고 물어보세요.',
    ru: 'Перед завершением спросите ИИ «не упустил ли я что-то?», чтобы не оставить незакрытых вопросов.',
  },
  'improvements.debuggingLoops.title': {
    en: 'Repeated debugging loops',
    zh: '重复的调试循环',
    ja: '繰り返しのデバッグループ',
    ko: '반복되는 디버깅 루프',
    ru: 'Повторяющиеся циклы отладки',
  },
  'improvements.debuggingLoops.observation': {
    en: '{count} instances of editing the same file 3+ times in a session.',
    zh: '{count} 次在同一 session 中编辑同一文件 3+ 次。',
    ja: '{count} 回、同一セッション内で同じファイルを3回以上編集しています。',
    ko: '{count}번 같은 세션에서 같은 파일을 3회 이상 편집했습니다.',
    ru: '{count} случаев редактирования одного файла 3+ раз за сессию.',
  },
  'improvements.debuggingLoops.suggestion': {
    en: 'Consider asking AI to explain the root cause before attempting fixes.',
    zh: '考虑在尝试修复之前，先让AI解释根本原因。',
    ja: '修正を試みる前に、AIに根本原因の説明を求めることを検討してください。',
    ko: '수정을 시도하기 전에 AI에게 근본 원인을 설명해 달라고 요청해 보세요.',
    ru: 'Попробуйте попросить ИИ объяснить корневую причину прежде чем пытаться исправлять.',
  },
  'improvements.lateNight.title': {
    en: 'Late night sessions are less productive',
    zh: '深夜 session 效率较低',
    ja: '深夜セッションの生産性が低い',
    ko: '심야 세션의 생산성이 낮음',
    ru: 'Ночные сессии менее продуктивны',
  },
  'improvements.lateNight.observation': {
    en: 'Sessions after 11pm average {nightMin}min vs {dayMin}min during the day ({pctDrop}% shorter).',
    zh: '23点后的 session 平均 {nightMin} 分钟，白天 {dayMin} 分钟（短 {pctDrop}%）。',
    ja: '23時以降のセッション平均 {nightMin}分 vs 日中 {dayMin}分（{pctDrop}% 短い）。',
    ko: '23시 이후 세션 평균 {nightMin}분 vs 주간 {dayMin}분 ({pctDrop}% 짧음).',
    ru: 'Сессии после 23:00 в среднем {nightMin}мин vs {dayMin}мин днём ({pctDrop}% короче).',
  },
  'improvements.lateNight.suggestion': {
    en: 'Avoid starting complex tasks late at night.',
    zh: '避免在深夜开始复杂任务。',
    ja: '深夜に複雑なタスクを始めるのは避けましょう。',
    ko: '심야에 복잡한 작업을 시작하지 마세요.',
    ru: 'Избегайте начинать сложные задачи поздно ночью.',
  },
  'improvements.highErrorRate.title': {
    en: 'High tool error rate',
    zh: '工具错误率偏高',
    ja: 'ツールエラー率が高い',
    ko: '도구 오류율이 높음',
    ru: 'Высокий процент ошибок инструментов',
  },
  'improvements.highErrorRate.observation': {
    en: '{errors} tool errors out of {total} calls ({pct}%).',
    zh: '{total} 次工具调用中有 {errors} 次错误（{pct}%）。',
    ja: '{total} 回のツール呼び出し中 {errors} 回エラー（{pct}%）。',
    ko: '{total}번 도구 호출 중 {errors}번 오류 ({pct}%).',
    ru: '{errors} ошибок из {total} вызовов инструментов ({pct}%).',
  },
  'improvements.highErrorRate.suggestion': {
    en: 'Review common error patterns — often they stem from stale context or incorrect assumptions.',
    zh: '检查常见错误模式 — 通常源于过期的上下文或错误的假设。',
    ja: '一般的なエラーパターンを確認してください — 多くは古いコンテキストや誤った仮定が原因です。',
    ko: '일반적인 오류 패턴을 검토하세요 — 대부분 오래된 컨텍스트나 잘못된 가정에서 비롯됩니다.',
    ru: 'Проверьте типичные паттерны ошибок — часто они вызваны устаревшим контекстом или неверными предположениями.',
  },

  // Vibe card
  'vibeCard.sessions': {
    en: 'sessions',
    zh: '个 session',
    ja: 'セッション',
    ko: '세션',
    ru: 'сессий',
  },
  'vibeCard.coding': {
    en: 'coding',
    zh: '编程',
    ja: 'コーディング',
    ko: '코딩',
    ru: 'кодинг',
  },
  'vibeCard.activeDays': {
    en: 'active days',
    zh: '活跃天数',
    ja: 'アクティブ日数',
    ko: '활동일',
    ru: 'активных дней',
  },
  'vibeCard.topProject': {
    en: 'top project',
    zh: '主力项目',
    ja: 'トッププロジェクト',
    ko: '탑 프로젝트',
    ru: 'топ-проект',
  },
}

export function t(key: string, lang: Lang | string): string {
  const l = (lang || 'en') as Lang
  const entry = translations[key]
  if (!entry) return key
  return entry[l] ?? entry.en ?? key
}

export function tf(key: string, lang: Lang | string, vars: Record<string, string | number>): string {
  let text = t(key, lang)
  for (const [k, v] of Object.entries(vars)) {
    text = text.replaceAll(`{${k}}`, String(v))
  }
  return text
}
