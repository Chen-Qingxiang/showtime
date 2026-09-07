(() => {
  'use strict';

  const STORAGE_KEY = 'showtime:language';
  const DEFAULT_LANGUAGE = 'en';
  const SUPPORTED_LANGUAGES = new Set(['en', 'zh']);

  const ZH_DEFAULT_SAMPLE = `# time,title（两列；layer 由文件名决定，左侧文本默认层名“文本”）
# 约定：范围用 ~ 分隔；支持年份或日期（例 1949-10-01）
# 可用负数表示 BCE（例 -2070~-1600）
# 若无结束（例如 1949~ 或 1949-10-01~），将自动补到当前年/日期
-2070~-1600,夏
-1600~-1046,商
-1046~-256,周
-221~-207,秦
-202~8,西汉
9~23,新
25~220,东汉
220~266,魏
221~263,蜀汉
222~280,吴
266~316,西晋
317~420,东晋
420~589,南北朝
581~618,隋
618~907,唐
690~705,武周
907~960,五代
907~979,十国
916~1125,辽
960~1127,北宋
1127~1279,南宋
1038~1227,西夏
1115~1234,金
1271~1368,元
1368~1644,明
1636~1912,清
1912~1949,中华民国（大陆时期）
1949~,中华人民共和国`;

  const EN_DEFAULT_SAMPLE = `# time,title (two columns; layer comes from the file name; left-side text uses the “Text” layer)
# Use ~ for ranges; years and dates are supported (e.g. 1949-10-01)
# Negative years represent BCE (e.g. -2070~-1600)
# An open range (e.g. 1949~ or 1949-10-01~) automatically extends to the current year/date
-2070~-1600,Xia
-1600~-1046,Shang
-1046~-256,Zhou
-221~-207,Qin
-202~8,Western Han
9~23,Xin
25~220,Eastern Han
220~266,Cao Wei
221~263,Shu Han
222~280,Eastern Wu
266~316,Western Jin
317~420,Eastern Jin
420~589,Northern and Southern Dynasties
581~618,Sui
618~907,Tang
690~705,Wu Zhou
907~960,Five Dynasties
907~979,Ten Kingdoms
916~1125,Liao
960~1127,Northern Song
1127~1279,Southern Song
1038~1227,Western Xia
1115~1234,Jin
1271~1368,Yuan
1368~1644,Ming
1636~1912,Qing
1912~1949,Republic of China (mainland period)
1949~,People's Republic of China`;

  const UI_TEXT = new Map([
    ['添加图层', 'Add layer'],
    ['上传 CSV / ZIP', 'Upload CSV / ZIP'],
    ['加载左侧文本', 'Load text panel'],
    ['同源追加到同一图层', 'Append same source to the same layer'],
    ['背景', 'Background'],
    ['内置示例', 'Built-in examples'],
    ['加载示例', 'Load example'],
    ['背景库', 'Background library'],
    ['加载背景', 'Load background'],
    ['加载推荐背景', 'Load recommended backgrounds'],
    ['显示', 'Display'],
    ['点事件显示', 'Point-event display'],
    ['保持圆点', 'Keep as points'],
    ['年点显示为全年', 'Expand year points to full years'],
    ['年/月点显示为区间', 'Expand year/month points to ranges'],
    ['年/月/日点显示为区间', 'Expand year/month/day points to ranges'],
    ['全部点显示为区间', 'Expand all points to ranges'],
    ['事件悬浮气泡', 'Event hover tooltip'],
    ['范围', 'Range'],
    ['贴合数据', 'Fit data'],
    ['人类史', 'Human history'],
    ['地质史', 'Geological history'],
    ['宇宙史', 'Cosmic history'],
    ['缩放', 'Zoom'],
    ['重置视图', 'Reset view'],
    ['CSV 文本（示例）', 'CSV text (example)'],
    ['数据格式', 'Data format'],
    ['导入方式', 'Import'],
    ['常用操作', 'Controls'],
    ['自测结果', 'Self-test results'],
    ['图层操作', 'Layer actions'],
    ['重命名图层', 'Rename layer'],
    ['隐藏该层', 'Hide layer'],
    ['显示该层', 'Show layer'],
    ['设置图层颜色', 'Set layer colour'],
    ['删除该层', 'Delete layer'],
    ['取消', 'Cancel'],
    ['图层颜色', 'Layer colour'],
    ['恢复默认颜色', 'Restore default colour'],
    ['显示左栏', 'Show side panel'],
    ['隐藏左栏', 'Hide side panel'],
    ['点击查看自测详情', 'Click to view self-test details'],
    ['右键图层名称可重新显示', 'Right-click the layer name to show it again'],
    ['(未命名)', '(Untitled)'],
    ['(无标题)', '(Untitled)'],
    ['图层名称不能为空', 'Layer name cannot be empty'],
    ['暂无可推荐背景', 'No background recommendations available'],
    ['推荐背景已在画布中', 'Recommended backgrounds are already on the canvas'],
    ['不是有效的 ZIP 文件', 'Not a valid ZIP file'],
    ['暂不支持 ZIP64 文件', 'ZIP64 files are not currently supported'],
    ['ZIP 中央目录损坏', 'The ZIP central directory is damaged'],
    ['当前浏览器不支持解压缩 ZIP 中的压缩文件', 'This browser cannot decompress compressed files inside ZIP archives'],
    ['ZIP 本地文件头损坏', 'The ZIP local file header is damaged'],
    ['未解析到任何事件', 'No events could be parsed'],
    ['示例文件中未解析到有效事件', 'No valid events could be parsed from the example file'],
    ['以下文件未能加载为时间轴：', 'The following files could not be loaded as timelines:'],
    ['请检查：', 'Please check:'],
  ]);

  const EXAMPLE_NAMES = {
    'examples/中国朝代.csv': 'Chinese Dynasties',
    'examples/皇帝在位时间.csv': 'Chinese Emperors',
    'examples/皇帝在位时间_日期.csv': 'Chinese Emperors (dates)',
    'examples/赵林-哲学家表.csv': 'Philosophers (Zhao Lin)',
    'examples/赵林-哲学家表_日期.csv': 'Philosophers (Zhao Lin, dates)',
    'examples/宇宙与太阳系演化.csv': 'Cosmos & Solar System',
    'examples/地质年代与生命演化.csv': 'Geological Time & Life',
    'examples/人类史与文明关键节点.csv': 'Human History & Civilisation',
    'examples/文学与思想史.csv': 'Literature & Intellectual History',
  };

  const BACKGROUND_CATALOG = {
    'china-dynasties': ['Chinese Dynasties', 'Core political periods in Chinese history; useful context for Chinese history and intellectual history.'],
    'world-empires': ['World Empires', 'A broad cross-regional view of major empires and large political systems.'],
    'europe-periods': ['European Periods', 'Common periodisation of European history, useful alongside philosophy, literature and politics.'],
    'major-wars': ['Major Wars', 'Major wars and changes in international order across periods.'],
    'thought-movements': ['Intellectual Movements', 'Philosophical schools, intellectual movements and knowledge traditions.'],
    'religion-history': ['History of Religion', 'Major religious traditions, reforms and phases of diffusion.'],
    'science-technology': ['Science & Technology', 'Scientific revolutions, industrialisation, computing, the internet and related developments.'],
    'economy-society': ['Economic & Social History', 'Agriculture, urbanisation, trade, industrialisation, finance and globalisation.'],
    'literature-art': ['Literature & Art Movements', 'Literary, artistic and aesthetic movements for cross-field comparison.'],
    'geology-life': ['Geology & Life', 'Geological time, biological evolution and the emergence of humans.'],
    'big-history-thresholds': ['Big History Thresholds', 'Cosmic, biological, human, agricultural and modern-revolution thresholds at very large scales.'],
    'human-migration-population': ['Human Migration & Population', 'Homo sapiens dispersal, population growth and demographic transitions.'],
    'agriculture-domestication': ['Agriculture & Domestication', 'Agricultural centres, crops, animal domestication and farming technologies.'],
    'climate-environment': ['Climate & Environment', 'Major climatic and environmental events affecting societies, agriculture and populations.'],
    'ap-world-periods': ['World History Periods (AP)', 'A general periodisation framework commonly used in global-history courses.'],
    'islamic-world': ['Islamic World', 'Political, religious and intellectual networks across the Islamic world.'],
    'south-asia-history': ['South Asian History', 'Civilisations, religions, empires, colonialism and modern transformation in South Asia.'],
    'japan-periods': ['Japanese Historical Periods', 'Common periodisation of Japanese history for East Asian comparison.'],
    'korea-history': ['Korean Peninsula History', 'Political and cultural history of the Korean Peninsula, including modern division.'],
    'southeast-asia-history': ['Southeast Asian History', 'State formation, trade networks, colonialism and independence in Southeast Asia.'],
    'africa-kingdoms-colonialism': ['African Kingdoms & Colonialism', 'Major African kingdoms, the slave trade, colonialism and independence.'],
    'americas-civilizations-colonialism': ['Civilisations & Colonialism in the Americas', 'American civilisations, European colonisation and independence movements.'],
    'eurasian-steppe-nomads': ['Eurasian Steppe & Nomadic Empires', 'Steppe mobility, nomadic confederations and connections across Eurasia.'],
    'ancient-near-east-egypt': ['Ancient Near East & Egypt', 'Mesopotamia, Egypt and states of the ancient Near East.'],
    'oceania-pacific-world': ['Oceania & the Pacific World', 'Australia, Polynesia and the wider Pacific world.'],
    'education-knowledge-institutions': ['Education & Knowledge Institutions', 'Libraries, universities, academies and modern research institutions.'],
    'media-information': ['Media & Information', 'Writing, paper, printing, broadcasting, television, the internet and mobile media.'],
    'language-translation': ['Language, Writing & Translation', 'Writing systems, major translation movements and cross-cultural knowledge transfer.'],
    'medicine-public-health': ['Medicine & Public Health', 'Medical traditions, germ theory, vaccines, antibiotics and public health.'],
    'astronomy-space': ['Astronomy & Space Exploration', 'Changing cosmologies, astronomical revolutions and space exploration.'],
    'trade-networks': ['Trade Networks', 'The Silk Roads, Indian Ocean trade, Atlantic trade and global supply chains.'],
    'capitalism-finance': ['Capitalism & Finance', 'Commercial revolutions, banking, joint-stock companies, the gold standard and financial globalisation.'],
    'transport-spatial-compression': ['Transport & Spatial Compression', 'How transport technologies changed distance, war, trade and urban life.'],
    'energy-history': ['Energy History', 'Fire, animal power, coal, oil, electricity, nuclear power and energy transitions.'],
    'urbanization-city-form': ['Urbanisation & Urban Form', 'The emergence of cities, industrial cities, suburbanisation and global city networks.'],
    'colonialism-decolonization': ['Colonialism & Decolonisation', 'Colonial expansion, imperial systems and decolonisation.'],
    'political-revolutions': ['Political Revolutions', 'Modern political revolutions and major institutional ruptures.'],
    'democratization-regimes': ['Political Regimes & Democratisation', 'Democracy, suffrage, constitutionalism, authoritarianism and waves of democratisation.'],
    'law-human-rights': ['States, Law & Human Rights', 'Legal codes, sovereign states, international organisations and human-rights frameworks.'],
    'labor-social-movements-gender': ['Labour, Social Movements & Gender', 'Slavery, labour movements, social movements and gender equality.'],
  };

  const BACKGROUND_NAME_ZH_TO_EN = {
    '中国朝代': 'Chinese Dynasties',
    '世界帝国': 'World Empires',
    '欧洲时代': 'European Periods',
    '主要战争': 'Major Wars',
    '思想史运动': 'Intellectual Movements',
    '宗教史': 'History of Religion',
    '科学技术史': 'Science & Technology',
    '经济社会史': 'Economic & Social History',
    '文学艺术运动': 'Literature & Art Movements',
    '地质生命史': 'Geology & Life',
    'BigHistory阈值': 'Big History Thresholds',
    '人类迁徙与人口': 'Human Migration & Population',
    '农业与驯化': 'Agriculture & Domestication',
    '气候环境事件': 'Climate & Environment',
    '世界史分期_AP': 'World History Periods (AP)',
    '伊斯兰世界': 'Islamic World',
    '南亚历史': 'South Asian History',
    '日本历史分期': 'Japanese Historical Periods',
    '朝鲜半岛历史': 'Korean Peninsula History',
    '东南亚历史': 'Southeast Asian History',
    '非洲王国与殖民': 'African Kingdoms & Colonialism',
    '美洲文明与殖民': 'Civilisations & Colonialism in the Americas',
    '欧亚草原与游牧帝国': 'Eurasian Steppe & Nomadic Empires',
    '古代近东与埃及': 'Ancient Near East & Egypt',
    '大洋洲与太平洋世界': 'Oceania & the Pacific World',
    '教育与知识机构': 'Education & Knowledge Institutions',
    '文字媒介与信息传播': 'Media & Information',
    '语言文字与翻译运动': 'Language, Writing & Translation',
    '医学与公共卫生': 'Medicine & Public Health',
    '天文学与空间探索': 'Astronomy & Space Exploration',
    '贸易网络': 'Trade Networks',
    '资本主义与金融体系': 'Capitalism & Finance',
    '交通运输与空间压缩': 'Transport & Spatial Compression',
    '能源史': 'Energy History',
    '城市化与城市形态': 'Urbanisation & Urban Form',
    '殖民主义与去殖民化': 'Colonialism & Decolonisation',
    '政治革命': 'Political Revolutions',
    '政治制度与民主化': 'Political Regimes & Democratisation',
    '国家制度法律与人权': 'States, Law & Human Rights',
    '劳动制度社会运动与性别': 'Labour, Social Movements & Gender',
  };

  const EXAMPLE_NAME_ZH_TO_EN = {
    '中国朝代': 'Chinese Dynasties',
    '皇帝在位时间': 'Chinese Emperors',
    '皇帝在位时间_日期': 'Chinese Emperors (dates)',
    '赵林-哲学家表': 'Philosophers (Zhao Lin)',
    '赵林-哲学家表_日期': 'Philosophers (Zhao Lin, dates)',
    '宇宙与太阳系演化': 'Cosmos & Solar System',
    '地质年代与生命演化': 'Geological Time & Life',
    '人类史与文明关键节点': 'Human History & Civilisation',
    '文学与思想史': 'Literature & Intellectual History',
  };

  let currentLanguage = readLanguage();
  const originalTextByNode = new WeakMap();
  const originalAttributes = new WeakMap();
  let hintOriginalHtml = null;
  let refreshQueued = false;

  function readLanguage() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED_LANGUAGES.has(saved)) return saved;
    } catch {}
    return DEFAULT_LANGUAGE;
  }

  function saveLanguage(language) {
    try {
      window.localStorage.setItem(STORAGE_KEY, language);
    } catch {}
  }

  function translateBackgroundName(name) {
    return BACKGROUND_NAME_ZH_TO_EN[name] || name;
  }

  function translateExampleName(name) {
    return EXAMPLE_NAME_ZH_TO_EN[name] || name;
  }

  function translateLayerName(name) {
    const source = String(name || '');
    if (source === '文本') return 'Text';
    if (source === '默认') return 'Default';
    if (source.startsWith('背景：')) return `Background: ${translateBackgroundName(source.slice(3))}`;
    return source;
  }

  function translateDuration(text) {
    let match = text.match(/^([\d.]+) 十亿年$/);
    if (match) return `${match[1]} billion years`;
    match = text.match(/^([\d.]+) 亿年$/);
    if (match) return `${match[1]} × 10⁸ years`;
    match = text.match(/^([\d.]+) 万年$/);
    if (match) return `${match[1]} × 10⁴ years`;
    match = text.match(/^([\d.]+) 年$/);
    if (match) return `${match[1]} years`;
    match = text.match(/^([\d.]+) 天$/);
    if (match) return `${match[1]} days`;
    match = text.match(/^([\d.]+) 小时$/);
    if (match) return `${match[1]} hours`;
    match = text.match(/^([\d.]+) 分钟$/);
    if (match) return `${match[1]} minutes`;
    match = text.match(/^([\d.]+) 秒$/);
    if (match) return `${match[1]} seconds`;
    return text;
  }

  function translateZhLine(line) {
    if (UI_TEXT.has(line)) return UI_TEXT.get(line);
    if (BACKGROUND_NAME_ZH_TO_EN[line]) return BACKGROUND_NAME_ZH_TO_EN[line];
    if (EXAMPLE_NAME_ZH_TO_EN[line]) return EXAMPLE_NAME_ZH_TO_EN[line];

    let match = line.match(/^时间：(.+)$/);
    if (match) return `Time: ${match[1]}`;
    match = line.match(/^选择颜色 (.+)$/);
    if (match) return `Select colour ${match[1]}`;
    match = line.match(/^自测：(\d+)\/(\d+) 通过(?:（有失败，点我看详情）)?$/);
    if (match) return `Self-test: ${match[1]}/${match[2]} passed${line.includes('有失败') ? ' (failures; click for details)' : ''}`;

    match = line.match(/^([\d.]+) px \/ (年|月|天|小时|分钟|秒)$/);
    if (match) {
      const units = { 年: 'year', 月: 'month', 天: 'day', 小时: 'hour', 分钟: 'minute', 秒: 'second' };
      return `${match[1]} px / ${units[match[2]]}`;
    }
    match = line.match(/^(.+) \/ px$/);
    if (match) return `${translateDuration(match[1])} / px`;

    match = line.match(/^已加载 CSV：(.+)$/);
    if (match) return `Loaded CSV: ${translateLayerName(match[1])}`;
    match = line.match(/^已加载 (\d+) 个 CSV 图层：(.+)$/);
    if (match) return `Loaded ${match[1]} CSV layers: ${match[2]}`;
    match = line.match(/^• 另有 (\d+) 个文件未加载$/);
    if (match) return `• ${match[1]} more file(s) were not loaded`;
    match = line.match(/^• (.+)：(.+)$/);
    if (match) return `• ${match[1]}: ${translateZhLine(match[2])}`;

    match = line.match(/^已加载示例：(.+)$/);
    if (match) return `Loaded example: ${translateExampleName(match[1])}`;
    match = line.match(/^加载示例失败：(.+)$/);
    if (match) return `Failed to load example: ${translateExampleName(match[1])}`;
    match = line.match(/^已加载背景：(.+)$/);
    if (match) return `Loaded background: ${match[1].split('、').map(translateBackgroundName).join(', ')}`;
    match = line.match(/^背景已存在：(.+)$/);
    if (match) return `Background already loaded: ${translateBackgroundName(match[1])}`;
    match = line.match(/^加载背景失败：(.+)$/);
    if (match) return `Failed to load background: ${translateBackgroundName(match[1])}`;
    match = line.match(/^已加载推荐背景：(.+)$/);
    if (match) return `Loaded recommended backgrounds: ${match[1].split('、').map(translateBackgroundName).join(', ')}`;
    match = line.match(/^加载推荐背景失败：(.+)$/);
    if (match) return `Failed to load recommended backgrounds: ${match[1]}`;

    match = line.match(/^已删除图层：(.+)$/);
    if (match) return `Deleted layer: ${translateLayerName(match[1])}`;
    match = line.match(/^未找到图层：(.+)$/);
    if (match) return `Layer not found: ${translateLayerName(match[1])}`;
    match = line.match(/^图层名已存在：(.+)$/);
    if (match) return `Layer name already exists: ${match[1]}`;
    match = line.match(/^未能重命名图层：(.+)$/);
    if (match) return `Could not rename layer: ${translateLayerName(match[1])}`;
    match = line.match(/^已重命名图层：(.+) → (.+)$/);
    if (match) return `Renamed layer: ${translateLayerName(match[1])} → ${translateLayerName(match[2])}`;
    match = line.match(/^已隐藏图层：(.+)$/);
    if (match) return `Hidden layer: ${translateLayerName(match[1])}`;
    match = line.match(/^已显示图层：(.+)$/);
    if (match) return `Shown layer: ${translateLayerName(match[1])}`;
    match = line.match(/^已更新图层颜色：(.+)$/);
    if (match) return `Updated layer colour: ${translateLayerName(match[1])}`;
    match = line.match(/^已恢复默认颜色：(.+)$/);
    if (match) return `Restored default colour: ${translateLayerName(match[1])}`;

    match = line.match(/^确认删除图层 “(.+)” 吗？$/);
    if (match) return `Delete layer “${translateLayerName(match[1])}”?`;
    if (line === '（该层包含的事件也会被移除）') return '(Events in this layer will also be removed.)';
    if (line === '请输入新的图层名称：') return 'Enter a new layer name:';
    if (line === '左侧文本未解析出事件。') return 'No events could be parsed from the text panel.';
    if (line === '示例：-2070~-1600,夏') return 'Example: -2070~-1600,Xia';

    match = line.match(/^暂不支持 ZIP 压缩方式 (.+)$/);
    if (match) return `ZIP compression method ${match[1]} is not currently supported`;
    match = line.match(/^(.+) 未解析到有效事件$/);
    if (match) return `No valid events could be parsed from ${translateBackgroundName(match[1])}`;
    match = line.match(/^HTTP (\d+)$/);
    if (match) return line;

    if (line === '• CSV 两列 time,title；') return '• CSV must contain two columns: time,title;';
    if (line === '• 标题中若含逗号，请用双引号包裹；') return '• Wrap titles containing commas in double quotes;';
    if (line === '• 区间分隔符可用 ~ / - / — / 至 等；') return '• Range separators can be ~ / - / — / 至 and related forms;';
    if (line === '• 年份可写 -221 或 221BC / 公元前221。') return '• Years can be written as -221 or 221BC/BCE.';

    return line
      .replace(/；另有 (\d+) 个 ZIP 内 CSV 超出 (\d+) 个上限，已忽略/g, '; $1 additional CSV(s) in the ZIP exceeded the $2-file limit and were ignored')
      .replace(/ \[已隐藏\]$/g, ' [hidden]');
  }

  function translateZhText(text) {
    const source = String(text);
    if (!source.includes('\n')) return translateZhLine(source);
    return source.split('\n').map(translateZhLine).join('\n');
  }

  function translateCanvasText(text) {
    let source = String(text);
    if (currentLanguage !== 'en') return source;
    if (source === '文本' || source === '默认') return translateLayerName(source);
    if (source === '右键图层名称可重新显示') return UI_TEXT.get(source);
    if (source.startsWith('背景：')) {
      const hidden = source.endsWith(' [已隐藏]');
      const core = hidden ? source.slice(0, -6) : source;
      const translated = translateLayerName(core);
      return hidden ? `${translated} [hidden]` : translated;
    }
    if (source.endsWith(' [已隐藏]')) return `${source.slice(0, -6)} [hidden]`;
    if (source.startsWith('(未命名)  ')) return `(Untitled)  ${source.slice('(未命名)  '.length)}`;
    source = source.replace(/([\d.]+)亿(?=\s*(?:BC|CE|$))/g, '$1×10⁸');
    source = source.replace(/([\d.]+)万(?=\s*(?:BC|CE|$))/g, '$1×10⁴');
    return source;
  }

  function translatePreservingWhitespace(text) {
    const match = String(text).match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!match) return text;
    const [, before, core, after] = match;
    if (!core) return text;
    return `${before}${translateZhText(core)}${after}`;
  }

  function shouldSkipTextNode(node) {
    const parent = node.parentElement;
    return !parent || !!parent.closest('script, style, textarea, pre, code, canvas, .language-control');
  }

  function localizeTextNode(node) {
    if (shouldSkipTextNode(node)) return;
    const current = node.nodeValue || '';
    if (currentLanguage === 'en') {
      let source = originalTextByNode.get(node);
      if (!source || (current !== source && current !== translatePreservingWhitespace(source))) {
        source = current;
      }
      const translated = translatePreservingWhitespace(source);
      if (translated !== source) originalTextByNode.set(node, source);
      if (translated !== current) node.nodeValue = translated;
    } else {
      const source = originalTextByNode.get(node);
      if (source != null && current !== source) node.nodeValue = source;
    }
  }

  function walkTextNodes(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) localizeTextNode(node);
  }

  function localizeAttribute(element, attribute) {
    if (!element?.hasAttribute?.(attribute) || element.closest?.('.language-control')) return;
    const current = element.getAttribute(attribute) || '';
    let map = originalAttributes.get(element);
    if (!map) {
      map = new Map();
      originalAttributes.set(element, map);
    }
    if (currentLanguage === 'en') {
      let source = map.get(attribute);
      if (!source || (current !== source && current !== translateZhText(source))) source = current;
      const translated = translateZhText(source);
      if (translated !== source) map.set(attribute, source);
      if (translated !== current) element.setAttribute(attribute, translated);
    } else if (map.has(attribute)) {
      const source = map.get(attribute);
      if (current !== source) element.setAttribute(attribute, source);
    }
  }

  function localizeAttributes(root = document) {
    const elements = root.querySelectorAll?.('[title], [aria-label]') || [];
    for (const element of elements) {
      localizeAttribute(element, 'title');
      localizeAttribute(element, 'aria-label');
    }
  }

  function ensureHintSnapshots() {
    if (hintOriginalHtml) return;
    const blocks = Array.from(document.querySelectorAll('.hint-block'));
    if (blocks.length === 3) hintOriginalHtml = blocks.map((block) => block.innerHTML);
  }

  const EN_HINT_HTML = [
    `<div class="hint-title">Data format</div>
          <ul>
            <li>Two columns, <code>time,title</code>, are enough. The layer name defaults to the file name.</li>
            <li><code>start~end</code>: supports <b>~ - — – － 〜 ～ 至 到</b>, dates, times, negative years, <code>221BC</code>, and BCE notation.</li>
            <li>Date/time: <code>YYYY-MM</code>, <code>YYYY-MM-DD</code>, <code>YYYY-MM-DD HH:mm[:ss]</code></li>
            <li>Points: <code>1054</code>, <code>1949-10</code>, and <code>1949-10-01 12:30</code> are treated as point events.</li>
            <li>Open ranges: <code>1949~</code> extends to the current year and <code>1949-10-01~</code> to the current date; time-of-day precision is preserved.</li>
            <li>Wrap titles containing commas in double quotes: <code>1942,"Spring View, related to Du Fu"</code></li>
          </ul>`,
    `<div class="hint-title">Import</div>
          <ul>
            <li>Upload local CSV / ZIP files. Multiple CSVs are supported; up to the first 100 CSVs in a ZIP are imported as separate layers in file-name order.</li>
            <li>Click “Load text panel” to import the left-side text into the <code>Text</code> layer.</li>
            <li>Use the “Background” menu to load built-in examples and background layers.</li>
            <li>“Load recommended backgrounds” selects a few layers based on the current topic and time range.</li>
            <li>With “Append same source to the same layer” enabled, repeated imports are appended to the existing layer.</li>
            <li>The point-event option under “Display” can expand single-year points such as <code>1647~1647</code> into full-year bars, reducing label overlap.</li>
          </ul>`,
    `<div class="hint-title">Controls</div>
          <ul>
            <li>Handle on the right edge of the left panel: collapse / expand the reference panel.</li>
            <li>Scroll the page vertically to browse more layers.</li>
            <li><span class="kbd">Drag</span> the timeline to pan horizontally; a clear vertical gesture scrolls through layers.</li>
            <li><span class="kbd">Wheel</span> over the timeline to zoom around the pointer position.</li>
            <li><span class="kbd">Wheel</span> over the layer-name area to scroll the page vertically.</li>
            <li>Use the “Range” menu to jump to human-history, geological-history, or cosmic-history scales.</li>
            <li>Drag in the layer-name area to reorder layers.</li>
            <li><span class="kbd">Right-click</span> a layer name to rename, hide, recolour, or delete it.</li>
            <li>With event hover tooltips enabled under “Display”, hover an event to see its full title and time.</li>
            <li>Double-click the canvas or click “Reset view” to restore the view.</li>
          </ul>`,
  ];

  function localizeHints() {
    ensureHintSnapshots();
    if (!hintOriginalHtml) return;
    const blocks = Array.from(document.querySelectorAll('.hint-block'));
    if (blocks.length !== 3) return;
    const source = currentLanguage === 'en' ? EN_HINT_HTML : hintOriginalHtml;
    for (let index = 0; index < blocks.length; index += 1) {
      if (blocks[index].innerHTML !== source[index]) blocks[index].innerHTML = source[index];
    }
  }

  function localizeCatalogOptions() {
    const exampleSelect = document.getElementById('exampleSelect');
    if (exampleSelect) {
      for (const option of exampleSelect.options) {
        if (currentLanguage === 'en' && EXAMPLE_NAMES[option.value]) {
          if (option.textContent !== EXAMPLE_NAMES[option.value]) option.textContent = EXAMPLE_NAMES[option.value];
        } else if (currentLanguage === 'zh' && EXAMPLE_NAMES[option.value]) {
          const chineseLabel = option.value.split('/').pop().replace(/\.csv$/i, '');
          if (option.textContent !== chineseLabel) option.textContent = chineseLabel;
        }
      }
    }

    const backgroundSelect = document.getElementById('backgroundSelect');
    if (backgroundSelect) {
      for (const option of backgroundSelect.options) {
        const entry = BACKGROUND_CATALOG[option.value];
        if (!entry) continue;
        if (!option.dataset.i18nZhTitle && option.title) option.dataset.i18nZhTitle = option.title;
        if (currentLanguage === 'en') {
          if (option.textContent !== entry[0]) option.textContent = entry[0];
          if (option.title !== entry[1]) option.title = entry[1];
        } else {
          const chineseName = Object.keys(BACKGROUND_NAME_ZH_TO_EN)
            .find((name) => BACKGROUND_NAME_ZH_TO_EN[name] === entry[0]);
          if (chineseName && option.textContent !== chineseName) option.textContent = chineseName;
          if (option.dataset.i18nZhTitle && option.title !== option.dataset.i18nZhTitle) {
            option.title = option.dataset.i18nZhTitle;
          }
        }
      }
    }
  }

  function syncSampleText() {
    const textarea = document.getElementById('csvText');
    if (!textarea) return;
    if (textarea.value === ZH_DEFAULT_SAMPLE || textarea.value === EN_DEFAULT_SAMPLE) {
      textarea.value = currentLanguage === 'en' ? EN_DEFAULT_SAMPLE : ZH_DEFAULT_SAMPLE;
    }
  }

  function ensureLanguageControl() {
    const bar = document.querySelector('header .bar');
    if (!bar || document.getElementById('languageSelect')) return;

    const wrapper = document.createElement('label');
    wrapper.className = 'language-control';
    wrapper.setAttribute('aria-label', 'Language');
    wrapper.title = 'Language';

    const select = document.createElement('select');
    select.id = 'languageSelect';
    select.setAttribute('aria-label', 'Language');
    select.innerHTML = '<option value="en">EN</option><option value="zh">中文</option>';
    select.value = currentLanguage;
    select.addEventListener('change', () => {
      const next = SUPPORTED_LANGUAGES.has(select.value) ? select.value : DEFAULT_LANGUAGE;
      setLanguage(next);
    });
    wrapper.appendChild(select);

    const zoom = bar.querySelector('.zoom-control');
    if (zoom) bar.insertBefore(wrapper, zoom);
    else bar.appendChild(wrapper);

    if (!document.getElementById('i18nStyles')) {
      const style = document.createElement('style');
      style.id = 'i18nStyles';
      style.textContent = `
        .language-control { display:inline-flex; align-items:center; margin-left:8px; }
        .language-control select { font:inherit; min-height:32px; padding:4px 8px; border-radius:7px; }
      `;
      document.head.appendChild(style);
    }
  }

  function applyLanguage() {
    document.documentElement.lang = currentLanguage === 'en' ? 'en' : 'zh-CN';
    document.title = currentLanguage === 'en'
      ? 'Showtime Timeline · Multiscale Timeline Explorer'
      : 'Showtime Timeline · 多尺度历史时间轴';
    ensureLanguageControl();
    const select = document.getElementById('languageSelect');
    if (select) select.value = currentLanguage;
    localizeHints();
    localizeCatalogOptions();
    syncSampleText();
    walkTextNodes(document.body);
    localizeAttributes(document);
  }

  function setLanguage(language) {
    currentLanguage = SUPPORTED_LANGUAGES.has(language) ? language : DEFAULT_LANGUAGE;
    saveLanguage(currentLanguage);
    applyLanguage();
  }

  function queueRefresh() {
    if (refreshQueued) return;
    refreshQueued = true;
    window.setTimeout(() => {
      refreshQueued = false;
      applyLanguage();
    }, 0);
  }

  function patchTextareaSampleSetter() {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (!descriptor?.get || !descriptor?.set || descriptor.set.__showtimeI18nPatched) return;
    const nativeSet = descriptor.set;
    const patchedSet = function patchedTextareaValue(value) {
      let next = value;
      if (this.id === 'csvText' && currentLanguage === 'en' && value === ZH_DEFAULT_SAMPLE) {
        next = EN_DEFAULT_SAMPLE;
      }
      return nativeSet.call(this, next);
    };
    patchedSet.__showtimeI18nPatched = true;
    Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
      ...descriptor,
      set: patchedSet,
    });
  }

  function patchDialogs() {
    const nativeAlert = window.alert?.bind(window);
    const nativeConfirm = window.confirm?.bind(window);
    const nativePrompt = window.prompt?.bind(window);
    if (nativeAlert) window.alert = (message) => nativeAlert(currentLanguage === 'en' ? translateZhText(message) : message);
    if (nativeConfirm) window.confirm = (message) => nativeConfirm(currentLanguage === 'en' ? translateZhText(message) : message);
    if (nativePrompt) window.prompt = (message, defaultValue) => nativePrompt(
      currentLanguage === 'en' ? translateZhText(message) : message,
      defaultValue
    );
  }

  function patchCanvasText() {
    const proto = window.CanvasRenderingContext2D?.prototype;
    if (!proto || proto.fillText.__showtimeI18nPatched) return;
    const nativeFillText = proto.fillText;
    const patchedFillText = function patchedFillText(text, ...args) {
      return nativeFillText.call(this, translateCanvasText(text), ...args);
    };
    patchedFillText.__showtimeI18nPatched = true;
    proto.fillText = patchedFillText;
  }

  function observeUi() {
    if (!document.body || typeof MutationObserver !== 'function') return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' || mutation.type === 'characterData' || mutation.type === 'attributes') {
          queueRefresh();
          break;
        }
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['title', 'aria-label'],
    });
  }

  patchTextareaSampleSetter();
  patchDialogs();
  patchCanvasText();
  applyLanguage();
  observeUi();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.setTimeout(applyLanguage, 0), { once: true });
  } else {
    window.setTimeout(applyLanguage, 0);
  }
})();
