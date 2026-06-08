const DEFAULT_CSV_SAMPLE = `# time,title（两列；layer 由文件名决定，左侧文本默认层名“文本”）
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

(() => {
  const CURRENT_YEAR = new Date().getFullYear();
  const MIN_PX_PER_YEAR = 1e-8;
  const MAX_PX_PER_YEAR = 2000000000;
  const ZOOM_SLIDER_MIN = 0;
  const ZOOM_SLIDER_MAX = 1000;
  const DEFAULT_LAYER_NAME = '默认';
  const TEXT_LAYER_NAME = '文本';
  const SIDE_PANEL_STORAGE_KEY = 'showtime:side-collapsed';
  const POINT_DISPLAY_STORAGE_KEY = 'showtime:point-display-mode';
  const HOVER_TOOLTIP_STORAGE_KEY = 'showtime:hover-tooltip';
  const DEFAULT_POINT_DISPLAY_MODE = 'year';
  const DEFAULT_HOVER_TOOLTIP_ENABLED = true;
  const POINT_DISPLAY_MODES = new Set(['point', 'year', 'month', 'date', 'time', 'all']);
  const TIME_EPSILON = 1e-12;
  const CSV_IMPORT_HELP_TEXT = '请检查：\n• CSV 两列 time,title；\n• 标题中若含逗号，请用双引号包裹；\n• 区间分隔符可用 ~ / - / — / 至 等；\n• 年份可写 -221 或 221BC / 公元前221。';
  const SECONDS_PER_MINUTE = 60;
  const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
  const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;
  const EVENT_TOOLTIP_OFFSET = 14;
  const EVENT_HIT_MIN_WIDTH = 10;
  const MOBILE_BREAKPOINT = 720;
  const DESKTOP_LEFT_PAD = 80;
  const MOBILE_LEFT_PAD = 72;
  const DESKTOP_RIGHT_PAD = 20;
  const MOBILE_RIGHT_PAD = 12;
  const DESKTOP_LANE_HEIGHT = 26;
  const MOBILE_LANE_HEIGHT = 30;
  const POINTER_PAN_LOCK_THRESHOLD = 8;
  const POINTER_VERTICAL_PAN_RATIO = 1.4;
  const LAYER_COLOR_PRESETS = [
    '#3ea6ff', '#56c271', '#f7b538', '#ff7a59', '#ff5d8f', '#b27cff',
    '#27c1b8', '#7a8cff', '#9ccc65', '#d4a017', '#c86bfa', '#ef476f',
  ];
  const EXAMPLE_FILES = [
    'examples/中国朝代.csv',
    'examples/皇帝在位时间.csv',
    'examples/皇帝在位时间_日期.csv',
    'examples/赵林-哲学家表.csv',
    'examples/赵林-哲学家表_日期.csv',
    'examples/宇宙与太阳系演化.csv',
    'examples/地质年代与生命演化.csv',
    'examples/人类史与文明关键节点.csv',
    'examples/文学与思想史.csv',
  ];
  const BACKGROUND_LIBRARY = [
    {
      id: 'china-dynasties',
      name: '中国朝代',
      file: 'background/中国朝代_背景.csv',
      description: '中国历史的基础政治分期，适合作为中文历史和思想史研究的参照层。',
      tags: ['china', 'politics', 'dynasty', 'history'],
      regions: ['china'],
      scale: 'year',
      density: 'medium',
      minYear: -2070,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'world-empires',
      name: '世界帝国',
      file: 'background/世界帝国_背景.csv',
      description: '跨区域帝国和大型政治体的粗粒度背景。',
      tags: ['global', 'politics', 'empire', 'history'],
      regions: ['global'],
      scale: 'year',
      density: 'medium',
      minYear: -2700,
      maxYear: 1997,
    },
    {
      id: 'europe-periods',
      name: '欧洲时代',
      file: 'background/欧洲时代_背景.csv',
      description: '欧洲历史常用时代划分，适合搭配哲学、文学、政治史。',
      tags: ['europe', 'period', 'history', 'culture'],
      regions: ['europe'],
      scale: 'year',
      density: 'low',
      minYear: -800,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'major-wars',
      name: '主要战争',
      file: 'background/主要战争_背景.csv',
      description: '跨时期战争和国际秩序变化。',
      tags: ['war', 'politics', 'global', 'conflict'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -500,
      maxYear: 1991,
    },
    {
      id: 'thought-movements',
      name: '思想史运动',
      file: 'background/思想史运动_背景.csv',
      description: '哲学、思想流派和知识传统的背景层。',
      tags: ['philosophy', 'thought', 'culture', 'religion'],
      regions: ['global', 'europe', 'china'],
      scale: 'year',
      density: 'medium',
      minYear: -800,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'religion-history',
      name: '宗教史',
      file: 'background/宗教史_背景.csv',
      description: '主要宗教传统、改革和传播阶段。',
      tags: ['religion', 'thought', 'culture'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -1500,
      maxYear: 1900,
    },
    {
      id: 'science-technology',
      name: '科学技术史',
      file: 'background/科学技术史_背景.csv',
      description: '科学革命、工业革命、计算机和互联网等技术背景。',
      tags: ['science', 'technology', 'industry'],
      regions: ['global'],
      scale: 'year',
      density: 'medium',
      minYear: -3400,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'economy-society',
      name: '经济社会史',
      file: 'background/经济社会史_背景.csv',
      description: '农业、城市化、贸易、工业化、金融和全球化背景。',
      tags: ['economy', 'society', 'globalization', 'industry'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -10000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'literature-art',
      name: '文学艺术运动',
      file: 'background/文学艺术运动_背景.csv',
      description: '文学、艺术和审美运动的横向参照层。',
      tags: ['literature', 'art', 'culture'],
      regions: ['global', 'europe', 'china'],
      scale: 'year',
      density: 'medium',
      minYear: -500,
      maxYear: 2000,
    },
    {
      id: 'geology-life',
      name: '地质生命史',
      file: 'background/地质生命史_背景.csv',
      description: '地质年代、生命演化和人类出现的长尺度背景。',
      tags: ['geology', 'life', 'evolution', 'deep-time'],
      regions: ['global'],
      scale: 'deep-time',
      density: 'medium',
      minYear: -4600000000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'big-history-thresholds',
      name: 'BigHistory阈值',
      file: 'background/BigHistory阈值_背景.csv',
      description: '宇宙、生命、人类、农业和现代革命的超大尺度参照。',
      tags: ['big-history', 'deep-time', 'scale', 'global'],
      regions: ['global'],
      scale: 'deep-time',
      density: 'low',
      minYear: -13800000000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'human-migration-population',
      name: '人类迁徙与人口',
      file: 'background/人类迁徙与人口_背景.csv',
      description: '智人扩散、人口增长和人口转型背景。',
      tags: ['migration', 'population', 'human', 'demography'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -300000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'agriculture-domestication',
      name: '农业与驯化',
      file: 'background/农业与驯化_背景.csv',
      description: '农业中心、作物、动物驯化和农业技术背景。',
      tags: ['agriculture', 'food', 'domestication', 'economy'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -11000,
      maxYear: 1980,
    },
    {
      id: 'climate-environment',
      name: '气候环境事件',
      file: 'background/气候环境事件_背景.csv',
      description: '影响社会、农业和人口的主要气候环境事件。',
      tags: ['climate', 'environment', 'geology', 'society'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -12900,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'ap-world-periods',
      name: '世界史分期_AP',
      file: 'background/世界史分期_AP_背景.csv',
      description: '全球史课程中的通用分期框架。',
      tags: ['world-history', 'period', 'global', 'education'],
      regions: ['global'],
      scale: 'year',
      density: 'low',
      minYear: 1200,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'islamic-world',
      name: '伊斯兰世界',
      file: 'background/伊斯兰世界_背景.csv',
      description: '伊斯兰世界的政治、宗教和知识网络背景。',
      tags: ['islam', 'religion', 'middle-east', 'empire'],
      regions: ['middle-east', 'north-africa'],
      scale: 'year',
      density: 'medium',
      minYear: 610,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'south-asia-history',
      name: '南亚历史',
      file: 'background/南亚历史_背景.csv',
      description: '南亚文明、宗教、帝国和殖民现代转型背景。',
      tags: ['south-asia', 'india', 'religion', 'empire'],
      regions: ['south-asia'],
      scale: 'year',
      density: 'medium',
      minYear: -2600,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'japan-periods',
      name: '日本历史分期',
      file: 'background/日本历史分期_背景.csv',
      description: '日本史常用分期，适合东亚横向比较。',
      tags: ['japan', 'east-asia', 'period', 'culture'],
      regions: ['japan'],
      scale: 'year',
      density: 'medium',
      minYear: -14000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'korea-history',
      name: '朝鲜半岛历史',
      file: 'background/朝鲜半岛历史_背景.csv',
      description: '朝鲜半岛政治文化与现代分治背景。',
      tags: ['korea', 'east-asia', 'politics'],
      regions: ['korea'],
      scale: 'mixed',
      density: 'medium',
      minYear: -2333,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'southeast-asia-history',
      name: '东南亚历史',
      file: 'background/东南亚历史_背景.csv',
      description: '东南亚国家形成、贸易网络、殖民和独立背景。',
      tags: ['southeast-asia', 'trade', 'religion', 'colonialism'],
      regions: ['southeast-asia'],
      scale: 'year',
      density: 'medium',
      minYear: -500,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'africa-kingdoms-colonialism',
      name: '非洲王国与殖民',
      file: 'background/非洲王国与殖民_背景.csv',
      description: '非洲主要王国、奴隶贸易、殖民和独立背景。',
      tags: ['africa', 'empire', 'colonialism', 'decolonization'],
      regions: ['africa'],
      scale: 'year',
      density: 'medium',
      minYear: -1070,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'americas-civilizations-colonialism',
      name: '美洲文明与殖民',
      file: 'background/美洲文明与殖民_背景.csv',
      description: '美洲文明、欧洲殖民和独立革命背景。',
      tags: ['americas', 'colonialism', 'civilization', 'revolution'],
      regions: ['americas'],
      scale: 'mixed',
      density: 'medium',
      minYear: -7000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'eurasian-steppe-nomads',
      name: '欧亚草原与游牧帝国',
      file: 'background/欧亚草原与游牧帝国_背景.csv',
      description: '草原机动性、游牧联盟和欧亚连接背景。',
      tags: ['steppe', 'nomads', 'empire', 'eurasia'],
      regions: ['eurasia'],
      scale: 'year',
      density: 'medium',
      minYear: -2000,
      maxYear: 1800,
    },
    {
      id: 'ancient-near-east-egypt',
      name: '古代近东与埃及',
      file: 'background/古代近东与埃及_背景.csv',
      description: '两河流域、埃及和古代近东国家背景。',
      tags: ['ancient', 'near-east', 'egypt', 'civilization'],
      regions: ['middle-east', 'egypt'],
      scale: 'year',
      density: 'medium',
      minYear: -3500,
      maxYear: -30,
    },
    {
      id: 'oceania-pacific-world',
      name: '大洋洲与太平洋世界',
      file: 'background/大洋洲与太平洋世界_背景.csv',
      description: '澳洲、波利尼西亚和太平洋世界背景。',
      tags: ['oceania', 'pacific', 'migration', 'colonialism'],
      regions: ['oceania', 'pacific'],
      scale: 'mixed',
      density: 'medium',
      minYear: -65000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'education-knowledge-institutions',
      name: '教育与知识机构',
      file: 'background/教育与知识机构_背景.csv',
      description: '图书馆、大学、科学院和现代研究制度背景。',
      tags: ['education', 'knowledge', 'university', 'science'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -387,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'media-information',
      name: '文字媒介与信息传播',
      file: 'background/文字媒介与信息传播_背景.csv',
      description: '文字、纸、印刷、广播、电视、互联网和移动媒介背景。',
      tags: ['media', 'writing', 'printing', 'information'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -35000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'language-translation',
      name: '语言文字与翻译运动',
      file: 'background/语言文字与翻译运动_背景.csv',
      description: '文字系统、经典翻译和跨文化知识转移背景。',
      tags: ['language', 'translation', 'writing', 'knowledge'],
      regions: ['global'],
      scale: 'year',
      density: 'medium',
      minYear: -3200,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'medicine-public-health',
      name: '医学与公共卫生',
      file: 'background/医学与公共卫生_背景.csv',
      description: '医学传统、病菌理论、疫苗、抗生素和公共卫生背景。',
      tags: ['medicine', 'public-health', 'disease', 'science'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -1600,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'astronomy-space',
      name: '天文学与空间探索',
      file: 'background/天文学与空间探索_背景.csv',
      description: '宇宙观、天文学革命和空间探索背景。',
      tags: ['astronomy', 'space', 'science', 'technology'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -2000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'trade-networks',
      name: '贸易网络',
      file: 'background/贸易网络_背景.csv',
      description: '丝绸之路、印度洋、大西洋贸易和全球供应链背景。',
      tags: ['trade', 'globalization', 'economy', 'transport'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -130,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'capitalism-finance',
      name: '资本主义与金融体系',
      file: 'background/资本主义与金融体系_背景.csv',
      description: '商业革命、银行、股份公司、金本位和金融全球化背景。',
      tags: ['capitalism', 'finance', 'economy', 'globalization'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: 1100,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'transport-spatial-compression',
      name: '交通运输与空间压缩',
      file: 'background/交通运输与空间压缩_背景.csv',
      description: '交通技术如何改变距离、战争、贸易和城市生活。',
      tags: ['transport', 'technology', 'trade', 'urban'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -3500,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'energy-history',
      name: '能源史',
      file: 'background/能源史_背景.csv',
      description: '火、畜力、煤、石油、电力、核能和能源转型背景。',
      tags: ['energy', 'technology', 'industry', 'climate'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -1000000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'urbanization-city-form',
      name: '城市化与城市形态',
      file: 'background/城市化与城市形态_背景.csv',
      description: '城市出现、工业城市、郊区化和全球城市网络背景。',
      tags: ['urbanization', 'city', 'society', 'economy'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -10000,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'colonialism-decolonization',
      name: '殖民主义与去殖民化',
      file: 'background/殖民主义与去殖民化_背景.csv',
      description: '殖民扩张、帝国体系和去殖民化背景。',
      tags: ['colonialism', 'decolonization', 'empire', 'politics'],
      regions: ['global'],
      scale: 'year',
      density: 'medium',
      minYear: 1415,
      maxYear: 1999,
    },
    {
      id: 'political-revolutions',
      name: '政治革命',
      file: 'background/政治革命_背景.csv',
      description: '近现代政治革命和制度断裂背景。',
      tags: ['revolution', 'politics', 'state', 'modern'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: 1640,
      maxYear: 1991,
    },
    {
      id: 'democratization-regimes',
      name: '政治制度与民主化',
      file: 'background/政治制度与民主化_背景.csv',
      description: '民主、选举权、宪政、威权和民主化浪潮背景。',
      tags: ['democracy', 'regime', 'politics', 'rights'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -508,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'law-human-rights',
      name: '国家制度法律与人权',
      file: 'background/国家制度法律与人权_背景.csv',
      description: '法典、主权国家、国际组织和人权框架背景。',
      tags: ['law', 'rights', 'state', 'international'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -1754,
      maxYear: CURRENT_YEAR,
    },
    {
      id: 'labor-social-movements-gender',
      name: '劳动制度社会运动与性别',
      file: 'background/劳动制度社会运动与性别_背景.csv',
      description: '奴隶制、工人运动、社会运动和性别平权背景。',
      tags: ['labor', 'social-movement', 'gender', 'rights'],
      regions: ['global'],
      scale: 'mixed',
      density: 'medium',
      minYear: -3000,
      maxYear: CURRENT_YEAR,
    },
  ];
  const EXAMPLE_FILE_CONTENTS = {
    'examples/中国朝代.csv': `# time,title[,layer]
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
    pointDisplayMode: DEFAULT_POINT_DISPLAY_MODE,
    hoverTooltipEnabled: DEFAULT_HOVER_TOOLTIP_ENABLED,
  };

  const pointer = { mode: null, startX: 0, startY: 0, lastX: 0, lastY: 0 };
  const touchState = {
    mode: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    hasMoved: false,
    longPressTimer: null,
    layer: null,
    pinchDistance: 0,
    pinchCenterX: 0,
  };

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
    restorePointDisplayMode();
    restoreHoverTooltipState();
    bindCanvasInteractions();
    bindUIActions();
    bindToolbarMenus();
    initExampleSelector();
    initBackgroundSelector();
    buildColorSwatches();
    window.addEventListener('resize', resizeCanvas);
    window.visualViewport?.addEventListener('resize', resizeCanvas);
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
    ui.loadBackgroundButton = document.getElementById('btn-load-background');
    ui.loadRecommendedBackgroundButton = document.getElementById('btn-load-recommended-background');
    ui.sideDrawerButton = document.getElementById('btn-side-drawer');
    ui.exampleSelect = document.getElementById('exampleSelect');
    ui.backgroundSelect = document.getElementById('backgroundSelect');
    ui.zoomSlider = document.getElementById('zoomSlider');
    ui.zoomReadout = document.getElementById('zoomReadout');
    ui.csvText = document.getElementById('csvText');
    ui.mergeSameSource = document.getElementById('mergeSameSource');
    ui.pointDisplayMode = document.getElementById('pointDisplayMode');
    ui.hoverTooltip = document.getElementById('hoverTooltip');
    ui.eventTooltip = document.getElementById('eventTooltip');
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

  function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInYear(year) {
    return isLeapYear(year) ? 366 : 365;
  }

  function daysInMonth(year, month) {
    const monthLengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return monthLengths[month - 1] || 0;
  }

  function dayOfYear(year, month, day) {
    let total = 0;
    for (let index = 1; index < month; index += 1) {
      total += daysInMonth(year, index);
    }
    return total + day - 1;
  }

  function datePartsFromDayOfYear(year, dayIndex) {
    let month = 1;
    let remaining = dayIndex;
    while (month <= 12) {
      const monthDays = daysInMonth(year, month);
      if (remaining < monthDays) return { year, month, day: remaining + 1 };
      remaining -= monthDays;
      month += 1;
    }
    return { year: year + 1, month: 1, day: 1 };
  }

  function dateToTimeValue(year, month, day, hour = 0, minute = 0, second = 0) {
    const dayFraction = (hour * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE + second) / SECONDS_PER_DAY;
    return year + (dayOfYear(year, month, day) + dayFraction) / daysInYear(year);
  }

  function timeValueToDateParts(value) {
    let year = Math.floor(value);
    let secondIndex = Math.floor((value - year) * daysInYear(year) * SECONDS_PER_DAY + 1e-6);
    const secondsInYear = daysInYear(year) * SECONDS_PER_DAY;
    if (secondIndex >= secondsInYear) {
      year += 1;
      secondIndex = 0;
    }
    secondIndex = Math.max(0, secondIndex);
    const dayIndex = Math.floor(secondIndex / SECONDS_PER_DAY);
    const secondsOfDay = secondIndex % SECONDS_PER_DAY;
    const date = datePartsFromDayOfYear(year, dayIndex);
    return {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: Math.floor(secondsOfDay / SECONDS_PER_HOUR),
      minute: Math.floor((secondsOfDay % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
      second: secondsOfDay % SECONDS_PER_MINUTE,
    };
  }

  function addDays(parts, days) {
    let { year, month, day } = parts;
    let remaining = days;
    while (remaining > 0) {
      const monthDays = daysInMonth(year, month);
      const step = Math.min(remaining, monthDays - day + 1);
      day += step;
      remaining -= step;
      if (day > monthDays) {
        day = 1;
        month += 1;
        if (month > 12) {
          month = 1;
          year += 1;
        }
      }
    }
    return { year, month, day };
  }

  function addMonths(parts, months) {
    const monthIndex = parts.year * 12 + (parts.month - 1) + months;
    return {
      year: Math.floor(monthIndex / 12),
      month: (monthIndex % 12) + 1,
      day: 1,
      hour: 0,
      minute: 0,
      second: 0,
    };
  }

  function addSeconds(parts, seconds) {
    let date = { year: parts.year, month: parts.month, day: parts.day };
    let totalSeconds = (parts.hour || 0) * SECONDS_PER_HOUR
      + (parts.minute || 0) * SECONDS_PER_MINUTE
      + (parts.second || 0)
      + seconds;

    while (totalSeconds >= SECONDS_PER_DAY) {
      date = addDays(date, 1);
      totalSeconds -= SECONDS_PER_DAY;
    }

    return {
      year: date.year,
      month: date.month,
      day: date.day,
      hour: Math.floor(totalSeconds / SECONDS_PER_HOUR),
      minute: Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE),
      second: totalSeconds % SECONDS_PER_MINUTE,
    };
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function padYear(value) {
    const sign = value < 0 ? '-' : '';
    const abs = String(Math.abs(value));
    return sign + (abs.length < 4 ? abs.padStart(4, '0') : abs);
  }

  function formatDateParts(parts) {
    return `${padYear(parts.year)}-${pad2(parts.month)}-${pad2(parts.day)}`;
  }

  function formatMonthParts(parts) {
    return `${padYear(parts.year)}-${pad2(parts.month)}`;
  }

  function formatTimeParts(parts, precision = 'date') {
    const date = formatDateParts(parts);
    if (precision === 'hour') return `${date} ${pad2(parts.hour || 0)}:00`;
    if (precision === 'minute') return `${date} ${pad2(parts.hour || 0)}:${pad2(parts.minute || 0)}`;
    if (precision === 'second') {
      return `${date} ${pad2(parts.hour || 0)}:${pad2(parts.minute || 0)}:${pad2(parts.second || 0)}`;
    }
    return date;
  }

  function getCurrentDateParts() {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    };
  }

  function parseDateToken(token) {
    if (token == null) return null;
    let s = String(token).trim();
    if (!s) return null;
    if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);

    const match = s.match(/^(\d{3,6})[/-](\d{1,2})(?:[/-](\d{1,2})(?:[T\s]+(\d{1,2})(?::(\d{1,2})(?::(\d{1,2}))?)?)?)?$/);
    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = match[3] == null ? 1 : parseInt(match[3], 10);
    const hour = match[4] == null ? 0 : parseInt(match[4], 10);
    const minute = match[5] == null ? 0 : parseInt(match[5], 10);
    const second = match[6] == null ? 0 : parseInt(match[6], 10);
    if (year <= 0 || month < 1 || month > 12) return null;
    if (day < 1 || day > daysInMonth(year, month)) return null;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;

    let precision = 'month';
    if (match[3] != null) precision = 'date';
    if (match[4] != null) precision = 'hour';
    if (match[5] != null) precision = 'minute';
    if (match[6] != null) precision = 'second';

    const date = { year, month, day, hour, minute, second };
    return { value: dateToTimeValue(year, month, day, hour, minute, second), precision, date };
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

  function parseTimeToken(token) {
    const date = parseDateToken(token);
    if (date) return date;

    const year = parseYearToken(token);
    if (year == null) return null;
    return { value: year, precision: 'year', date: null };
  }

  function currentTokenForPrecision(precision) {
    if (precision === 'month' || precision === 'date' || precision === 'hour' || precision === 'minute' || precision === 'second') {
      const date = getCurrentDateParts();
      if (precision === 'month') {
        const month = { year: date.year, month: date.month, day: 1, hour: 0, minute: 0, second: 0 };
        return { value: dateToTimeValue(month.year, month.month, month.day), precision, date: month };
      }
      if (precision === 'date') {
        const day = { year: date.year, month: date.month, day: date.day, hour: 0, minute: 0, second: 0 };
        return { value: dateToTimeValue(day.year, day.month, day.day), precision, date: day };
      }
      if (precision === 'hour') {
        const hour = { year: date.year, month: date.month, day: date.day, hour: date.hour, minute: 0, second: 0 };
        return { value: dateToTimeValue(hour.year, hour.month, hour.day, hour.hour), precision, date: hour };
      }
      if (precision === 'minute') {
        const minute = { year: date.year, month: date.month, day: date.day, hour: date.hour, minute: date.minute, second: 0 };
        return { value: dateToTimeValue(minute.year, minute.month, minute.day, minute.hour, minute.minute), precision, date: minute };
      }
      const second = { year: date.year, month: date.month, day: date.day, hour: date.hour, minute: date.minute, second: date.second };
      return { value: dateToTimeValue(second.year, second.month, second.day, second.hour, second.minute, second.second), precision, date: second };
    }
    return { value: CURRENT_YEAR, precision: 'year', date: null };
  }

  function makeTimeRange(startToken, endToken) {
    const start = startToken.value <= endToken.value ? startToken : endToken;
    const end = startToken.value <= endToken.value ? endToken : startToken;
    return {
      start: start.value,
      end: end.value,
      startPrecision: start.precision,
      endPrecision: end.precision,
      startDate: start.date || null,
      endDate: end.date || null,
    };
  }

  function parseTimeField(field) {
    const text = String(field).trim();
    if (!text) return null;

    const token = parseTimeToken(text);
    if (token != null) return makeTimeRange(token, token);

    const dateLikePattern = /^\d{3,6}[/-]\d{1,2}(?:[/-]\d{1,2}(?:[T\s]+\d{1,2}(?::\d{1,2}(?::\d{1,2})?)?)?)?$/;
    if (dateLikePattern.test(text)) return null;

    const clockToken = '(?:[T\\s]+\\d{1,2}(?::\\d{1,2}(?::\\d{1,2})?)?)';
    const dateToken = '(?:\\d{3,6}[/-]\\d{1,2}(?:[/-]\\d{1,2}(?:' + clockToken + ')?)?)';
    const yearToken = '(?:-?\\d+|\\d+\\s*(?:BC|BCE)|(?:公元)?前\\s*\\d+)';
    const timeToken = '(?:' + dateToken + '|' + yearToken + ')';
    const rangePattern = new RegExp(
      '^\\s*(' + timeToken + ')\\s*(?:~|–|—|－|-|〜|～|至|到)\\s*(' + timeToken + ')?\\s*$',
      'i'
    );
    const match = text.match(rangePattern);
    if (match) {
      const start = parseTimeToken(match[1]);
      let end = parseTimeToken(match[2]);
      if (start == null) return null;
      if (end == null) end = currentTokenForPrecision(start.precision);
      return makeTimeRange(start, end);
    }

    return null;
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

  function nextAvailableLayerName(baseLayerName, reservedLayerNames = new Set()) {
    const base = baseLayerName || DEFAULT_LAYER_NAME;
    const used = new Set(state.data.map((event) => event.layer));
    for (const layer of reservedLayerNames) used.add(layer);
    if (!used.has(base)) return base;
    let index = 2;
    let candidate = `${base} #${index}`;
    while (used.has(candidate)) {
      index += 1;
      candidate = `${base} #${index}`;
    }
    return candidate;
  }

  function resolveLayerNameForFileBatch(baseLayerName, reservedLayerNames) {
    const preferred = resolveLayerName(baseLayerName);
    if (!reservedLayerNames || !reservedLayerNames.has(preferred)) return preferred;
    return nextAvailableLayerName(baseLayerName, reservedLayerNames);
  }

  function formatCsvImportToast(loadedFiles) {
    if (loadedFiles.length === 1) return `已加载 CSV：${loadedFiles[0].layerName}`;
    const preview = loadedFiles.slice(0, 3).map((item) => item.layerName).join('、');
    const suffix = loadedFiles.length > 3 ? '...' : '';
    return `已加载 ${loadedFiles.length} 个 CSV 图层：${preview}${suffix}`;
  }

  function formatCsvImportFailureMessage(failedFiles) {
    const preview = failedFiles
      .slice(0, 8)
      .map((item) => `• ${item.fileName}：${item.reason}`)
      .join('\n');
    const suffix = failedFiles.length > 8 ? `\n• 另有 ${failedFiles.length - 8} 个文件未加载` : '';
    return `以下 CSV 未能加载：\n${preview}${suffix}\n\n${CSV_IMPORT_HELP_TEXT}`;
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
        startPrecision: range.startPrecision || 'year',
        endPrecision: range.endPrecision || 'year',
        startDate: range.startDate || null,
        endDate: range.endDate || null,
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
    const sorted = [...events].sort((a, b) => {
      const aRange = getEventDisplayRange(a);
      const bRange = getEventDisplayRange(b);
      return aRange.start - bRange.start || aRange.end - bRange.end;
    });
    const lanes = [];
    for (const event of sorted) {
      const range = getEventDisplayRange(event);
      let laneIndex = lanes.findIndex((end) => end <= range.start + TIME_EPSILON);
      if (laneIndex === -1) {
        laneIndex = lanes.length;
        lanes.push(range.end);
      } else {
        lanes[laneIndex] = range.end;
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

  function formatTimeValue(value, precision = 'year', dateParts = null, options = {}) {
    if (precision === 'month') {
      return formatMonthParts(dateParts || timeValueToDateParts(value));
    }
    if (precision === 'date' || precision === 'hour' || precision === 'minute' || precision === 'second') {
      return formatTimeParts(dateParts || timeValueToDateParts(value), precision);
    }
    return fmtYear(value, options);
  }

  function displayEventRange(event) {
    const start = formatTimeValue(event.start, event.startPrecision, event.startDate, { compactThreshold: 1e4 });
    const end = formatTimeValue(event.end, event.endPrecision, event.endDate, { compactThreshold: 1e4 });
    return start === end ? start : `${start}~${end}`;
  }

  function isPointEvent(event) {
    return Math.abs(event.start - event.end) <= TIME_EPSILON;
  }

  function getPointPrecision(event) {
    if (event.startPrecision === event.endPrecision) return event.startPrecision || 'year';
    return event.startPrecision || event.endPrecision || 'year';
  }

  function shouldExpandPointEvent(event) {
    if (!isPointEvent(event)) return false;
    const precision = getPointPrecision(event);
    const mode = state.pointDisplayMode === 'all' ? 'time' : state.pointDisplayMode;
    const precisionRank = { year: 1, month: 2, date: 3, hour: 4, minute: 5, second: 6 };
    const modeRank = { point: 0, year: 1, month: 2, date: 3, time: 6 };
    return (precisionRank[precision] || 0) <= (modeRank[mode] || 0);
  }

  function getPointSpanEnd(event) {
    const precision = getPointPrecision(event);
    const parts = event.startDate || timeValueToDateParts(event.start);

    if (precision === 'year') return event.start + 1;
    if (precision === 'month') {
      const end = addMonths(parts, 1);
      return dateToTimeValue(end.year, end.month, end.day);
    }
    if (precision === 'date') {
      const end = addDays(parts, 1);
      return dateToTimeValue(end.year, end.month, end.day);
    }
    if (precision === 'hour') {
      const end = addSeconds(parts, SECONDS_PER_HOUR);
      return dateToTimeValue(end.year, end.month, end.day, end.hour, end.minute, end.second);
    }
    if (precision === 'minute') {
      const end = addSeconds(parts, SECONDS_PER_MINUTE);
      return dateToTimeValue(end.year, end.month, end.day, end.hour, end.minute, end.second);
    }
    if (precision === 'second') {
      const end = addSeconds(parts, 1);
      return dateToTimeValue(end.year, end.month, end.day, end.hour, end.minute, end.second);
    }
    return event.end;
  }

  function getEventDisplayRange(event) {
    if (!shouldExpandPointEvent(event)) {
      return { start: event.start, end: event.end, expandedPoint: false };
    }
    const end = getPointSpanEnd(event);
    return {
      start: event.start,
      end: end > event.start ? end : event.end,
      expandedPoint: end > event.start,
    };
  }

  function formatSpanYears(years) {
    if (!Number.isFinite(years) || years <= 0) return '0 年';
    const abs = Math.abs(years);
    if (abs >= 1e9) return `${trimNumber(abs / 1e9)} 十亿年`;
    if (abs >= 1e8) return `${trimNumber(abs / 1e8)} 亿年`;
    if (abs >= 1e4) return `${trimNumber(abs / 1e4)} 万年`;
    if (abs < 1) {
      const days = abs * 365.2425;
      if (days >= 1) return `${trimNumber(days)} 天`;
      const hours = days * 24;
      if (hours >= 1) return `${trimNumber(hours)} 小时`;
      const minutes = hours * 60;
      if (minutes >= 1) return `${trimNumber(minutes)} 分钟`;
      return `${trimNumber(minutes * 60)} 秒`;
    }
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

  function isMobileViewport(width = window.innerWidth) {
    return width <= MOBILE_BREAKPOINT;
  }

  function syncResponsiveCanvasMetrics() {
    const mobile = isMobileViewport();
    state.leftPad = mobile ? MOBILE_LEFT_PAD : DESKTOP_LEFT_PAD;
    state.rightPad = mobile ? MOBILE_RIGHT_PAD : DESKTOP_RIGHT_PAD;
    state.laneHeight = mobile ? MOBILE_LANE_HEIGHT : DESKTOP_LANE_HEIGHT;
  }

  function getMinimumCanvasHeight() {
    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
    const visualHeight = window.visualViewport?.height || window.innerHeight;
    const mobile = isMobileViewport();
    const fallback = mobile ? 420 : 480;
    const viewportShare = mobile ? visualHeight * 0.72 : visualHeight - headerHeight;
    return Math.max(fallback, viewportShare);
  }

  function syncCanvasSize() {
    syncResponsiveCanvasMetrics();
    const headerHeight = document.querySelector('header')?.offsetHeight || 0;
    document.documentElement.style.setProperty('--mobile-header-height', `${headerHeight}px`);
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
    let collapsed = true;
    try {
      const saved = window.localStorage.getItem(SIDE_PANEL_STORAGE_KEY);
      if (saved === '0' || saved === '1') collapsed = saved === '1';
    } catch {}
    document.body.classList.toggle('side-collapsed', collapsed);
    if (ui.sideDrawerButton) {
      ui.sideDrawerButton.setAttribute('aria-label', collapsed ? '显示左栏' : '隐藏左栏');
      ui.sideDrawerButton.title = collapsed ? '显示左栏' : '隐藏左栏';
    }
  }

  function setPointDisplayMode(mode, options = {}) {
    const next = POINT_DISPLAY_MODES.has(mode) ? mode : DEFAULT_POINT_DISPLAY_MODE;
    state.pointDisplayMode = next;
    if (ui.pointDisplayMode) ui.pointDisplayMode.value = next;
    if (!options.skipStorage) {
      try {
        window.localStorage.setItem(POINT_DISPLAY_STORAGE_KEY, next);
      } catch {}
    }
    if (!options.skipRebuild) {
      rebuildFromState();
      draw();
    }
  }

  function restorePointDisplayMode() {
    let mode = DEFAULT_POINT_DISPLAY_MODE;
    try {
      const saved = window.localStorage.getItem(POINT_DISPLAY_STORAGE_KEY);
      if (POINT_DISPLAY_MODES.has(saved)) mode = saved;
    } catch {}
    setPointDisplayMode(mode, { skipStorage: true, skipRebuild: true });
  }

  function setHoverTooltipEnabled(enabled, options = {}) {
    state.hoverTooltipEnabled = !!enabled;
    if (ui.hoverTooltip) ui.hoverTooltip.checked = state.hoverTooltipEnabled;
    if (!state.hoverTooltipEnabled) hideEventTooltip();
    if (!options.skipStorage) {
      try {
        window.localStorage.setItem(HOVER_TOOLTIP_STORAGE_KEY, state.hoverTooltipEnabled ? '1' : '0');
      } catch {}
    }
  }

  function restoreHoverTooltipState() {
    let enabled = DEFAULT_HOVER_TOOLTIP_ENABLED;
    try {
      const saved = window.localStorage.getItem(HOVER_TOOLTIP_STORAGE_KEY);
      if (saved === '0' || saved === '1') enabled = saved === '1';
    } catch {}
    setHoverTooltipEnabled(enabled, { skipStorage: true });
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

  function getEventVisualBox(event, layerTop, canvasWidth) {
    const top = layerTop + 3 + event.__lane * (state.laneHeight + state.laneGap);
    const displayRange = getEventDisplayRange(event);
    const x1 = yearToX(displayRange.start);
    const x2 = yearToX(displayRange.end);
    const isPoint = Math.abs(displayRange.start - displayRange.end) <= TIME_EPSILON;

    if (x2 < 0 || x1 > canvasWidth) return null;

    if (isPoint) {
      const radius = Math.min(6, (state.laneHeight - 2) / 2);
      const cx = clamp(x1, state.leftPad, canvasWidth - state.rightPad);
      const cy = top + (state.laneHeight - 2) / 2;
      return {
        event,
        kind: 'point',
        x: cx - radius,
        y: cy - radius,
        width: radius * 2,
        height: radius * 2,
        centerX: cx,
        centerY: cy,
        radius,
      };
    }

    const rx = Math.max(x1, state.leftPad);
    const rawRw = Math.min(x2, canvasWidth - state.rightPad) - rx;
    if (rawRw <= 0) return null;
    const rw = displayRange.expandedPoint ? Math.max(rawRw, 3) : rawRw;
    return {
      event,
      kind: 'range',
      x: rx,
      y: top,
      width: rw,
      height: state.laneHeight - 2,
      centerX: rx + rw / 2,
      centerY: top + (state.laneHeight - 2) / 2,
    };
  }

  function getEventHitArea(box, canvasWidth) {
    if (box.kind === 'point') {
      const radius = box.radius + 5;
      return {
        x1: box.centerX - radius,
        x2: box.centerX + radius,
        y1: box.centerY - radius,
        y2: box.centerY + radius,
        width: radius * 2,
      };
    }

    const hitWidth = Math.max(box.width, EVENT_HIT_MIN_WIDTH);
    return {
      x1: clamp(box.centerX - hitWidth / 2, state.leftPad, canvasWidth - state.rightPad),
      x2: clamp(box.centerX + hitWidth / 2, state.leftPad, canvasWidth - state.rightPad),
      y1: box.y - 3,
      y2: box.y + box.height + 3,
      width: hitWidth,
    };
  }

  function findEventAtCanvasPoint(x, y) {
    if (x < state.leftPad) return null;
    const canvasWidth = ui.canvas.clientWidth;
    const candidates = [];

    for (const layer of state.layerOrder) {
      if (isLayerHidden(layer)) continue;
      const layerBox = state.layerRects.get(layer);
      if (!layerBox || y < layerBox.top || y > layerBox.top + layerBox.height) continue;
      const events = state.byLayer.get(layer) || [];
      for (const event of events) {
        const box = getEventVisualBox(event, layerBox.top, canvasWidth);
        if (!box) continue;
        const hit = getEventHitArea(box, canvasWidth);
        if (x >= hit.x1 && x <= hit.x2 && y >= hit.y1 && y <= hit.y2) {
          candidates.push({
            event,
            box,
            distance: Math.abs(x - box.centerX) + Math.abs(y - box.centerY),
            width: hit.width,
          });
        }
      }
    }

    candidates.sort((a, b) => a.distance - b.distance || a.width - b.width);
    return candidates[0] || null;
  }

  function renderEventTooltipContent(event) {
    if (!ui.eventTooltip) return;
    ui.eventTooltip.replaceChildren();

    const title = document.createElement('div');
    title.className = 'event-tooltip-title';
    title.textContent = event.title || '(无标题)';
    ui.eventTooltip.appendChild(title);

    const time = document.createElement('div');
    time.className = 'event-tooltip-meta';
    time.textContent = `时间：${displayEventRange(event)}`;
    ui.eventTooltip.appendChild(time);
  }

  function positionEventTooltip(clientX, clientY) {
    if (!ui.eventTooltip) return;
    const pad = 8;
    ui.eventTooltip.style.left = '0px';
    ui.eventTooltip.style.top = '0px';
    ui.eventTooltip.style.display = 'block';
    const rect = ui.eventTooltip.getBoundingClientRect();

    let left = clientX + EVENT_TOOLTIP_OFFSET;
    if (left + rect.width + pad > window.innerWidth) {
      left = clientX - rect.width - EVENT_TOOLTIP_OFFSET;
    }
    left = clamp(left, pad, Math.max(pad, window.innerWidth - rect.width - pad));

    let top = clientY + EVENT_TOOLTIP_OFFSET;
    if (top + rect.height + pad > window.innerHeight) {
      top = clientY - rect.height - EVENT_TOOLTIP_OFFSET;
    }
    top = clamp(top, pad, Math.max(pad, window.innerHeight - rect.height - pad));

    ui.eventTooltip.style.left = `${left}px`;
    ui.eventTooltip.style.top = `${top}px`;
  }

  function showEventTooltip(event, clientX, clientY) {
    if (!state.hoverTooltipEnabled || !ui.eventTooltip) return;
    renderEventTooltipContent(event);
    positionEventTooltip(clientX, clientY);
  }

  function hideEventTooltip() {
    if (!ui.eventTooltip) return;
    ui.eventTooltip.style.display = 'none';
  }

  function syncEventTooltipFromPointer(mouseEvent, x, y) {
    if (!state.hoverTooltipEnabled) {
      hideEventTooltip();
      return null;
    }
    const hit = findEventAtCanvasPoint(x, y);
    if (!hit) {
      hideEventTooltip();
      return null;
    }
    showEventTooltip(hit.event, mouseEvent.clientX, mouseEvent.clientY);
    return hit;
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
      const displayRange = getEventDisplayRange(event);
      const x1 = yearToX(displayRange.start);
      const x2 = yearToX(displayRange.end);
      const isPoint = Math.abs(displayRange.start - displayRange.end) <= TIME_EPSILON;

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
        ctx.fillText(`${event.title}  ${displayEventRange(event)}`, cx + radius + 8, cy);
        continue;
      }

      const rx = Math.max(x1, state.leftPad);
      const rawRw = Math.min(x2, width - state.rightPad) - rx;
      if (rawRw <= 0) continue;
      if (rawRw <= 1 && !displayRange.expandedPoint) continue;
      const rw = displayRange.expandedPoint ? Math.max(rawRw, 3) : rawRw;

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
        ctx.fillText(`${event.title}  ${displayEventRange(event)}`, rx + 10, top + (state.laneHeight - 2) / 2);
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

  function chooseCalendarTick(pxPerYear) {
    const targetPx = 110;
    const pxPerSecond = pxPerYear / (365.2425 * SECONDS_PER_DAY);
    if (pxPerSecond > 0) {
      const targetSeconds = targetPx / pxPerSecond;
      for (const step of [1, 2, 5, 10, 15, 30]) {
        if (step >= targetSeconds) return { unit: 'second', step };
      }
    }

    const pxPerMinute = pxPerYear / (365.2425 * 24 * 60);
    if (pxPerMinute > 0) {
      const targetMinutes = targetPx / pxPerMinute;
      for (const step of [1, 2, 5, 10, 15, 30]) {
        if (step >= targetMinutes) return { unit: 'minute', step };
      }
    }

    const pxPerHour = pxPerYear / (365.2425 * 24);
    if (pxPerHour > 0) {
      const targetHours = targetPx / pxPerHour;
      for (const step of [1, 2, 3, 6, 12]) {
        if (step >= targetHours) return { unit: 'hour', step };
      }
    }

    const pxPerDay = pxPerYear / 365.2425;
    if (pxPerDay > 0) {
      const targetDays = targetPx / pxPerDay;
      for (const step of [1, 2, 5, 10, 15]) {
        if (step >= targetDays) return { unit: 'day', step };
      }
    }

    const pxPerMonth = pxPerYear / 12;
    if (pxPerMonth > 0) {
      const targetMonths = targetPx / pxPerMonth;
      for (const step of [1, 2, 3, 6]) {
        if (step >= targetMonths) return { unit: 'month', step };
      }
    }

    return null;
  }

  function tickUnitSeconds(tick) {
    if (tick.unit === 'hour') return tick.step * SECONDS_PER_HOUR;
    if (tick.unit === 'minute') return tick.step * SECONDS_PER_MINUTE;
    if (tick.unit === 'second') return tick.step;
    return 0;
  }

  function firstCalendarTick(startValue, tick) {
    const startParts = timeValueToDateParts(startValue);
    if (tick.unit === 'month') {
      const remainder = (startParts.month - 1) % tick.step;
      let parts = { year: startParts.year, month: startParts.month - remainder, day: 1, hour: 0, minute: 0, second: 0 };
      if (dateToTimeValue(parts.year, parts.month, parts.day) < startValue - 1e-9) {
        parts = addMonths(parts, tick.step);
      }
      return parts;
    }

    if (tick.unit === 'day') {
      const remainder = dayOfYear(startParts.year, startParts.month, startParts.day) % tick.step;
      let parts = { year: startParts.year, month: startParts.month, day: startParts.day, hour: 0, minute: 0, second: 0 };
      if (remainder !== 0) parts = addDays(parts, tick.step - remainder);
      if (dateToTimeValue(parts.year, parts.month, parts.day) < startValue - 1e-9) {
        parts = addDays(parts, tick.step);
      }
      return parts;
    }

    const stepSeconds = tickUnitSeconds(tick);
    let parts = startParts;
    const secondsOfDay = (parts.hour || 0) * SECONDS_PER_HOUR
      + (parts.minute || 0) * SECONDS_PER_MINUTE
      + (parts.second || 0);
    const remainder = secondsOfDay % stepSeconds;
    if (remainder !== 0) parts = addSeconds(parts, stepSeconds - remainder);
    if (dateToTimeValue(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second) < startValue - 1e-9) {
      parts = addSeconds(parts, stepSeconds);
    }
    return parts;
  }

  function formatCalendarAxisLabel(parts, unit) {
    if (unit === 'month') return `${padYear(parts.year)}-${pad2(parts.month)}`;
    if (unit === 'hour') {
      const clock = `${pad2(parts.hour || 0)}:00`;
      return (parts.hour || 0) === 0 ? `${formatDateParts(parts)} ${clock}` : clock;
    }
    if (unit === 'minute') {
      const clock = `${pad2(parts.hour || 0)}:${pad2(parts.minute || 0)}`;
      return (parts.hour || 0) === 0 && (parts.minute || 0) === 0 ? `${formatDateParts(parts)} ${clock}` : clock;
    }
    if (unit === 'second') {
      const clock = `${pad2(parts.hour || 0)}:${pad2(parts.minute || 0)}:${pad2(parts.second || 0)}`;
      return (parts.hour || 0) === 0 && (parts.minute || 0) === 0 && (parts.second || 0) === 0
        ? `${formatDateParts(parts)} ${clock}`
        : clock;
    }
    return formatDateParts(parts);
  }

  function calendarTickValue(parts, tick) {
    if (tick.unit === 'month' || tick.unit === 'day') {
      return dateToTimeValue(parts.year, parts.month, parts.day);
    }
    return dateToTimeValue(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second);
  }

  function advanceCalendarTick(parts, tick) {
    if (tick.unit === 'month') return addMonths(parts, tick.step);
    if (tick.unit === 'day') return addDays(parts, tick.step);
    return addSeconds(parts, tickUnitSeconds(tick));
  }

  function drawCalendarAxisTicks(width, y) {
    const startValue = xToYear(0);
    const endValue = xToYear(width);
    if (startValue < 1 || endValue < 1 || endValue >= 1000000) return false;

    const tick = chooseCalendarTick(state.pxPerYear);
    if (!tick) return false;

    ctx.fillStyle = '#9fb1c9';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '12px system-ui, sans-serif';

    let parts = firstCalendarTick(startValue, tick);
    let guard = 0;
    while (guard < 500) {
      const value = calendarTickValue(parts, tick);
      if (value > endValue + 1e-9) break;
      const x = yearToX(value);
      ctx.strokeStyle = '#253045';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - 6);
      ctx.stroke();
      ctx.fillText(formatCalendarAxisLabel(parts, tick.unit), x, y - 8);
      parts = advanceCalendarTick(parts, tick);
      guard += 1;
    }
    return true;
  }

  function drawYearAxisTicks(width, y) {
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

  function drawAxis(width) {
    const y = state.topPad - 8;
    ctx.strokeStyle = '#2b3546';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();

    if (drawCalendarAxisTicks(width, y)) return;
    drawYearAxisTicks(width, y);
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
    if (state.pxPerYear >= 365.2425 * SECONDS_PER_DAY) {
      ui.zoomReadout.textContent = `${trimNumber(state.pxPerYear / (365.2425 * SECONDS_PER_DAY))} px / 秒`;
      return;
    }
    if (state.pxPerYear >= 365.2425 * 24 * 60) {
      ui.zoomReadout.textContent = `${trimNumber(state.pxPerYear / (365.2425 * 24 * 60))} px / 分钟`;
      return;
    }
    if (state.pxPerYear >= 365.2425 * 24) {
      ui.zoomReadout.textContent = `${trimNumber(state.pxPerYear / (365.2425 * 24))} px / 小时`;
      return;
    }
    if (state.pxPerYear >= 365.2425) {
      ui.zoomReadout.textContent = `${trimNumber(state.pxPerYear / 365.2425)} px / 天`;
      return;
    }
    if (state.pxPerYear >= 12) {
      ui.zoomReadout.textContent = `${trimNumber(state.pxPerYear / 12)} px / 月`;
      return;
    }
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
    const ranges = state.data.map(getEventDisplayRange);
    return {
      minYear: Math.min(...ranges.map((range) => range.start)),
      maxYear: Math.max(...ranges.map((range) => range.end)),
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

  async function loadLocalCsvFiles(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    const reservedLayerNames = new Set();
    const loaded = [];
    const failed = [];
    const importedEvents = [];

    for (const file of files) {
      const fileName = file.name || '文件.csv';
      const baseLayerName = basenameWithoutExt(fileName || '文件');
      const layerName = resolveLayerNameForFileBatch(baseLayerName, reservedLayerNames);
      try {
        if (typeof file.text !== 'function') throw new Error('浏览器无法读取这个文件');
        const text = await file.text();
        const events = rowsToEvents(parseCSV(text, layerName));
        if (!events.length) {
          failed.push({ fileName, reason: '未解析到任何事件' });
          continue;
        }
        reservedLayerNames.add(layerName);
        importedEvents.push(...events);
        loaded.push({ fileName, layerName, count: events.length });
      } catch (error) {
        failed.push({
          fileName,
          reason: error?.message || String(error),
        });
      }
    }

    if (importedEvents.length) ingest(importedEvents);
    return { loaded, failed };
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

  function initBackgroundSelector() {
    if (!ui.backgroundSelect) return;
    ui.backgroundSelect.innerHTML = '';
    for (const entry of BACKGROUND_LIBRARY) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = entry.name;
      option.title = entry.description;
      ui.backgroundSelect.appendChild(option);
    }
  }

  function getBackgroundEntry(id) {
    return BACKGROUND_LIBRARY.find((entry) => entry.id === id || entry.file === id) || null;
  }

  async function fetchTextFile(path, fallback = {}) {
    let text = '';
    try {
      const response = await fetch(encodeURI(path), { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      text = await response.text();
    } catch (error) {
      if (!(path in fallback)) throw error;
      text = fallback[path];
    }
    return text;
  }

  async function loadExampleFile(path) {
    const text = await fetchTextFile(path, EXAMPLE_FILE_CONTENTS);
    const layerName = resolveLayerName(basenameWithoutExt(path));
    const rows = parseCSV(text, layerName);
    const events = rowsToEvents(rows);
    if (!events.length) throw new Error('示例文件中未解析到有效事件');
    ingest(events);
  }

  function backgroundLayerName(entry) {
    return `背景：${entry.name}`;
  }

  async function loadBackgroundEntries(entries) {
    const allEvents = [];
    const loaded = [];
    const skipped = [];
    for (const entry of entries) {
      const layerName = backgroundLayerName(entry);
      if (state.layerOrder.includes(layerName)) {
        skipped.push(entry.name);
        continue;
      }
      const text = await fetchTextFile(entry.file);
      const rows = parseCSV(text, layerName);
      const events = rowsToEvents(rows);
      if (!events.length) throw new Error(`${entry.name} 未解析到有效事件`);
      allEvents.push(...events);
      loaded.push(entry.name);
    }
    if (allEvents.length) {
      state.data = state.data.concat(allEvents);
      rebuildFromState();
      resetView();
    }
    return { loaded, skipped };
  }

  function includesAny(source, keywords) {
    return keywords.some((keyword) => source.includes(keyword));
  }

  function currentDataSearchText() {
    return state.data
      .map((event) => `${event.title || ''} ${event.layer || ''}`)
      .join(' ')
      .toLowerCase();
  }

  function dataBoundsOverlap(entry, bounds) {
    if (!bounds) return false;
    return entry.minYear <= bounds.maxYear && entry.maxYear >= bounds.minYear;
  }

  function scoreBackgroundEntry(entry, bounds, text) {
    let score = dataBoundsOverlap(entry, bounds) ? 2 : 0;
    if (['china-dynasties', 'world-empires', 'europe-periods'].includes(entry.id)) score += 0.5;

    const philosophy = includesAny(text, ['哲学', '思想', '苏格拉底', '柏拉图', '亚里士多德', '康德', '黑格尔', '马克思', '笛卡尔', '休谟', 'philosophy']);
    const politics = includesAny(text, ['皇帝', '朝代', '王朝', '帝国', '政治', '战争', 'dynasty', 'emperor']);
    const religion = includesAny(text, ['宗教', '佛教', '基督', '伊斯兰', '神学', '教会', 'religion']);
    const science = includesAny(text, ['科学', '技术', '物理', '数学', '工业', '计算机', '互联网', 'science', 'technology']);
    const literature = includesAny(text, ['文学', '艺术', '诗', '小说', '戏剧', '美学', 'literature', 'art']);
    const economy = includesAny(text, ['经济', '社会', '贸易', '资本', '工业化', '城市', 'economy', 'society']);
    const deepTime = includesAny(text, ['地质', '生命', '演化', '宇宙', '生物', 'geology', 'evolution']);
    const migration = includesAny(text, ['迁徙', '人口', '智人', '移民', 'migration', 'population', 'demography']);
    const agriculture = includesAny(text, ['农业', '驯化', '作物', '粮食', '畜牧', 'agriculture', 'food']);
    const climate = includesAny(text, ['气候', '环境', '小冰期', '暖期', '火山', 'climate', 'environment']);
    const media = includesAny(text, ['文字', '媒介', '印刷', '出版', '报刊', '广播', '电视', '互联网', 'writing', 'media', 'printing']);
    const education = includesAny(text, ['教育', '大学', '学院', '图书馆', '科学院', '知识机构', 'university', 'education']);
    const medicine = includesAny(text, ['医学', '公共卫生', '疫苗', '疫情', '疾病', '医院', 'medicine', 'health', 'disease']);
    const space = includesAny(text, ['天文', '空间', '航天', '宇航', '月球', '火星', 'astronomy', 'space']);
    const transport = includesAny(text, ['交通', '铁路', '汽车', '航运', '航空', '运输', 'transport', 'railroad']);
    const energy = includesAny(text, ['能源', '煤炭', '石油', '电力', '核能', 'energy']);
    const colonialism = includesAny(text, ['殖民', '帝国主义', '去殖民', '独立运动', 'colonial', 'decolonization']);
    const revolution = includesAny(text, ['革命', '起义', '维新', 'revolution']);
    const democracy = includesAny(text, ['民主', '选举', '宪政', '威权', '政体', 'democracy', 'regime']);
    const law = includesAny(text, ['法律', '法典', '人权', '国际组织', '联合国', 'law', 'rights']);
    const labor = includesAny(text, ['劳动', '工人', '奴隶', '女权', '性别', '社会运动', 'labor', 'gender']);
    const japan = includesAny(text, ['日本', '明治', '江户', '德川', 'japan']);
    const korea = includesAny(text, ['朝鲜', '韩国', '高丽', '新罗', 'korea']);
    const southAsia = includesAny(text, ['印度', '南亚', '莫卧儿', '孔雀王朝', 'india', 'south asia']);
    const islamic = includesAny(text, ['伊斯兰', '哈里发', '阿拔斯', '奥斯曼', '穆斯林', 'islam']);
    const africa = includesAny(text, ['非洲', '马里', '桑海', '阿散蒂', 'africa']);
    const americas = includesAny(text, ['美洲', '玛雅', '阿兹特克', '印加', '拉美', 'america']);
    const southeastAsia = includesAny(text, ['东南亚', '吴哥', '满者伯夷', '暹罗', 'southeast asia']);
    const pacific = includesAny(text, ['大洋洲', '太平洋', '澳洲', '波利尼西亚', 'pacific', 'oceania']);
    const steppe = includesAny(text, ['草原', '游牧', '蒙古', '突厥', '匈奴', 'steppe', 'nomad']);
    const ancientNearEast = includesAny(text, ['埃及', '巴比伦', '亚述', '苏美尔', '近东', 'egypt', 'babylon']);

    if (philosophy) {
      if (entry.id === 'thought-movements') score += 8;
      if (entry.id === 'religion-history') score += 4;
      if (entry.id === 'science-technology') score += 3;
      if (entry.id === 'europe-periods') score += 2;
      if (entry.id === 'education-knowledge-institutions') score += 2;
      if (entry.id === 'language-translation') score += 2;
    }
    if (politics) {
      if (entry.id === 'china-dynasties') score += 8;
      if (entry.id === 'world-empires') score += 5;
      if (entry.id === 'major-wars') score += 4;
      if (entry.id === 'economy-society') score += 2;
      if (entry.id === 'ap-world-periods') score += 2;
      if (entry.id === 'law-human-rights') score += 2;
    }
    if (religion && entry.id === 'religion-history') score += 7;
    if (science && entry.id === 'science-technology') score += 8;
    if (literature && entry.id === 'literature-art') score += 8;
    if (economy && entry.id === 'economy-society') score += 7;
    if (deepTime) {
      if (entry.id === 'geology-life') score += 10;
      if (entry.id === 'big-history-thresholds') score += 8;
    }
    if (migration && entry.id === 'human-migration-population') score += 8;
    if (agriculture && entry.id === 'agriculture-domestication') score += 8;
    if (climate) {
      if (entry.id === 'climate-environment') score += 9;
      if (entry.id === 'energy-history') score += 3;
    }
    if (media) {
      if (entry.id === 'media-information') score += 8;
      if (entry.id === 'language-translation') score += 4;
    }
    if (education && entry.id === 'education-knowledge-institutions') score += 8;
    if (medicine && entry.id === 'medicine-public-health') score += 9;
    if (space && entry.id === 'astronomy-space') score += 9;
    if (transport) {
      if (entry.id === 'transport-spatial-compression') score += 9;
      if (entry.id === 'trade-networks') score += 3;
    }
    if (energy && entry.id === 'energy-history') score += 9;
    if (colonialism && entry.id === 'colonialism-decolonization') score += 9;
    if (revolution && entry.id === 'political-revolutions') score += 9;
    if (democracy && entry.id === 'democratization-regimes') score += 9;
    if (law && entry.id === 'law-human-rights') score += 9;
    if (labor && entry.id === 'labor-social-movements-gender') score += 9;
    if (japan && entry.id === 'japan-periods') score += 11;
    if (korea && entry.id === 'korea-history') score += 11;
    if (southAsia && entry.id === 'south-asia-history') score += 11;
    if (islamic && entry.id === 'islamic-world') score += 11;
    if (africa && entry.id === 'africa-kingdoms-colonialism') score += 11;
    if (americas && entry.id === 'americas-civilizations-colonialism') score += 11;
    if (southeastAsia && entry.id === 'southeast-asia-history') score += 11;
    if (pacific && entry.id === 'oceania-pacific-world') score += 11;
    if (steppe && entry.id === 'eurasian-steppe-nomads') score += 11;
    if (ancientNearEast && entry.id === 'ancient-near-east-egypt') score += 11;

    return score;
  }

  function recommendBackgroundLayers(limit = 3) {
    const bounds = getDataBounds();
    const text = currentDataSearchText();
    const scored = BACKGROUND_LIBRARY
      .filter((entry) => !state.layerOrder.includes(backgroundLayerName(entry)))
      .map((entry) => ({ entry, score: scoreBackgroundEntry(entry, bounds, text) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.entry.name.localeCompare(b.entry.name));
    if (!scored.length) return BACKGROUND_LIBRARY.slice(0, limit);
    return scored.slice(0, limit).map((item) => item.entry);
  }

  function closeToolbarMenus(except = null) {
    document.querySelectorAll('.toolbar-menu[open]').forEach((menu) => {
      if (menu !== except) menu.removeAttribute('open');
    });
  }

  function bindToolbarMenus() {
    document.querySelectorAll('.toolbar-menu').forEach((menu) => {
      menu.addEventListener('toggle', () => {
        if (menu.open) closeToolbarMenus(menu);
      });
      menu.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('select') || target.matches('input[type="checkbox"], input[type="file"]')) return;
        if (target.closest('button')) closeToolbarMenus();
      });
    });

    window.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('.toolbar-menu')) return;
      closeToolbarMenus();
    });
  }

  function bindCanvasInteractions() {
    ui.canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    ui.canvas.addEventListener('mouseleave', handleMouseLeave);
    ui.canvas.addEventListener('wheel', handleWheel, { passive: false });
    ui.canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    ui.canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    ui.canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    ui.canvas.addEventListener('touchcancel', handleTouchCancel);
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
        hideEventTooltip();
        closeToolbarMenus();
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
      const result = await loadLocalCsvFiles(event.target.files);
      event.target.value = '';
      if (result.loaded.length) toast(formatCsvImportToast(result.loaded));
      if (result.failed.length) alert(formatCsvImportFailureMessage(result.failed));
      closeToolbarMenus();
    });

    ui.loadButton?.addEventListener('click', loadCsvTextarea);
    ui.resetButton?.addEventListener('click', resetView);
    ui.pointDisplayMode?.addEventListener('change', (event) => {
      setPointDisplayMode(event.target.value);
    });
    ui.hoverTooltip?.addEventListener('change', (event) => {
      setHoverTooltipEnabled(event.target.checked);
    });

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

    ui.loadBackgroundButton?.addEventListener('click', async () => {
      const entry = getBackgroundEntry(ui.backgroundSelect?.value);
      if (!entry) return;
      try {
        const result = await loadBackgroundEntries([entry]);
        if (result.loaded.length) {
          toast(`已加载背景：${result.loaded.join('、')}`);
        } else {
          toast(`背景已存在：${entry.name}`);
        }
      } catch (error) {
        alert(`加载背景失败：${entry.name}\n${error?.message || error}`);
      }
    });

    ui.loadRecommendedBackgroundButton?.addEventListener('click', async () => {
      const entries = recommendBackgroundLayers(3);
      if (!entries.length) {
        toast('暂无可推荐背景');
        return;
      }
      try {
        const result = await loadBackgroundEntries(entries);
        if (result.loaded.length) {
          toast(`已加载推荐背景：${result.loaded.join('、')}`);
        } else {
          toast('推荐背景已在画布中');
        }
      } catch (error) {
        alert(`加载推荐背景失败：${error?.message || error}`);
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

  function getPointerPanMode(dx, dy) {
    if (Math.hypot(dx, dy) < POINTER_PAN_LOCK_THRESHOLD) return null;
    if (Math.abs(dy) > Math.abs(dx) * POINTER_VERTICAL_PAN_RATIO) return 'vertical';
    return 'horizontal';
  }

  function resetPointerPan() {
    pointer.mode = null;
    pointer.startX = 0;
    pointer.startY = 0;
    pointer.lastX = 0;
    pointer.lastY = 0;
  }

  function handleMouseDown(event) {
    hideLayerMenu();
    hideEventTooltip();
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
    pointer.mode = 'pending';
    pointer.startX = event.clientX;
    pointer.startY = event.clientY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    ui.canvas.style.cursor = 'grabbing';
    event.preventDefault();
  }

  function handleMouseMove(event) {
    const rect = ui.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    if (state.drag.active && state.drag.layer) {
      hideEventTooltip();
      state.drag.mouseY = y;
      state.drag.overlayY = y - state.drag.grabDy;
      draw();
      return;
    }

    if (pointer.mode) {
      hideEventTooltip();
      const dx = event.clientX - pointer.lastX;
      const dy = event.clientY - pointer.lastY;
      if (pointer.mode === 'pending') {
        const totalDx = event.clientX - pointer.startX;
        const totalDy = event.clientY - pointer.startY;
        const mode = getPointerPanMode(totalDx, totalDy);
        if (!mode) return;
        pointer.mode = mode;
      }
      pointer.lastX = event.clientX;
      pointer.lastY = event.clientY;
      if (pointer.mode === 'vertical') {
        window.scrollBy(0, -dy);
      } else {
        state.viewStart -= dx / state.pxPerYear;
        draw();
      }
      event.preventDefault();
      return;
    }

    if (x < state.leftPad) {
      hideEventTooltip();
      for (const [, box] of state.layerRects) {
        if (y >= box.top && y <= box.top + box.height) {
          ui.canvas.style.cursor = 'grab';
          return;
        }
      }
    }
    syncEventTooltipFromPointer(event, x, y);
    ui.canvas.style.cursor = 'default';
  }

  function handleMouseUp() {
    ui.canvas.style.cursor = 'default';
    resetPointerPan();
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
    resetPointerPan();
    hideEventTooltip();
    ui.canvas.style.cursor = 'default';
    if (!state.drag.active) return;
    state.drag = { active: false, layer: null, grabDy: 0, mouseY: 0, overlayY: 0, targetIndex: 0 };
    draw();
  }

  function handleWheel(event) {
    if (!ui.canvas) return;
    const rect = ui.canvas.getBoundingClientRect();
    const insideCanvas = event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!insideCanvas) return;
    const mouseX = event.clientX - rect.left;
    if (mouseX < state.leftPad) return;
    hideEventTooltip();
    event.preventDefault();
    const factor = Math.pow(1.0015, -event.deltaY);
    applyZoom(mouseX, factor);
  }

  function getTouchPoint(touch) {
    const rect = ui.canvas.getBoundingClientRect();
    return {
      clientX: touch.clientX,
      clientY: touch.clientY,
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  }

  function getTouchDistance(touchA, touchB) {
    return Math.hypot(touchA.clientX - touchB.clientX, touchA.clientY - touchB.clientY);
  }

  function getTouchCenter(touchA, touchB) {
    const rect = ui.canvas.getBoundingClientRect();
    return {
      clientX: (touchA.clientX + touchB.clientX) / 2,
      clientY: (touchA.clientY + touchB.clientY) / 2,
      x: (touchA.clientX + touchB.clientX) / 2 - rect.left,
      y: (touchA.clientY + touchB.clientY) / 2 - rect.top,
    };
  }

  function clearTouchLongPress() {
    if (!touchState.longPressTimer) return;
    window.clearTimeout(touchState.longPressTimer);
    touchState.longPressTimer = null;
  }

  function resetTouchState() {
    clearTouchLongPress();
    touchState.mode = null;
    touchState.layer = null;
    touchState.hasMoved = false;
    touchState.pinchDistance = 0;
    touchState.pinchCenterX = 0;
  }

  function findLayerAtCanvasPoint(x, y) {
    if (x >= state.leftPad) return null;
    for (const [layer, box] of state.layerRects) {
      if (y >= box.top && y <= box.top + box.height) return layer;
    }
    return null;
  }

  function handleTouchStart(event) {
    hideLayerMenu();
    hideColorMenu();
    hideEventTooltip();
    resetPointerPan();

    if (event.touches.length === 2) {
      clearTouchLongPress();
      const [first, second] = event.touches;
      const center = getTouchCenter(first, second);
      touchState.mode = 'pinch';
      touchState.pinchDistance = getTouchDistance(first, second);
      touchState.pinchCenterX = center.x;
      event.preventDefault();
      return;
    }

    if (event.touches.length !== 1) return;
    const point = getTouchPoint(event.touches[0]);
    touchState.mode = 'pending';
    touchState.startX = point.x;
    touchState.startY = point.y;
    touchState.lastX = point.x;
    touchState.lastY = point.y;
    touchState.hasMoved = false;
    touchState.layer = findLayerAtCanvasPoint(point.x, point.y);

    if (touchState.layer) {
      touchState.longPressTimer = window.setTimeout(() => {
        if (touchState.mode !== 'pending' || touchState.hasMoved || !touchState.layer) return;
        showLayerMenu(point.clientX, point.clientY, touchState.layer);
        resetTouchState();
      }, 520);
    }
  }

  function handleTouchMove(event) {
    if (event.touches.length === 2) {
      const [first, second] = event.touches;
      const center = getTouchCenter(first, second);
      const nextDistance = getTouchDistance(first, second);
      if (touchState.mode !== 'pinch') {
        clearTouchLongPress();
        touchState.mode = 'pinch';
        touchState.pinchDistance = nextDistance;
        touchState.pinchCenterX = center.x;
        event.preventDefault();
        return;
      }
      if (touchState.pinchDistance > 0 && nextDistance > 0) {
        const panDx = center.x - touchState.pinchCenterX;
        state.viewStart -= panDx / state.pxPerYear;
        applyZoom(center.x, nextDistance / touchState.pinchDistance);
      }
      touchState.pinchDistance = nextDistance;
      touchState.pinchCenterX = center.x;
      event.preventDefault();
      return;
    }

    if (event.touches.length !== 1 || !touchState.mode) return;
    const point = getTouchPoint(event.touches[0]);
    const totalDx = point.x - touchState.startX;
    const totalDy = point.y - touchState.startY;

    if (Math.hypot(totalDx, totalDy) > 8) {
      touchState.hasMoved = true;
      clearTouchLongPress();
    }

    if (touchState.mode === 'pending') {
      if (Math.abs(totalDx) > 8 && Math.abs(totalDx) > Math.abs(totalDy)) {
        touchState.mode = 'pan';
      } else if (Math.abs(totalDy) > 8 && Math.abs(totalDy) > Math.abs(totalDx)) {
        touchState.mode = 'scroll';
      }
    }

    if (touchState.mode === 'pan') {
      const dx = point.x - touchState.lastX;
      state.viewStart -= dx / state.pxPerYear;
      touchState.lastX = point.x;
      touchState.lastY = point.y;
      draw();
      event.preventDefault();
    }
  }

  function handleTouchEnd(event) {
    clearTouchLongPress();
    if (touchState.mode === 'pending' && !touchState.hasMoved && event.changedTouches.length) {
      const point = getTouchPoint(event.changedTouches[0]);
      const hit = findEventAtCanvasPoint(point.x, point.y);
      if (hit) {
        showEventTooltip(hit.event, point.clientX, point.clientY);
        event.preventDefault();
      }
    }
    if (event.touches.length === 0) {
      resetTouchState();
    } else if (event.touches.length === 1) {
      const point = getTouchPoint(event.touches[0]);
      touchState.mode = 'pending';
      touchState.startX = point.x;
      touchState.startY = point.y;
      touchState.lastX = point.x;
      touchState.lastY = point.y;
      touchState.hasMoved = false;
      touchState.layer = findLayerAtCanvasPoint(point.x, point.y);
    }
  }

  function handleTouchCancel() {
    resetTouchState();
    hideEventTooltip();
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
      pointDisplayMode: state.pointDisplayMode,
      hoverTooltipEnabled: state.hoverTooltipEnabled,
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
    state.pointDisplayMode = backup.pointDisplayMode;
    state.hoverTooltipEnabled = backup.hoverTooltipEnabled;
    if (ui.pointDisplayMode) ui.pointDisplayMode.value = state.pointDisplayMode;
    if (ui.hoverTooltip) ui.hoverTooltip.checked = state.hoverTooltipEnabled;
    hideEventTooltip();
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
    add('parseTimeField: short numeric hyphen remains year range', () => {
      const range = parseTimeField('1-2');
      return range.start === 1 && range.end === 2;
    });
    add('parseTimeField: single 1054', () => {
      const range = parseTimeField('1054');
      return range.start === 1054 && range.end === 1054;
    });
    add('parseTimeField: single month 1949-10', () => {
      const range = parseTimeField('1949-10');
      return range.startPrecision === 'month'
        && range.endPrecision === 'month'
        && range.startDate.year === 1949
        && range.startDate.month === 10
        && displayEventRange(range) === '1949-10';
    });
    add('parseTimeField: single date 1949-10-01', () => {
      const range = parseTimeField('1949-10-01');
      return range.startPrecision === 'date'
        && range.endPrecision === 'date'
        && range.startDate.year === 1949
        && range.startDate.month === 10
        && range.startDate.day === 1
        && displayEventRange(range) === '1949-10-01';
    });
    add('parseTimeField: single minute 1969-07-20 20:17', () => {
      const range = parseTimeField('1969-07-20 20:17');
      return range.startPrecision === 'minute'
        && range.startDate.hour === 20
        && range.startDate.minute === 17
        && displayEventRange(range) === '1969-07-20 20:17';
    });
    add('parseTimeField: single second 1969-07-20T20:17:40', () => {
      const range = parseTimeField('1969-07-20T20:17:40');
      return range.startPrecision === 'second'
        && range.startDate.second === 40
        && displayEventRange(range) === '1969-07-20 20:17:40';
    });
    add('parseTimeField: date range 1914-07-28~1918-11-11', () => {
      const range = parseTimeField('1914-07-28~1918-11-11');
      return range.startPrecision === 'date'
        && range.endPrecision === 'date'
        && range.start < range.end
        && formatTimeValue(range.end, range.endPrecision, range.endDate) === '1918-11-11';
    });
    add('parseTimeField: time range keeps minute precision', () => {
      const range = parseTimeField('1969-07-20 20:17~1969-07-20 20:18');
      return range.startPrecision === 'minute'
        && range.endPrecision === 'minute'
        && range.end > range.start
        && formatTimeValue(range.end, range.endPrecision, range.endDate) === '1969-07-20 20:18';
    });
    add('parseTimeField: rejects invalid date', () => parseTimeField('2021-02-29') === null);
    add('parseTimeField: rejects invalid clock', () => parseTimeField('2021-02-28 24:00') === null);
    add('dateToTimeValue: leap year day offset', () => {
      const value = dateToTimeValue(2020, 3, 1);
      return Math.abs(value - (2020 + 60 / 366)) < 1e-12;
    });
    add('dateToTimeValue: hour offset', () => {
      const value = dateToTimeValue(2020, 1, 1, 12);
      return Math.abs(value - (2020 + 0.5 / 366)) < 1e-12;
    });
    add('parseTimeField: open interval 1949~', () => {
      const range = parseTimeField('1949~');
      return range.start === 1949 && range.end === CURRENT_YEAR;
    });
    add('parseTimeField: open date interval keeps date precision', () => {
      const range = parseTimeField('1949-10-01~');
      return range.startPrecision === 'date' && range.endPrecision === 'date' && range.end > range.start;
    });
    add('point display: year mode expands 1647~1647 to one year', () => {
      const backup = snapshotState();
      try {
        state.pointDisplayMode = 'year';
        const event = rowsToEvents(parseCSV('1647~1647,南明绍武帝', 'L'))[0];
        const range = getEventDisplayRange(event);
        return range.expandedPoint && range.start === 1647 && range.end === 1648 && displayEventRange(event) === '1647';
      } finally {
        restoreState(backup);
      }
    });
    add('point display: point mode preserves circular points', () => {
      const backup = snapshotState();
      try {
        state.pointDisplayMode = 'point';
        const event = rowsToEvents(parseCSV('1647~1647,南明绍武帝', 'L'))[0];
        const range = getEventDisplayRange(event);
        return !range.expandedPoint && range.start === 1647 && range.end === 1647;
      } finally {
        restoreState(backup);
      }
    });
    add('point display: date mode expands a single day', () => {
      const backup = snapshotState();
      try {
        state.pointDisplayMode = 'date';
        const event = rowsToEvents(parseCSV('1949-10-01,中华人民共和国成立', 'L'))[0];
        const range = getEventDisplayRange(event);
        return range.expandedPoint
          && formatTimeValue(range.start, 'date') === '1949-10-01'
          && formatTimeValue(range.end, 'date') === '1949-10-02';
      } finally {
        restoreState(backup);
      }
    });
    add('parseCSV: split by \\n', () => parseCSV('1~2,A\n3~4,B', 'L').length === 2);
    add('parseCSV: quoted comma in title', () => parseCSV('1~2,"A,B"', 'L')[0].title === 'A,B');
    add('parseCSV: escaped quote in title', () => parseCSV('1~2,"He said ""Hi"""', 'L')[0].title === 'He said "Hi"');
    add('rowsToEvents: pipeline basic', () => rowsToEvents(parseCSV('1~2,A', 'L')).length === 1);
    add('background library: includes core layers', () => {
      const ids = new Set(BACKGROUND_LIBRARY.map((entry) => entry.id));
      return BACKGROUND_LIBRARY.length >= 40
        && ids.has('thought-movements')
        && ids.has('china-dynasties')
        && ids.has('geology-life')
        && ids.has('medicine-public-health')
        && ids.has('democratization-regimes')
        && ids.has('transport-spatial-compression');
    });
    add('recommendBackgroundLayers: philosophers prefer thought history', () => {
      const backup = snapshotState();
      try {
        state.data = [{ title: '康德', start: 1724, end: 1804, layer: '哲学家表' }];
        state.layerOrder = ['哲学家表'];
        const recommended = recommendBackgroundLayers(1);
        return recommended[0]?.id === 'thought-movements';
      } finally {
        restoreState(backup);
      }
    });
    add('recommendBackgroundLayers: emperors prefer Chinese dynasties', () => {
      const backup = snapshotState();
      try {
        state.data = [{ title: '清圣祖(康熙帝)', start: 1661, end: 1722, layer: '皇帝在位' }];
        state.layerOrder = ['皇帝在位'];
        const recommended = recommendBackgroundLayers(1);
        return recommended[0]?.id === 'china-dynasties';
      } finally {
        restoreState(backup);
      }
    });
    add('recommendBackgroundLayers: medicine prefers public health', () => {
      const backup = snapshotState();
      try {
        state.data = [{ title: '疫苗与公共卫生改革', start: 1796, end: 1948, layer: '医学史' }];
        state.layerOrder = ['医学史'];
        const recommended = recommendBackgroundLayers(1);
        return recommended[0]?.id === 'medicine-public-health';
      } finally {
        restoreState(backup);
      }
    });
    add('recommendBackgroundLayers: Japan topics prefer Japan periods', () => {
      const backup = snapshotState();
      try {
        state.data = [{ title: '明治维新', start: 1868, end: 1912, layer: '日本近代' }];
        state.layerOrder = ['日本近代'];
        const recommended = recommendBackgroundLayers(1);
        return recommended[0]?.id === 'japan-periods';
      } finally {
        restoreState(backup);
      }
    });
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
    add('resolveLayerNameForFileBatch: keeps same selected filename separate', () => {
      const previous = ui.mergeSameSource.checked;
      const backup = state.data.slice();
      try {
        ui.mergeSameSource.checked = true;
        state.data = [];
        const reserved = new Set();
        const first = resolveLayerNameForFileBatch('研究', reserved);
        reserved.add(first);
        const second = resolveLayerNameForFileBatch('研究', reserved);
        return first === '研究' && second === '研究 #2';
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
    add('pointer pan mode: locks vertical only for clear vertical intent', () => {
      return getPointerPanMode(5, 5) === null
        && getPointerPanMode(20, 10) === 'horizontal'
        && getPointerPanMode(8, 9) === 'horizontal'
        && getPointerPanMode(5, 9) === 'vertical';
    });
    add('zoom slider: logarithmic mapping round-trips', () => {
      const px = 0.000123;
      const roundTrip = sliderValueToPxPerYear(pxPerYearToSliderValue(px));
      return Math.abs(Math.log(roundTrip) - Math.log(px)) < 0.05;
    });
    add('chooseCalendarTick: month ticks at date zoom', () => {
      const tick = chooseCalendarTick(2000);
      return tick.unit === 'month' && tick.step === 1;
    });
    add('chooseCalendarTick: day ticks at close zoom', () => {
      const tick = chooseCalendarTick(50000);
      return tick.unit === 'day' && tick.step === 1;
    });
    add('chooseCalendarTick: hour ticks inside a day', () => {
      const tick = chooseCalendarTick(100000);
      return tick.unit === 'hour';
    });
    add('chooseCalendarTick: minute ticks at high zoom', () => {
      const tick = chooseCalendarTick(10000000);
      return tick.unit === 'minute';
    });
    add('chooseCalendarTick: second ticks at highest zoom', () => {
      const tick = chooseCalendarTick(1000000000);
      return tick.unit === 'second';
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
    add('hover tooltip: toggle updates state and control', () => {
      const backup = snapshotState();
      try {
        setHoverTooltipEnabled(false, { skipStorage: true });
        const off = !state.hoverTooltipEnabled && ui.hoverTooltip?.checked === false;
        setHoverTooltipEnabled(true, { skipStorage: true });
        return off && state.hoverTooltipEnabled && ui.hoverTooltip?.checked === true;
      } finally {
        restoreState(backup);
      }
    });
    add('hover tooltip: padded hit finds short range', () => {
      const backup = snapshotState();
      try {
        state.data = rowsToEvents(parseCSV('2000-01-01~2000-01-02,短事件', 'L1'));
        state.layerOrder = [];
        state.viewStart = 1999;
        state.pxPerYear = 10;
        rebuildFromState();
        draw();
        const layerBox = state.layerRects.get('L1');
        const hit = layerBox && findEventAtCanvasPoint(yearToX(2000), layerBox.top + 10);
        return hit?.event?.title === '短事件';
      } finally {
        restoreState(backup);
      }
    });
    add('hover tooltip: content omits layer', () => {
      if (!ui.eventTooltip) return false;
      renderEventTooltipContent({ title: '短事件', start: 2000, end: 2000, layer: 'L1' });
      const text = ui.eventTooltip.textContent || '';
      hideEventTooltip();
      return text.includes('短事件') && text.includes('时间：2000') && !text.includes('图层：');
    });
    add('responsive metrics: mobile viewport uses compact pads and touch lanes', () => {
      const backup = {
        leftPad: state.leftPad,
        rightPad: state.rightPad,
        laneHeight: state.laneHeight,
      };
      try {
        const mobile = isMobileViewport(390);
        const desktop = isMobileViewport(1024);
        return mobile && !desktop
          && MOBILE_LEFT_PAD < DESKTOP_LEFT_PAD
          && MOBILE_RIGHT_PAD < DESKTOP_RIGHT_PAD
          && MOBILE_LANE_HEIGHT > DESKTOP_LANE_HEIGHT;
      } finally {
        state.leftPad = backup.leftPad;
        state.rightPad = backup.rightPad;
        state.laneHeight = backup.laneHeight;
      }
    });
    add('touch helper: layer hit only inside label column', () => {
      const backup = snapshotState();
      try {
        state.data = rowsToEvents(parseCSV('1~2,A', '触摸层'));
        state.layerOrder = [];
        rebuildFromState();
        draw();
        const box = state.layerRects.get('触摸层');
        return !!box
          && findLayerAtCanvasPoint(state.leftPad - 4, box.top + 4) === '触摸层'
          && findLayerAtCanvasPoint(state.leftPad + 4, box.top + 4) === null;
      } finally {
        restoreState(backup);
      }
    });
    add('toolbar menus: close all except requested menu', () => {
      const menus = Array.from(document.querySelectorAll('.toolbar-menu'));
      if (menus.length < 2) return false;
      menus[0].setAttribute('open', '');
      menus[1].setAttribute('open', '');
      closeToolbarMenus(menus[1]);
      const keptOnlySecond = !menus[0].open && menus[1].open;
      closeToolbarMenus();
      return keptOnlySecond && menus.every((menu) => !menu.open);
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
