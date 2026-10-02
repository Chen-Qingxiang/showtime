/* Perihelion instants, not a fixed-period calendar. See docs/halley-scale.md. */
(function (root, factory) {
  const ancient = typeof module === 'object' && module.exports
    ? require('./halley-ancient-data.js') : root.ShowtimeHalleyAncientData;
  const data = factory(ancient);
  if (typeof module === 'object' && module.exports) module.exports = data;
  else root.ShowtimeHalleyData = data;
})(typeof globalThis === 'object' ? globalThis : this, function (ancient) {
  'use strict';

  const sources = Object.freeze({
    ancientExtension: Object.freeze({
      title: 'ShowTime: YK81/DE441 numerical extension, method and reproducible inputs',
      url: 'https://github.com/Chen-Qingxiang/showtime/blob/main/docs/halley-scale.md',
    }),
    jplDE441: Object.freeze({
      title: 'Park et al. (2021), The JPL Planetary and Lunar Ephemerides DE440 and DE441',
      url: 'https://doi.org/10.3847/1538-3881/abd414',
      doi: '10.3847/1538-3881/abd414',
    }),
    ias15: Object.freeze({
      title: 'Rein & Spiegel (2015), IAS15: a fast, adaptive, high-order integrator for gravitational dynamics',
      url: 'https://doi.org/10.1093/mnras/stu2164',
      doi: '10.1093/mnras/stu2164',
    }),
    yeomans1981: Object.freeze({
      title: 'Yeomans & Kiang (1981), The long-term motion of comet Halley, Table 4',
      url: 'https://articles.adsabs.harvard.edu/pdf/1981MNRAS.197..633Y',
      doi: '10.1093/mnras/197.3.633',
    }),
    nasaHalley: Object.freeze({
      title: 'NASA Science: 1P/Halley',
      url: 'https://science.nasa.gov/solar-system/comets/1p-halley/',
    }),
    nasaHistory: Object.freeze({
      title: 'NASA: Halley’s Comet and the Battle of Hastings',
      url: 'https://www.nasa.gov/history/955-years-ago-halleys-comet-and-the-battle-of-hastings/',
    }),
    babylon1985: Object.freeze({
      title: 'Stephenson, Yau & Hunger (1985), Records of Halley’s comet on Babylonian tablets',
      url: 'https://www.nature.com/articles/314587a0',
      doi: '10.1038/314587a0',
    }),
  });

  // Table 4's T column in Julian days (ephemeris time), transcribed in ascending order.
  // Numeric years here are historical years: -240 means 240 BCE, never year zero.
  const historical = [
    [-1404, 1208900.18109], [-1334, 1234416.00585], [-1266, 1259263.89589],
    [-1198, 1283983.73252], [-1129, 1309149.34467], [-1059, 1334960.16376],
    [-986, 1361622.06395], [-911, 1388819.72029], [-836, 1416202.80663],
    [-763, 1442954.03008], [-690, 1469421.77922], [-616, 1496638.00346],
    [-540, 1524318.32702], [-466, 1551414.73879], [-391, 1578866.86897],
    [-315, 1606620.02367], [-240, 1633907.61796], [-164, 1661838.06604],
    [-87, 1689863.96171], [-12, 1717323.34852], [66, 1745189.46014],
    [141, 1772638.93405], [218, 1800819.22347], [295, 1828915.89842],
    [374, 1857707.84230], [451, 1885963.74911], [530, 1914909.62998],
    [607, 1942837.97581], [684, 1971164.26682], [760, 1998788.17126],
    [837, 2026830.77000], [912, 2054365.17429], [989, 2082538.18757],
    [1066, 2110493.43405], [1145, 2139377.06090], [1222, 2167664.32294],
    [1301, 2196546.08194], [1378, 2224686.18724], [1456, 2253022.13257],
    [1531, 2280492.73846], [1607, 2308304.04063], [1682, 2335655.78069],
    [1759, 2363592.56075], [1835, 2391598.93871], [1910, 2418781.67771],
  ];

  const returns = ancient.map((entry) => Object.freeze({
    ...entry, status: 'modelled', disputed: false, dateBasis: 'numerical-extension',
    sourceCalendar: 'julian', timeScale: 'TDB', precision: 'model', noteKey: 'ancientModel',
    sourceIds: Object.freeze(['ancientExtension', 'yeomans1981', 'jplDE441', 'ias15']),
  })).concat(historical.map(([historicalYear, julianDay], index) => {
    const h = index - 16;
    const sourceIds = ['yeomans1981'];
    if (h === 0 || h === 17 || h === 27 || h === 28) sourceIds.push('nasaHistory');
    if (h === 1 || h === 2) sourceIds.push('babylon1985');
    let noteKey = h < 0 ? 'reconstruction' : 'historical';
    if (h === 0) noteKey = 'firstRecord';
    if (h === 1 || h === 2) noteKey = 'babylon';
    if (h === 17) noteKey = 'bayeux';
    const disputed = h === -5 || h === -3;
    if (h === -5) noteKey = 'springAutumn';
    if (h === -3) noteKey = 'earlyCandidate';
    return Object.freeze({
      h, historicalYear, julianDay,
      status: h < 0 ? 'reconstructed' : 'observed',
      disputed,
      dateBasis: 'orbital-solution',
      sourceCalendar: historicalYear < 1582 ? 'julian' : 'gregorian',
      timeScale: 'ET',
      precision: 'model',
      noteKey,
      sourceIds: Object.freeze(sourceIds),
    });
  }));
  // NASA publishes these to the day; the numeric anchor is that day's start.
  // Do not infer a time of day or treat the 2061 prediction as an observation.
  returns.push(Object.freeze({
    h: 29, historicalYear: 1986, date: Object.freeze([1986, 2, 9]),
    status: 'observed', disputed: false, dateBasis: 'published-day',
    sourceCalendar: 'gregorian', timeScale: 'day', precision: 'day', noteKey: 'spacecraft',
    sourceIds: Object.freeze(['nasaHalley', 'nasaHistory']),
  }));
  returns.push(Object.freeze({
    h: 30, historicalYear: 2061, date: Object.freeze([2061, 7, 28]),
    status: 'predicted', disputed: false, dateBasis: 'published-day',
    sourceCalendar: 'gregorian', timeScale: 'day', precision: 'day', noteKey: 'prediction',
    sourceIds: Object.freeze(['nasaHistory']),
  }));
  return Object.freeze({ sources, returns: Object.freeze(returns) });
});
