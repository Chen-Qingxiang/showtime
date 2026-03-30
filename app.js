const DEFAULT_CSV_SAMPLE = `# time,title（两列；layer 由文件名决定，左侧文本默认层名“文本”）
# 约定：范围用 ~ 分隔；可用负数表示 BCE（例 -2070~-1600）
# 若无结束（例如 1949~），将自动以“当前年”代替
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

(() => {
  const CURRENT_YEAR = new Date().getFullYear();
  const MIN_PX_PER_YEAR = 1e-8;
  const MAX_PX_PER_YEAR = 1000;
  const ZOOM_SLIDER_MIN = 0;
  const ZOOM_SLIDER_MAX = 1000;
  const DEFAULT_LAYER_NAME = '默认';
  const TEXT_LAYER_NAME = '文本';
  const SIDE_PANEL_STORAGE_KEY = 'showtime:side-collapsed';
  const LAYER_COLOR_PRESETS = [
    '#3ea6ff', '#56c271', '#f7b538', '#ff7a59', '#ff5d8f', '#b27cff',
    '#27c1b8', '#7a8cff', '#9ccc65', '#d4a017', '#c86bfa', '#ef476f',
  ];
  const EXAMPLE_FILES = [
    'examples/中国朝代.csv',
    'examples/皇帝在位时间.csv',
    'examples/宇宙与太阳系演化.csv',
    'examples/地质年代与生命演化.csv',
    'examples/人类史与文明关键节点.csv',
    'examples/文学与思想史.csv',
  ];
  const EXAMPLE_FILE_CONTENTS = {
    'examples/中国朝代.csv': `# time,title[,layer]
# 约定：范围用 ~ 分隔；可用负数表示 BCE（例 -2070~-1600）
# 若无结束（例如 1949~），将自动以“当前年”代替
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
1912~1949,中华民国
1949~,中华人民共和国`,
    'examples/皇帝在位时间.csv': `-221~-210,秦始皇(嬴政)
-210~-207,秦二世(胡亥)

-202~-195,西汉高祖(刘邦)
-195~-188,西汉惠帝(刘盈)
-188~-184,西汉前少帝(刘恭)
-184~-180,西汉后少帝(刘弘)
-180~-157,西汉文帝(刘恒)
-157~-141,西汉景帝(刘启)
-141~-87,西汉武帝(刘彻)
-87~-74,西汉昭帝(刘弗陵)
-74~-74,西汉废帝(刘贺)
-74~-49,西汉宣帝(刘询)
-49~-33,西汉元帝(刘奭)
-33~-7,西汉成帝(刘骜)
-7~1,西汉哀帝(刘欣)
1~6,西汉平帝(刘衎)

9~23,新帝(王莽)

25~57,东汉光武帝(刘秀)
57~75,东汉明帝(刘庄)
75~88,东汉章帝(刘炟)
88~106,东汉和帝(刘肇)
106~106,东汉殇帝(刘隆)
106~125,东汉安帝(刘祜)
125~125,东汉前少帝(刘懿)
125~144,东汉顺帝(刘保)
144~145,东汉冲帝(刘炳)
145~146,东汉质帝(刘缵)
146~168,东汉桓帝(刘志)
168~189,东汉灵帝(刘宏)
189~189,东汉少帝(刘辩)
189~220,东汉献帝(刘协)

220~226,魏文帝(曹丕)
226~239,魏明帝(曹叡)
239~254,魏少帝(曹芳)
254~260,魏废帝(曹髦)
260~265,魏元帝(曹奂)

221~223,蜀汉昭烈帝(刘备)
223~263,蜀汉后主(刘禅)

229~252,吴大帝(孙权)
252~258,吴少帝(孙亮)
258~264,吴景帝(孙休)
264~280,吴末帝(孙皓)

266~290,西晋武帝(司马炎)
290~307,西晋惠帝(司马衷)
307~313,西晋怀帝(司马炽)
313~316,西晋愍帝(司马邺)

317~323,东晋元帝(司马睿)
323~325,东晋明帝(司马绍)
325~342,东晋成帝(司马衍)
342~344,东晋康帝(司马岳)
344~361,东晋穆帝(司马聃)
361~365,东晋哀帝(司马丕)
365~371,东晋海西公(司马奕)
371~372,东晋简文帝(司马昱)
372~396,东晋孝武帝(司马曜)
396~419,东晋安帝(司马德宗)
419~420,东晋恭帝(司马德文)

581~604,隋文帝(杨坚)
604~618,隋炀帝(杨广)
617~618,隋恭帝(杨侑)

618~626,唐高祖(李渊)
626~649,唐太宗(李世民)
649~683,唐高宗(李治)
684~684,唐中宗(李显)
684~690,唐睿宗(李旦)
690~705,武周(武则天)
705~710,唐中宗(李显)
710~712,唐睿宗(李旦)
712~756,唐玄宗(李隆基)
756~762,唐肃宗(李亨)
762~779,唐代宗(李豫)
779~805,唐德宗(李适)
805~806,唐顺宗(李诵)
806~820,唐宪宗(李纯)
820~824,唐穆宗(李恒)
824~827,唐敬宗(李湛)
827~840,唐文宗(李昂)
840~846,唐武宗(李炎)
846~859,唐宣宗(李忱)
859~873,唐懿宗(李漼)
873~888,唐僖宗(李儇)
888~904,唐昭宗(李晔)
904~907,唐哀帝(李柷)

907~912,后梁太祖(朱温)
912~913,后梁末帝(朱友珪)
913~923,后梁末帝(朱友贞)

923~926,后唐庄宗(李存勖)
926~933,后唐明宗(李嗣源)
933~934,后唐闵帝(李从厚)
934~936,后唐末帝(李从珂)

936~942,后晋高祖(石敬瑭)
942~947,后晋出帝(石重贵)

947~948,后汉高祖(刘知远)
948~951,后汉隐帝(刘承祐)

951~954,后周太祖(郭威)
954~959,后周世宗(郭荣)
959~960,后周恭帝(柴宗训)

907~918,前蜀高祖(王建)
918~925,前蜀后主(王衍)

934~935,后蜀高祖(孟知祥)
935~965,后蜀后主(孟昶)

937~943,南唐烈祖(李昪)
943~961,南唐元宗(李璟)
961~976,南唐后主(李煜)

917~942,南汉高祖(刘龑)
942~943,南汉殇帝(刘玢)
943~958,南汉中宗(刘晟)
958~971,南汉后主(刘鋹)

951~954,北汉世祖(刘崇)
954~968,北汉睿宗(刘钧)
968~969,北汉少主(刘继恩)
969~979,北汉后主(刘继元)

916~926,辽太祖(耶律阿保机)
926~947,辽太宗(耶律德光)
947~951,辽世宗(耶律阮)
951~969,辽穆宗(耶律璟)
969~982,辽景宗(耶律贤)
982~1031,辽圣宗(耶律隆绪)
1031~1055,辽兴宗(耶律宗真)
1055~1101,辽道宗(耶律洪基)
1101~1125,辽天祚帝(耶律延禧)

960~976,北宋太祖(赵匡胤)
976~997,北宋太宗(赵光义)
997~1022,北宋真宗(赵恒)
1022~1063,北宋仁宗(赵祯)
1063~1067,北宋英宗(赵曙)
1067~1085,北宋神宗(赵顼)
1085~1100,北宋哲宗(赵煦)
1100~1126,北宋徽宗(赵佶)
1126~1127,北宋钦宗(赵桓)

1127~1162,南宋高宗(赵构)
1162~1189,南宋孝宗(赵昚)
1189~1194,南宋光宗(赵惇)
1194~1224,南宋宁宗(赵扩)
1224~1264,南宋理宗(赵昀)
1264~1274,南宋度宗(赵禥)
1274~1276,南宋恭帝(赵显)
1276~1278,南宋端宗(赵昰)
1278~1279,南宋祥兴帝(赵昺)

1038~1048,西夏景宗(李元昊)
1048~1067,西夏毅宗(李谅祚)
1067~1086,西夏惠宗(李秉常)
1086~1139,西夏崇宗(李乾顺)
1139~1193,西夏仁宗(李仁孝)
1193~1206,西夏桓宗(李纯祐)
1206~1211,西夏襄宗(李安全)
1211~1223,西夏神宗(李德旺)
1223~1226,西夏献宗(李德任)
1226~1227,西夏末帝(李睍)

1115~1123,金太祖(完颜阿骨打)
1123~1135,金太宗(完颜吴乞买)
1135~1149,金熙宗(完颜亶)
1149~1161,金海陵帝(完颜亮)
1161~1189,金世宗(完颜雍)
1189~1208,金章宗(完颜璟)
1208~1213,金卫绍王(完颜永济)
1213~1224,金宣宗(完颜珣)
1224~1234,金哀宗(完颜守绪)

1260~1294,元世祖(忽必烈)
1294~1307,元成宗(铁穆耳)
1307~1311,元武宗(海山)
1311~1320,元仁宗(爱育黎拔力八达)
1320~1323,元英宗(硕德八剌)
1323~1328,元泰定帝(也孙铁木儿)
1328~1328,元天顺帝(阿速吉八)
1328~1332,元文宗(图帖睦尔)
1332~1332,元宁宗(懿璘质班)
1333~1368,元顺帝(妥懽帖睦尔)

1368~1398,明太祖(朱元璋)
1398~1402,明惠帝(朱允炆)
1402~1424,明成祖(朱棣)
1424~1425,明仁宗(朱高炽)
1425~1435,明宣宗(朱瞻基)
1435~1449,明英宗(朱祁镇)
1449~1457,明代宗(朱祁钰)
1457~1464,明英宗(朱祁镇)
1464~1487,明宪宗(朱见深)
1487~1505,明孝宗(朱佑樘)
1505~1521,明武宗(朱厚照)
1521~1567,明世宗(朱厚熜)
1567~1572,明穆宗(朱载垕)
1572~1620,明神宗(朱翊钧)
1620~1620,明光宗(朱常洛)
1620~1627,明熹宗(朱由校)
1627~1644,明思宗(朱由检)

1644~1645,南明弘光帝(朱由崧)
1645~1646,南明隆武帝(朱聿键)
1647~1647,南明绍武帝(朱聿𨮁)
1646~1662,南明永历帝(朱由榔)

1636~1643,清太宗(皇太极)
1643~1661,清世祖(顺治帝)
1661~1722,清圣祖(康熙帝)
1722~1735,清世宗(雍正帝)
1735~1796,清高宗(乾隆帝)
1796~1820,清仁宗(嘉庆帝)
1820~1850,清宣宗(道光帝)
1850~1861,清文宗(咸丰帝)
1861~1875,清穆宗(同治帝)
1875~1908,清德宗(光绪帝)
1908~1912,清宣统帝(溥仪)`,
    'examples/宇宙与太阳系演化.csv': `-13800000000~-13700000000,宇宙大爆炸与暴涨阶段
-13700000000~-13000000000,第一代恒星形成
-13600000000~-13200000000,早期星系形成
-11000000000~-9000000000,银河系盘逐步成形
-4600000000~-4550000000,太阳系形成与原行星盘
-4540000000~-4500000000,地球形成
-4510000000~-4450000000,月球形成（巨碰撞假说）
-4100000000~-3800000000,晚期重轰炸与早期地壳演化`,
    'examples/地质年代与生命演化.csv': `-4600000000~-4000000000,冥古宙
-4000000000~-2500000000,太古宙
-2500000000~-541000000,元古宙
-541000000~-485000000,寒武纪
-485000000~-444000000,奥陶纪
-444000000~-419000000,志留纪
-419000000~-359000000,泥盆纪
-359000000~-299000000,石炭纪
-299000000~-252000000,二叠纪
-252000000~-201000000,三叠纪
-201000000~-145000000,侏罗纪
-145000000~-66000000,白垩纪
-66000000~2300000,古近纪+新近纪
-2300000~,第四纪
-3500000000~-3000000000,可能最早原核生物活动
-2400000000~-2100000000,大氧化事件
-600000000~-540000000,埃迪卡拉生物群
-66000000~-65900000,白垩纪-古近纪灭绝事件`,
    'examples/人类史与文明关键节点.csv': `-300000~-200000,早期智人出现
-12000~-9000,农业革命（新石器化）
-3500~-2500,早期城市与文字体系形成
-776~-1,古代奥运与地中海古典文明时代
-221~-206,秦帝国统一与崩解
-27~476,罗马帝国时期
620~750,伊斯兰扩张早期阶段
960~1279,宋代与东亚经济技术繁荣
1450~1600,大航海与全球连接加速
1760~1840,第一次工业革命
1914~1945,世界大战时代
1947~1991,冷战格局
1990~,互联网与数字化全球化`,
    'examples/文学与思想史.csv': `-800~-200,古希腊哲学与史诗传统
-500~-200,诸子百家与先秦思想
618~907,唐诗高峰
960~1279,宋词与理学发展
1300~1600,文艺复兴与人文主义
1618~1688,科学革命与启蒙前夜
1700~1800,启蒙运动核心世纪
1780~1910,现实主义文学高峰
1917~1949,现代主义与先锋文学浪潮
1945~,后现代与全球文学互鉴`,
  };

  const ui = {};
  let ctx = null;
  let DPR = window.devicePixelRatio || 1;
  let menuLayer = null;
  let colorMenuLayer = null;

  const state = {
    pxPerYear: 2,
    viewStart: -2100,
    laneHeight: 26,
    laneGap: 6,
    layerGap: 18,
    topPad: 40,
    leftPad: 80,
    rightPad: 20,
    data: [],
    byLayer: new Map(),
    layout: new Map(),
    layerOrder: [],
    layerColors: new Map(),
    hiddenLayers: new Set(),
    layers: [],
    layerRects: new Map(),
    drag: { active: false, layer: null, grabDy: 0, mouseY: 0, overlayY: 0, targetIndex: 0 },
  };

  const pointer = { isPanning: false, lastX: 0, lastY: 0 };

  function init() {
    if (!cacheDomHandles()) {
      console.error('[Timeline] DOM 元素未找到，无法初始化组件。');
      return;
    }
    ctx = ui.canvas.getContext('2d');
    if (!ctx) {
      console.error('[Timeline] Canvas 2D 上下文获取失败。');
      return;
    }
    ui.csvText.value = DEFAULT_CSV_SAMPLE;
    restoreSidePanelState();
    bindCanvasInteractions();
    bindUIActions();
    initExampleSelector();
    buildColorSwatches();
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    loadCsvTextarea();
    runSelfTests();
  }

  function cacheDomHandles() {
    ui.canvas = document.getElementById('c');
    ui.fileInput = document.getElementById('file');
    ui.loadButton = document.getElementById('btn-load');
    ui.resetButton = document.getElementById('btn-reset');
    ui.loadExampleButton = document.getElementById('btn-load-example');
    ui.sideDrawerButton = document.getElementById('btn-side-drawer');
    ui.exampleSelect = document.getElementById('exampleSelect');
    ui.zoomSlider = document.getElementById('zoomSlider');
    ui.zoomReadout = document.getElementById('zoomReadout');
    ui.csvText = document.getElementById('csvText');
    ui.mergeSameSource = document.getElementById('mergeSameSource');
    ui.toast = document.getElementById('toast');
    ui.testBadge = document.getElementById('testBadge');
    ui.testPanel = document.getElementById('testPanel');
    ui.testLog = document.getElementById('testLog');
    ui.layerMenu = document.getElementById('layerMenu');
    ui.layerMenuRename = document.getElementById('menuRename');
    ui.layerMenuToggleHidden = document.getElementById('menuToggleHidden');
    ui.layerMenuColor = document.getElementById('menuColor');
    ui.layerMenuDelete = document.getElementById('menuDelete');
    ui.layerMenuCancel = document.getElementById('menuCancel');
    ui.colorMenu = document.getElementById('colorMenu');
    ui.colorSwatches = document.getElementById('colorSwatches');
    ui.colorMenuReset = document.getElementById('menuColorReset');
    ui.colorMenuCancel = document.getElementById('menuColorCancel');
    return !!ui.canvas && !!ui.csvText;
  }

  function parseYearToken(token) {
    if (token == null) return null;
    let s = String(token).trim();
    if (!s) return null;
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
    const upper = s.toUpperCase();

    let match = upper.match(/^(\d+)\s*(BC|BCE)$/i);
    if (match) {
      const year = parseInt(match[1], 10);
      return -(year - 1);
    }

    match = s.match(/^(?:公元)?前\s*(\d+)/i);
    if (match) {
      const year = parseInt(match[1], 10);
      return -(year - 1);
    }

    if (/^-?\d+$/.test(s)) return parseInt(s, 10);
    return null;
  }

  function parseTimeField(field) {
    const text = String(field).trim();
    if (!text) return null;
    const yearToken = '(?:-?\\d+|\\d+\\s*(?:BC|BCE)|(?:公元)?前\\s*\\d+)';
    const rangePattern = new RegExp(
      '^\\s*(' + yearToken + ')\\s*(?:~|–|—|－|-|〜|～|至|到)\\s*(' + yearToken + ')?\\s*$',
      'i'
    );
    const match = text.match(rangePattern);
    if (match) {
      const start = parseYearToken(match[1]);
      let end = parseYearToken(match[2]);
      if (start == null) return null;
      if (end == null) end = CURRENT_YEAR;
      return start <= end ? { start, end } : { start: end, end: start };
    }

    const year = parseYearToken(text);
    if (year == null) return null;
    return { start: year, end: year };
  }

  function parseCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ',' && !inQuotes) {
        fields.push(current);
        current = '';
        continue;
      }
      current += ch;
    }

    fields.push(current);
    return fields.map((field) => field.trim());
  }

  function parseCSV(text, layerName = DEFAULT_LAYER_NAME) {
    let source = text || '';
    if (source && source.charCodeAt(0) === 0xfeff) source = source.slice(1);

    const rows = [];
    for (const rawLine of source.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const fields = parseCSVLine(line);
      const time = fields[0] ?? '';
      if (!time || time.startsWith('#')) continue;
      const title = fields.length > 1 ? fields.slice(1).join(',').trim() : '';
      rows.push({ time: time.trim(), title, layer: layerName });
    }
    return rows;
  }

  function basenameWithoutExt(path) {
    const file = String(path).split('/').pop() || path;
    return file.replace(/\.[^.]+$/, '');
  }

  function resolveLayerName(baseLayerName) {
    const base = baseLayerName || DEFAULT_LAYER_NAME;
    if (!ui.mergeSameSource || ui.mergeSameSource.checked) return base;
    const used = new Set(state.data.map((event) => event.layer));
    if (!used.has(base)) return base;
    let index = 2;
    let candidate = `${base} #${index}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${base} #${index}`;
    }
    return candidate;
  }

  function rowsToEvents(rows) {
    const out = [];
    for (const row of rows) {
      const range = parseTimeField(row.time);
      if (!range) continue;
      out.push({
        id: Math.random().toString(36).slice(2),
        title: row.title || '(未命名)',
        start: range.start,
        end: range.end,
        layer: row.layer || DEFAULT_LAYER_NAME,
      });
    }
    return out;
  }

  function groupBy(items, keyFn) {
    const grouped = new Map();
    for (const item of items) {
      const key = keyFn(item);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    }
    return grouped;
  }

  function layoutLanes(events) {
    const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end);
    const lanes = [];
    for (const event of sorted) {
      let laneIndex = lanes.findIndex((end) => end <= event.start);
      if (laneIndex === -1) {
        laneIndex = lanes.length;
        lanes.push(event.end);
      } else {
        lanes[laneIndex] = event.end;
      }
      event.__lane = laneIndex;
    }
    return { laneCount: lanes.length };
  }

  function trimNumber(value) {
    if (!Number.isFinite(value)) return String(value);
    if (Math.abs(value) >= 100 || Number.isInteger(value)) return String(Math.round(value));
    return Number(value.toFixed(2)).toString();
  }

  function formatLargeYearValue(absYear) {
    if (absYear >= 1e8) return `${trimNumber(absYear / 1e8)}亿`;
    if (absYear >= 1e4) return `${trimNumber(absYear / 1e4)}万`;
    return String(Math.round(absYear));
  }

  function fmtYear(year, options = {}) {
    const abs = Math.abs(year);
    const compactThreshold = options.compactThreshold ?? 1e4;
    const body = abs >= compactThreshold ? formatLargeYearValue(abs) : String(Math.round(abs));
    if (year < 0) return `${body} BC`;
    if (options.withCE) return `${body} CE`;
    return body;
  }

  function fmtYearForAxis(year) {
    return fmtYear(year, { compactThreshold: 1e4 });
  }

  function displayRange(start, end) {
    return `${fmtYear(start, { compactThreshold: 1e4 })}~${fmtYear(end, { compactThreshold: 1e4 })}`;
  }

  function formatSpanYears(years) {
    if (!Number.isFinite(years) || years <= 0) return '0 年';
    const abs = Math.abs(years);
    if (abs >= 1e9) return `${trimNumber(abs / 1e9)} 十亿年`;
    if (abs >= 1e8) return `${trimNumber(abs / 1e8)} 亿年`;
    if (abs >= 1e4) return `${trimNumber(abs / 1e4)} 万年`;
    return `${trimNumber(abs)} 年`;
  }

  function isLayerHidden(layer) {
    return state.hiddenLayers.has(layer);
  }

  function getLayerLabelText(layer, options = {}) {
    return options.hidden ? `${layer} [已隐藏]` : layer;
  }

  function wrapLayerLabelLines(text, maxLines = 2) {
    if (!ctx) return [String(text || '')];
    const source = String(text || '').trim();
    if (!source) return [''];
    const maxWidth = Math.max(24, state.leftPad - 18);
    ctx.save();
    ctx.font = '13px system-ui, sans-serif';
    if (ctx.measureText(source).width <= maxWidth) {
      ctx.restore();
      return [source];
    }
    const lines = [];
    let current = '';
    let index = 0;
    while (index < source.length && lines.length < maxLines) {
      const ch = source[index];
      const next = current + ch;
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current);
        current = '';
        continue;
      }
      current = next;
      index += 1;
    }
    if (current && lines.length < maxLines) lines.push(current);
    if (index < source.length && lines.length) {
      const ellipsis = '...';
      let last = lines[lines.length - 1];
      while (last && ctx.measureText(last + ellipsis).width > maxWidth) {
        last = last.slice(0, -1);
      }
      lines[lines.length - 1] = last ? `${last}${ellipsis}` : ellipsis;
    }
    ctx.restore();
    return lines.length ? lines : [''];
  }

  function getLayerHeight(layer) {
    const hidden = isLayerHidden(layer);
    const labelLines = wrapLayerLabelLines(getLayerLabelText(layer, { hidden }), hidden ? 1 : 4);
    const labelHeight = labelLines.length * 15 + 4;
    if (hidden) return Math.max(28, labelHeight);
    const { laneCount } = state.layout.get(layer) || { laneCount: 0 };
    const eventHeight = laneCount * (state.laneHeight + state.laneGap) + 6;
    return Math.max(eventHeight, labelHeight);
  }

  function getContentHeight() {
    let total = state.topPad + 24;
    for (const layer of state.layerOrder) {
      total += getLayerHeight(layer) + state.layerGap;
    }
    return total;
  }

  function getMinimumCanvasHeight() {
    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
    return Math.max(480, window.innerHeight - headerHeight);
  }

  function syncCanvasSize() {
    const targetHeight = Math.max(getMinimumCanvasHeight(), getContentHeight());
    ui.canvas.style.height = `${targetHeight}px`;
    const rect = ui.canvas.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    ui.canvas.width = Math.floor(rect.width * DPR);
    ui.canvas.height = Math.floor(rect.height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function resizeCanvas() {
    syncCanvasSize();
    draw();
  }

  function setSidePanelCollapsed(collapsed) {
    document.body.classList.toggle('side-collapsed', collapsed);
    if (ui.sideDrawerButton) {
      ui.sideDrawerButton.setAttribute('aria-label', collapsed ? '显示左栏' : '隐藏左栏');
      ui.sideDrawerButton.title = collapsed ? '显示左栏' : '隐藏左栏';
    }
    try {
      window.localStorage.setItem(SIDE_PANEL_STORAGE_KEY, collapsed ? '1' : '0');
    } catch {}
    resizeCanvas();
  }

  function restoreSidePanelState() {
    let collapsed = false;
    try {
      collapsed = window.localStorage.getItem(SIDE_PANEL_STORAGE_KEY) === '1';
    } catch {}
    document.body.classList.toggle('side-collapsed', collapsed);
    if (ui.sideDrawerButton) {
      ui.sideDrawerButton.setAttribute('aria-label', collapsed ? '显示左栏' : '隐藏左栏');
      ui.sideDrawerButton.title = collapsed ? '显示左栏' : '隐藏左栏';
    }
  }

  function yearToX(year) {
    return state.leftPad + (year - state.viewStart) * state.pxPerYear;
  }

  function xToYear(x) {
    return state.viewStart + (x - state.leftPad) / state.pxPerYear;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getDefaultColorForLayer(layer) {
    let hash = 0;
    for (let i = 0; i < layer.length; i += 1) {
      hash = (hash * 131 + layer.charCodeAt(i)) >>> 0;
    }
    return `hsl(${hash % 360} 60% 55% / 0.85)`;
  }

  function pickColorForLayer(layer) {
    if (!state.layerColors.has(layer)) {
      state.layerColors.set(layer, getDefaultColorForLayer(layer));
    }
    return state.layerColors.get(layer);
  }

  function normalizeColorForPicker(color) {
    const value = String(color || '').trim();
    const hexMatch = value.match(/^#([0-9a-f]{6})$/i);
    if (hexMatch) return `#${hexMatch[1].toLowerCase()}`;
    const rgbMatch = value.match(/^rgba?\(\s*(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s*\/\s*[\d.]+)?\s*\)$/i)
      || value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i);
    if (!rgbMatch) return '#3ea6ff';
    const [r, g, b] = rgbMatch.slice(1, 4).map((part) => Math.max(0, Math.min(255, Number(part) || 0)));
    return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
  }

  function buildColorSwatches() {
    if (!ui.colorSwatches) return;
    ui.colorSwatches.innerHTML = '';
    for (const color of LAYER_COLOR_PRESETS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color-swatch';
      button.title = color;
      button.setAttribute('aria-label', `选择颜色 ${color}`);
      button.dataset.color = color;
      button.style.background = color;
      ui.colorSwatches.appendChild(button);
    }
  }

  function roundRect(context, x, y, w, h, r) {
    const radius = Math.min(r, h / 2, w / 2);
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + w, y, x + w, y + h, radius);
    context.arcTo(x + w, y + h, x, y + h, radius);
    context.arcTo(x, y + h, x, y, radius);
    context.arcTo(x, y, x + w, y, radius);
    context.closePath();
  }

  function drawSingleLayer(layer, layerTop, options = {}) {
    const width = ui.canvas.clientWidth;
    const events = state.byLayer.get(layer) || [];
    const layerHeight = getLayerHeight(layer);
    const color = pickColorForLayer(layer);
    const ghost = options.ghost || false;
    const alpha = options.alpha ?? 1;
    const hidden = isLayerHidden(layer) && !ghost;
    const labelLines = wrapLayerLabelLines(getLayerLabelText(layer, { hidden }), hidden ? 1 : 4);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ghost ? '#0b1523' : '#0e131b';
    ctx.fillRect(state.leftPad, layerTop, width - state.leftPad - state.rightPad, layerHeight);

    ctx.fillStyle = ghost ? '#84b6ff' : '#6c7f99';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    for (let index = 0; index < labelLines.length; index += 1) {
      ctx.fillText(labelLines[index], state.leftPad - 10, layerTop + 2 + index * 15);
    }

    if (hidden) {
      ctx.fillStyle = '#4f627d';
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('右键图层名称可重新显示', state.leftPad + 12, layerTop + 6);
      ctx.restore();
      return;
    }

    for (const event of events) {
      const top = layerTop + 3 + event.__lane * (state.laneHeight + state.laneGap);
      const x1 = yearToX(event.start);
      const x2 = yearToX(event.end);
      const isPoint = event.start === event.end;

      if (x2 < 0 || x1 > width) continue;

      if (isPoint) {
        const cx = clamp(x1, state.leftPad, width - state.rightPad);
        const cy = top + (state.laneHeight - 2) / 2;
        const radius = Math.min(6, (state.laneHeight - 2) / 2);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1.2, radius * 0.45);
        ctx.strokeStyle = 'rgba(8, 12, 18, 0.85)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(0.5, radius - 0.8), 0, Math.PI * 2);
        ctx.lineWidth = Math.max(0.8, radius * 0.35);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.stroke();

        ctx.fillStyle = 'white';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${event.title}  ${displayRange(event.start, event.end)}`, cx + radius + 8, cy);
        continue;
      }

      const rx = Math.max(x1, state.leftPad);
      const rw = Math.min(x2, width - state.rightPad) - rx;
      if (rw <= 1) continue;

      ctx.fillStyle = color;
      roundRect(ctx, rx, top, rw, state.laneHeight - 2, 6);
      ctx.fill();

      if (rw > 40) {
        ctx.save();
        roundRect(ctx, rx, top, rw, state.laneHeight - 2, 6);
        ctx.clip();
        ctx.fillStyle = 'white';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${event.title}  ${displayRange(event.start, event.end)}`, rx + 10, top + (state.laneHeight - 2) / 2);
        ctx.restore();
      }
    }

    if (ghost) {
      ctx.strokeStyle = '#5fa8ff';
      ctx.setLineDash([6, 6]);
      ctx.lineWidth = 2;
      ctx.strokeRect(state.leftPad, layerTop, width - state.leftPad - state.rightPad, layerHeight);
    }

    ctx.restore();
  }

  function chooseTickStep(pxPerYear) {
    const target = 110 / pxPerYear;
    const bases = [1, 2, 5];
    let power = 1;
    while (true) {
      for (const base of bases) {
        const step = base * power;
        if (step >= target) return step;
      }
      power *= 10;
    }
  }

  function drawAxis(width) {
    const y = state.topPad - 8;
    ctx.strokeStyle = '#2b3546';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    const step = chooseTickStep(state.pxPerYear);
    const startYear = Math.floor(xToYear(0) / step) * step;
    const endYear = Math.ceil(xToYear(width) / step) * step;

    ctx.fillStyle = '#9fb1c9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '12px system-ui, sans-serif';

    for (let value = startYear; value <= endYear; value += step) {
      const x = yearToX(value);
      ctx.strokeStyle = '#253045';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 6);
      ctx.stroke();
      ctx.fillText(fmtYearForAxis(value), x, y - 8);
    }
  }

  function draw() {
    const width = ui.canvas.clientWidth;
    const height = ui.canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);

    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#0a0d12');
    gradient.addColorStop(1, '#0a0c10');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    drawAxis(width);

    state.layerRects.clear();
    const boxes = [];
    let cursor = state.topPad;
    for (const layer of state.layerOrder) {
      const layerHeight = getLayerHeight(layer);
      boxes.push({ layer, top: cursor, height: layerHeight });
      state.layerRects.set(layer, { top: cursor, height: layerHeight });
      cursor += layerHeight + state.layerGap;
    }

    if (state.drag.active && state.drag.layer) {
      const dragged = state.drag.layer;
      const others = boxes.filter((box) => box.layer !== dragged);
      for (const box of others) drawSingleLayer(box.layer, box.top);

      const center = state.drag.overlayY + getLayerHeight(dragged) / 2;
      let index = 0;
      for (const box of others) {
        const mid = box.top + box.height / 2;
        if (center > mid) index += 1;
      }
      state.drag.targetIndex = index;

      let lineY = state.topPad;
      if (others.length > 0) {
        if (index === 0) {
          lineY = others[0].top - state.layerGap / 2;
        } else if (index >= others.length) {
          const last = others[others.length - 1];
          lineY = last.top + last.height + state.layerGap / 2;
        } else {
          lineY = others[index].top - state.layerGap / 2;
        }
      }

      ctx.save();
      ctx.strokeStyle = '#5fa8ff';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, lineY);
      ctx.lineTo(width, lineY);
      ctx.stroke();
      ctx.restore();

      drawSingleLayer(dragged, state.drag.overlayY, { ghost: true, alpha: 0.95 });
      return;
    }

    for (const box of boxes) drawSingleLayer(box.layer, box.top);
  }

  function pxPerYearToSliderValue(pxPerYear) {
    const minLog = Math.log(MIN_PX_PER_YEAR);
    const maxLog = Math.log(MAX_PX_PER_YEAR);
    const clamped = clamp(pxPerYear, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
    const ratio = (Math.log(clamped) - minLog) / (maxLog - minLog);
    return Math.round(ZOOM_SLIDER_MIN + ratio * (ZOOM_SLIDER_MAX - ZOOM_SLIDER_MIN));
  }

  function sliderValueToPxPerYear(value) {
    const minLog = Math.log(MIN_PX_PER_YEAR);
    const maxLog = Math.log(MAX_PX_PER_YEAR);
    const ratio = (value - ZOOM_SLIDER_MIN) / (ZOOM_SLIDER_MAX - ZOOM_SLIDER_MIN);
    return Math.exp(minLog + ratio * (maxLog - minLog));
  }

  function updateZoomReadout() {
    if (!ui.zoomReadout) return;
    if (state.pxPerYear >= 1) {
      ui.zoomReadout.textContent = `${trimNumber(state.pxPerYear)} px / 年`;
      return;
    }
    ui.zoomReadout.textContent = `${formatSpanYears(1 / state.pxPerYear)} / px`;
  }

  function syncSlider() {
    if (!ui.zoomSlider) return;
    ui.zoomSlider.value = String(pxPerYearToSliderValue(state.pxPerYear));
    updateZoomReadout();
  }

  function applyZoom(pivotX, factor) {
    const yearAtPivot = xToYear(pivotX);
    const newPx = clamp(state.pxPerYear * factor, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
    state.pxPerYear = newPx;
    state.viewStart = yearAtPivot - (pivotX - state.leftPad) / newPx;
    syncSlider();
    draw();
  }

  function getDataBounds() {
    if (!state.data.length) return null;
    return {
      minYear: Math.min(...state.data.map((event) => event.start)),
      maxYear: Math.max(...state.data.map((event) => event.end)),
    };
  }

  function setViewToSpan(spanYears, centerYear) {
    const width = ui.canvas.clientWidth - state.leftPad - state.rightPad;
    if (width <= 0 || !Number.isFinite(spanYears) || spanYears <= 0) return;
    state.pxPerYear = clamp(width / spanYears, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
    state.viewStart = centerYear - width / state.pxPerYear / 2;
    syncSlider();
    draw();
  }

  function rebuildFromState() {
    state.byLayer = groupBy(state.data, (event) => event.layer || DEFAULT_LAYER_NAME);
    const present = Array.from(state.byLayer.keys());
    if (!state.layerOrder.length) {
      state.layerOrder = present.slice();
    } else {
      for (const layer of present) {
        if (!state.layerOrder.includes(layer)) state.layerOrder.push(layer);
      }
      state.layerOrder = state.layerOrder.filter((layer) => present.includes(layer));
    }
    const nextColors = new Map();
    for (const layer of present) {
      nextColors.set(layer, state.layerColors.get(layer) || getDefaultColorForLayer(layer));
    }
    state.layerColors = nextColors;
    state.hiddenLayers = new Set(Array.from(state.hiddenLayers).filter((layer) => present.includes(layer)));
    state.layers = state.layerOrder.slice();
    state.layout = new Map();
    for (const layer of state.layerOrder) {
      state.layout.set(layer, layoutLanes(state.byLayer.get(layer) || []));
    }
    syncCanvasSize();
  }

  function resetView() {
    const bounds = getDataBounds();
    if (!bounds) return;
    const width = ui.canvas.clientWidth - state.leftPad - state.rightPad;
    const years = bounds.maxYear - bounds.minYear || 10;
    state.pxPerYear = clamp(width / years, MIN_PX_PER_YEAR, MAX_PX_PER_YEAR);
    state.viewStart = bounds.minYear - 10 / state.pxPerYear;
    syncSlider();
    draw();
  }

  function ingest(events) {
    state.data = state.data.concat(events);
    rebuildFromState();
    resetView();
  }

  function deleteLayer(layer) {
    if (!layer) return false;
    const before = state.data.length;
    state.data = state.data.filter((event) => event.layer !== layer);
    state.layerOrder = state.layerOrder.filter((name) => name !== layer);
    state.layerColors.delete(layer);
    state.hiddenLayers.delete(layer);
    state.layers = state.layerOrder.slice();
    rebuildFromState();
    draw();
    return state.data.length < before;
  }

  function renameLayer(oldName, newName) {
    const from = String(oldName || '').trim();
    const to = String(newName || '').trim();
    if (!from || !to || from === to) return false;
    if (state.layerOrder.includes(to)) return null;
    let changed = false;
    for (const event of state.data) {
      if (event.layer === from) {
        event.layer = to;
        changed = true;
      }
    }
    if (!changed) return false;
    state.layerOrder = state.layerOrder.map((layer) => (layer === from ? to : layer));
    if (state.layerColors.has(from)) {
      const color = state.layerColors.get(from);
      state.layerColors.delete(from);
      state.layerColors.set(to, color);
    }
    if (state.hiddenLayers.delete(from)) state.hiddenLayers.add(to);
    rebuildFromState();
    draw();
    return true;
  }

  function setLayerColor(layer, color) {
    if (!layer || !state.layerOrder.includes(layer) || !color) return false;
    state.layerColors.set(layer, color);
    draw();
    return true;
  }

  function toggleLayerHidden(layer) {
    if (!layer || !state.layerOrder.includes(layer)) return false;
    if (state.hiddenLayers.has(layer)) {
      state.hiddenLayers.delete(layer);
    } else {
      state.hiddenLayers.add(layer);
    }
    rebuildFromState();
    draw();
    return true;
  }

  function toast(message) {
    if (!ui.toast) return;
    ui.toast.textContent = message;
    ui.toast.style.display = 'block';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      ui.toast.style.display = 'none';
    }, 1500);
  }

  function initExampleSelector() {
    if (!ui.exampleSelect) return;
    ui.exampleSelect.innerHTML = '';
    for (const file of EXAMPLE_FILES) {
      const option = document.createElement('option');
      option.value = file;
      option.textContent = basenameWithoutExt(file);
      ui.exampleSelect.appendChild(option);
    }
  }

  async function loadExampleFile(path) {
    let text = '';
    try {
      const response = await fetch(encodeURI(path), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    } catch (error) {
      if (!(path in EXAMPLE_FILE_CONTENTS)) throw error;
      text = EXAMPLE_FILE_CONTENTS[path];
    }
    const layerName = resolveLayerName(basenameWithoutExt(path));
    const rows = parseCSV(text, layerName);
    const events = rowsToEvents(rows);
    if (!events.length) throw new Error('示例文件中未解析到有效事件');
    ingest(events);
  }

  function bindCanvasInteractions() {
    ui.canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    ui.canvas.addEventListener('mouseleave', handleMouseLeave);
    ui.canvas.addEventListener('wheel', handleWheel, { passive: false });
    ui.canvas.addEventListener('dblclick', resetView);
    ui.canvas.addEventListener('contextmenu', handleContextMenu);

    ui.layerMenuRename?.addEventListener('click', handleMenuRename);
    ui.layerMenuToggleHidden?.addEventListener('click', handleMenuToggleHidden);
    ui.layerMenuColor?.addEventListener('click', handleMenuColor);
    ui.layerMenuDelete?.addEventListener('click', handleMenuDelete);
    ui.layerMenuCancel?.addEventListener('click', hideLayerMenu);
    ui.colorSwatches?.addEventListener('click', handleColorSwatchClick);
    ui.colorMenuReset?.addEventListener('click', handleColorReset);
    ui.colorMenuCancel?.addEventListener('click', hideColorMenu);
    window.addEventListener('click', (event) => {
      if (ui.layerMenu && !ui.layerMenu.contains(event.target)) hideLayerMenu();
      if (ui.colorMenu && !ui.colorMenu.contains(event.target)) hideColorMenu();
    });
    ui.layerMenu?.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    ui.colorMenu?.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        hideLayerMenu();
        hideColorMenu();
      }
      if ((event.key === '\\' || event.key === '|') && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const tag = event.target?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable) return;
        event.preventDefault();
        setSidePanelCollapsed(!document.body.classList.contains('side-collapsed'));
      }
    });
  }

  function bindUIActions() {
    ui.fileInput?.addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      const layerName = resolveLayerName((file.name || '文件').replace(/\.[^.]+$/, ''));
      const rows = parseCSV(text, layerName);
      const events = rowsToEvents(rows);
      if (!events.length) {
        alert(
          '未解析到任何事件。\n请检查：\n• CSV 两列 time,title；\n• 标题中若含逗号，请用双引号包裹；\n• 区间分隔符可用 ~ / - / — / 至 等；\n• 年份可写 -221 或 221BC / 公元前221。'
        );
        return;
      }
      ingest(events);
      event.target.value = '';
    });

    ui.loadButton?.addEventListener('click', loadCsvTextarea);
    ui.resetButton?.addEventListener('click', resetView);

    ui.loadExampleButton?.addEventListener('click', async () => {
      const path = ui.exampleSelect?.value;
      if (!path) return;
      try {
        await loadExampleFile(path);
        toast(`已加载示例：${basenameWithoutExt(path)}`);
      } catch (error) {
        alert(`加载示例失败：${path}\n${error?.message || error}`);
      }
    });

    ui.sideDrawerButton?.addEventListener('click', () => {
      setSidePanelCollapsed(!document.body.classList.contains('side-collapsed'));
    });

    ui.zoomSlider?.addEventListener('input', (event) => {
      const width = ui.canvas.getBoundingClientRect().width;
      const centerX = width / 2;
      const yearAtCenter = xToYear(centerX);
      state.pxPerYear = sliderValueToPxPerYear(parseFloat(event.target.value));
      state.viewStart = yearAtCenter - (centerX - state.leftPad) / state.pxPerYear;
      updateZoomReadout();
      draw();
    });

    document.querySelectorAll('[data-range-years]').forEach((button) => {
      button.addEventListener('click', () => {
        const bounds = getDataBounds();
        if (!bounds) return;
        const raw = button.getAttribute('data-range-years');
        if (raw === 'auto') {
          resetView();
          return;
        }
        const spanYears = Number(raw);
        if (!Number.isFinite(spanYears) || spanYears <= 0) return;
        const centerYear = (bounds.minYear + bounds.maxYear) / 2;
        setViewToSpan(spanYears, centerYear);
      });
    });
  }

  function loadCsvTextarea() {
    const rows = parseCSV(ui.csvText.value, resolveLayerName(TEXT_LAYER_NAME));
    const events = rowsToEvents(rows);
    if (!events.length) {
      alert('左侧文本未解析出事件。\n示例：-2070~-1600,夏');
      return;
    }
    ingest(events);
  }

  function handleMouseDown(event) {
    hideLayerMenu();
    const rect = ui.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x < state.leftPad) {
      for (const [layer, box] of state.layerRects) {
        if (y >= box.top && y <= box.top + box.height) {
          state.drag.active = true;
          state.drag.layer = layer;
          state.drag.grabDy = y - box.top;
          state.drag.mouseY = y;
          state.drag.overlayY = box.top;
          ui.canvas.style.cursor = 'grabbing';
          draw();
          return;
        }
      }
    }
    pointer.isPanning = true;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    ui.canvas.style.cursor = 'grabbing';
  }

  function handleMouseMove(event) {
    const rect = ui.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (state.drag.active && state.drag.layer) {
      state.drag.mouseY = y;
      state.drag.overlayY = y - state.drag.grabDy;
      draw();
      return;
    }

    if (pointer.isPanning) {
      const dx = event.clientX - pointer.lastX;
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      state.viewStart -= dx / state.pxPerYear;
      draw();
      return;
    }

    if (x < state.leftPad) {
      for (const [, box] of state.layerRects) {
        if (y >= box.top && y <= box.top + box.height) {
          ui.canvas.style.cursor = 'grab';
          return;
        }
      }
    }
    ui.canvas.style.cursor = 'default';
  }

  function handleMouseUp() {
    ui.canvas.style.cursor = 'default';
    pointer.isPanning = false;
    if (!state.drag.active || !state.drag.layer) return;

    const layer = state.drag.layer;
    const currentIndex = state.layerOrder.indexOf(layer);
    const order = state.layerOrder.slice();
    order.splice(currentIndex, 1);
    let target = state.drag.targetIndex;
    if (target > order.length) target = order.length;
    if (target < 0) target = 0;
    order.splice(target, 0, layer);
    state.layerOrder = order;
    state.layers = state.layerOrder.slice();
    state.drag = { active: false, layer: null, grabDy: 0, mouseY: 0, overlayY: 0, targetIndex: 0 };
    draw();
  }

  function handleMouseLeave() {
    pointer.isPanning = false;
    ui.canvas.style.cursor = 'default';
    if (!state.drag.active) return;
    state.drag = { active: false, layer: null, grabDy: 0, mouseY: 0, overlayY: 0, targetIndex: 0 };
    draw();
  }

  function handleWheel(event) {
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = ui.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const centerX = rect.width / 2;
    const pivotX = event.shiftKey ? centerX : mouseX;
    const speed = event.ctrlKey || event.metaKey ? 4 : 1;
    const factor = Math.pow(1.0015, -event.deltaY * speed);
    applyZoom(pivotX, factor);
  }

  function showLayerMenu(x, y, layer) {
    if (!ui.layerMenu) return;
    hideColorMenu();
    menuLayer = layer;
    const pad = 8;
    const width = 196;
    if (ui.layerMenuToggleHidden) {
      ui.layerMenuToggleHidden.textContent = isLayerHidden(layer) ? '显示该层' : '隐藏该层';
      ui.layerMenuToggleHidden.className = isLayerHidden(layer) ? 'secondary' : '';
    }
    const height = Math.min(ui.layerMenu.offsetHeight || 184, window.innerHeight - pad * 2);
    ui.layerMenu.style.left = `${Math.min(x, window.innerWidth - width - pad)}px`;
    ui.layerMenu.style.top = `${Math.min(y, window.innerHeight - height - pad)}px`;
    ui.layerMenu.style.display = 'block';
  }

  function hideLayerMenu() {
    if (!ui.layerMenu) return;
    ui.layerMenu.style.display = 'none';
    menuLayer = null;
  }

  function showColorMenu(x, y, layer) {
    if (!ui.colorMenu) return;
    colorMenuLayer = layer;
    const pad = 8;
    const width = 228;
    const height = 178;
    ui.colorMenu.style.left = `${Math.min(x, window.innerWidth - width - pad)}px`;
    ui.colorMenu.style.top = `${Math.min(y, window.innerHeight - height - pad)}px`;
    ui.colorMenu.style.display = 'block';
  }

  function hideColorMenu() {
    if (!ui.colorMenu) return;
    ui.colorMenu.style.display = 'none';
    colorMenuLayer = null;
  }

  function handleContextMenu(event) {
    const rect = ui.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    if (x >= state.leftPad) return;

    for (const [layer, box] of state.layerRects) {
      if (y >= box.top && y <= box.top + box.height) {
        event.preventDefault();
        showLayerMenu(event.clientX, event.clientY, layer);
        return;
      }
    }
  }

  function handleMenuDelete(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!menuLayer) {
      hideLayerMenu();
      return;
    }
    const target = menuLayer;
    const ok = confirm(`确认删除图层 “${target}” 吗？\n（该层包含的事件也会被移除）`);
    hideLayerMenu();
    if (!ok) return;
    const removed = deleteLayer(target);
    toast(removed ? `已删除图层：${target}` : `未找到图层：${target}`);
  }

  function handleMenuRename(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!menuLayer) {
      hideLayerMenu();
      return;
    }
    const oldName = menuLayer;
    hideLayerMenu();
    const input = prompt('请输入新的图层名称：', oldName);
    if (input == null) return;
    const newName = input.trim();
    if (!newName) {
      toast('图层名称不能为空');
      return;
    }
    const renamed = renameLayer(oldName, newName);
    if (renamed === null) {
      toast(`图层名已存在：${newName}`);
      return;
    }
    if (!renamed) {
      toast(`未能重命名图层：${oldName}`);
      return;
    }
    toast(`已重命名图层：${oldName} → ${newName}`);
  }

  function handleMenuToggleHidden(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!menuLayer) {
      hideLayerMenu();
      return;
    }
    const target = menuLayer;
    const nextHidden = !isLayerHidden(target);
    hideLayerMenu();
    const changed = toggleLayerHidden(target);
    if (!changed) {
      toast(`未找到图层：${target}`);
      return;
    }
    toast(nextHidden ? `已隐藏图层：${target}` : `已显示图层：${target}`);
  }

  function handleMenuColor(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!menuLayer) {
      hideLayerMenu();
      return;
    }
    const target = menuLayer;
    const rect = ui.layerMenu?.getBoundingClientRect();
    hideLayerMenu();
    showColorMenu(rect?.right ?? event.clientX, rect?.top ?? event.clientY, target);
  }

  function handleColorSwatchClick(event) {
    const button = event.target.closest('.color-swatch');
    if (!button || !colorMenuLayer) return;
    const layer = colorMenuLayer;
    const changed = setLayerColor(layer, button.dataset.color);
    hideColorMenu();
    if (changed) toast(`已更新图层颜色：${layer}`);
  }

  function handleColorReset(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!colorMenuLayer) {
      hideColorMenu();
      return;
    }
    const layer = colorMenuLayer;
    state.layerColors.set(layer, getDefaultColorForLayer(layer));
    hideColorMenu();
    draw();
    toast(`已恢复默认颜色：${layer}`);
  }

  function snapshotState() {
    return {
      data: state.data.slice(),
      layerOrder: state.layerOrder.slice(),
      layerColors: new Map(state.layerColors),
      hiddenLayers: new Set(state.hiddenLayers),
      byLayer: new Map(state.byLayer),
      layout: new Map(state.layout),
      pxPerYear: state.pxPerYear,
      viewStart: state.viewStart,
    };
  }

  function restoreState(backup) {
    state.data = backup.data;
    state.layerOrder = backup.layerOrder;
    state.layerColors = backup.layerColors;
    state.hiddenLayers = backup.hiddenLayers;
    state.layers = state.layerOrder.slice();
    state.byLayer = backup.byLayer;
    state.layout = backup.layout;
    state.pxPerYear = backup.pxPerYear;
    state.viewStart = backup.viewStart;
    syncSlider();
    draw();
  }

  function restorePartial(backup) {
    state.pxPerYear = backup.pxPerYear;
    state.viewStart = backup.viewStart;
    syncSlider();
    draw();
  }

  function runSelfTests() {
    const results = [];
    function add(name, fn) {
      try {
        results.push({ name, ok: !!fn() });
      } catch (error) {
        results.push({ name, ok: false, err: String(error) });
      }
    }

    add('parseYearToken: -221 → -221', () => parseYearToken(-221) === -221);
    add('parseYearToken: 221BC → -220', () => parseYearToken('221BC') === -220);
    add('parseYearToken: 公元前221 → -220', () => parseYearToken('公元前221') === -220);
    add('parseTimeField: -2070~-1600', () => {
      const range = parseTimeField('-2070~-1600');
      return range.start === -2070 && range.end === -1600;
    });
    add('parseTimeField: 221BC-207BC', () => {
      const range = parseTimeField('221BC-207BC');
      return range.start === -220 && range.end === -206;
    });
    add('parseTimeField: single 1054', () => {
      const range = parseTimeField('1054');
      return range.start === 1054 && range.end === 1054;
    });
    add('parseTimeField: open interval 1949~', () => {
      const range = parseTimeField('1949~');
      return range.start === 1949 && range.end === CURRENT_YEAR;
    });
    add('parseCSV: split by \\n', () => parseCSV('1~2,A\n3~4,B', 'L').length === 2);
    add('parseCSV: quoted comma in title', () => parseCSV('1~2,"A,B"', 'L')[0].title === 'A,B');
    add('parseCSV: escaped quote in title', () => parseCSV('1~2,"He said ""Hi"""', 'L')[0].title === 'He said "Hi"');
    add('rowsToEvents: pipeline basic', () => rowsToEvents(parseCSV('1~2,A', 'L')).length === 1);
    add('resolveLayerName: creates new layer when merge is off', () => {
      const previous = ui.mergeSameSource.checked;
      const backup = state.data.slice();
      try {
        ui.mergeSameSource.checked = false;
        state.data = [{ layer: '文本' }, { layer: '文本 #2' }];
        return resolveLayerName('文本') === '文本 #3';
      } finally {
        ui.mergeSameSource.checked = previous;
        state.data = backup;
      }
    });
    add('ingest: append preserves existing layers', () => {
      const backup = snapshotState();
      try {
        ingest(rowsToEvents(parseCSV('1~2,A', 'L1')));
        ingest(rowsToEvents(parseCSV('3~4,B', 'L2')));
        return state.layerOrder.includes('L1') && state.layerOrder.includes('L2');
      } finally {
        restoreState(backup);
      }
    });
    add('layers order respects import sequence', () => {
      const backup = snapshotState();
      try {
        ingest(rowsToEvents(parseCSV('1~2,A', 'Z1')));
        ingest(rowsToEvents(parseCSV('3~4,B', 'A2')));
        const first = state.layerOrder.indexOf('Z1');
        const second = state.layerOrder.indexOf('A2');
        return first > -1 && second > -1 && first < second;
      } finally {
        restoreState(backup);
      }
    });
    add('applyZoom: preserves world at pivot', () => {
      const backup = snapshotState();
      try {
        const rect = ui.canvas.getBoundingClientRect();
        const pivotX = state.leftPad + Math.max(50, rect.width * 0.25);
        const before = xToYear(pivotX);
        applyZoom(pivotX, Math.pow(1.0015, -240));
        const after = xToYear(pivotX);
        return Math.abs(after - before) < 1e-6;
      } finally {
        restoreState(backup);
      }
    });
    add('applyZoom: ctrl/cmd speed multiplier is faster', () => {
      const backup = snapshotState();
      try {
        const rect = ui.canvas.getBoundingClientRect();
        const pivotX = state.leftPad + rect.width / 2;
        const px0 = state.pxPerYear;
        applyZoom(pivotX, Math.pow(1.0015, -100));
        const px1 = state.pxPerYear;
        restorePartial(backup);
        applyZoom(pivotX, Math.pow(1.0015, -400));
        const px2 = state.pxPerYear;
        return Math.abs(px2 - px0) > Math.abs(px1 - px0);
      } finally {
        restoreState(backup);
      }
    });
    add('zoom slider: logarithmic mapping round-trips', () => {
      const px = 0.000123;
      const roundTrip = sliderValueToPxPerYear(pxPerYearToSliderValue(px));
      return Math.abs(Math.log(roundTrip) - Math.log(px)) < 0.05;
    });
    add('setViewToSpan: supports geological scale', () => {
      const backup = snapshotState();
      try {
        setViewToSpan(4600000000, 0);
        const visibleYears = (ui.canvas.clientWidth - state.leftPad - state.rightPad) / state.pxPerYear;
        return visibleYears >= 4.5e9;
      } finally {
        restoreState(backup);
      }
    });
    add('deleteLayer: removes data and order', () => {
      const backup = snapshotState();
      try {
        state.data = [];
        state.layerOrder = [];
        state.layers = [];
        ingest(rowsToEvents(parseCSV('1~2,A', 'L1')));
        ingest(rowsToEvents(parseCSV('3~4,B', 'L2')));
        const had = state.layerOrder.includes('L1');
        deleteLayer('L1');
        const gone = !state.layerOrder.includes('L1') && state.data.every((event) => event.layer !== 'L1');
        return had && gone;
      } finally {
        restoreState(backup);
      }
    });
    add('renameLayer: updates events and order', () => {
      const backup = snapshotState();
      try {
        ingest(rowsToEvents(parseCSV('1~2,A', 'L1')));
        const before = pickColorForLayer('L1');
        return renameLayer('L1', 'L1-new') === true
          && state.layerOrder.includes('L1-new')
          && state.data.every((event) => event.layer !== 'L1')
          && pickColorForLayer('L1-new') === before;
      } finally {
        restoreState(backup);
      }
    });
    add('toggleLayerHidden: keeps layer but marks hidden', () => {
      const backup = snapshotState();
      try {
        ingest(rowsToEvents(parseCSV('1~2,A', 'L1')));
        const toggled = toggleLayerHidden('L1');
        return toggled && state.hiddenLayers.has('L1') && getLayerHeight('L1') === 28;
      } finally {
        restoreState(backup);
      }
    });
    add('long layer name: wraps but is capped', () => {
      const backup = snapshotState();
      try {
        ingest(rowsToEvents(parseCSV('1~2,A', 'L1')));
        renameLayer('L1', '这是一个非常非常非常非常非常非常非常长的图层名字用于测试最多四行显示并且超过部分省略');
        const target = '这是一个非常非常非常非常非常非常非常长的图层名字用于测试最多四行显示并且超过部分省略';
        const lines = wrapLayerLabelLines(target, 4);
        return lines.length <= 4 && getLayerHeight(target) <= 64;
      } finally {
        restoreState(backup);
      }
    });
    add('setLayerColor: stores custom color', () => {
      const backup = snapshotState();
      try {
        ingest(rowsToEvents(parseCSV('1~2,A', 'L1')));
        return setLayerColor('L1', '#ff8800') && pickColorForLayer('L1') === '#ff8800';
      } finally {
        restoreState(backup);
      }
    });

    const passed = results.filter((result) => result.ok).length;
    const failed = results.length - passed;
    const log = results
      .map((result) => `${result.ok ? '✅' : '❌'} ${result.name}${result.err ? `\n   ${result.err}` : ''}`)
      .join('\n');

    console.log('[Timeline Self-tests]\n' + log);
    if (ui.testLog) ui.testLog.textContent = log;
    if (ui.testBadge) {
      ui.testBadge.style.display = 'block';
      ui.testBadge.textContent = `自测：${passed}/${results.length} 通过${failed ? '（有失败，点我看详情）' : ''}`;
      ui.testBadge.onclick = () => {
        if (!ui.testPanel) return;
        ui.testPanel.style.display = ui.testPanel.style.display === 'none' ? 'block' : 'none';
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
