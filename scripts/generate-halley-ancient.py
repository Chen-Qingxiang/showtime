"""Offline model extension; needs rebound==5.2.1 and a C compiler, not the web app.

Fetch --fetch-seed once; the committed seed then permits reproducible offline runs.
This extends YK81 with current planetary initial states; it does not reproduce
the authors' DE97 integration or claim the new dates are historical observations.
"""
import argparse
import ctypes
import importlib.metadata
import json
import math
from pathlib import Path
import subprocess
import tempfile
import urllib.parse
import urllib.request
import warnings

import rebound

ROOT = Path(__file__).resolve().parents[1]
SEED_FILE = ROOT / 'data/halley-ancient-seed.json'
EPOCH = 1208880.5
TP = 1208900.18109
SUN_GM = 132712440041.279419  # km^3/s^2, DE440/441
AU_KM = 149597870.7
G = SUN_GM * 86400**2 / AU_KM**3
GM = [22031.868551, 324858.592000, 398600.435507+4902.800118,
      42828.375816, 126712764.100000, 37940584.841800,
      5794556.400000, 6836527.100580, 975.500000]


def write_browser_data(result):
    rows = json.dumps(result['returns'], indent=2)
    script = ('/* Generated from data/halley-ancient.json; approximate project model, not observations. */\n'
              '(function (root, factory) {\n'
              '  const rows = factory();\n'
              "  if (typeof module === 'object' && module.exports) module.exports = rows;\n"
              '  else root.ShowtimeHalleyAncientData = rows;\n'
              "})(typeof globalThis === 'object' ? globalThis : this, function () {\n"
              "  'use strict';\n"
              '  return Object.freeze(' + rows + '.map(Object.freeze));\n'
              '});\n')
    (ROOT/'halley-ancient-data.js').write_text(script)


def fetch_seed():
    rows = []
    # JPL API requests are deliberately sequential.
    for body, gm in enumerate(GM, 1):
        params = {'format': 'json', 'COMMAND': str(body), 'CENTER': '500@10',
                  'EPHEM_TYPE': 'VECTORS', 'TLIST': str(EPOCH), 'VEC_TABLE': '2',
                  'OUT_UNITS': 'AU-D', 'CSV_FORMAT': 'YES',
                  'REF_SYSTEM': 'B1950', 'REF_PLANE': 'ECLIPTIC', 'VEC_CORR': 'NONE'}
        query = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urllib.parse.urlencode(params)
        response = json.load(urllib.request.urlopen(query, timeout=45))
        raw = response.get('result', '')
        if 'error' in response or '$$SOE' not in raw or 'DE441' not in raw:
            raise RuntimeError(response)
        cells = raw.split('$$SOE')[1].split('$$EOE')[0].strip().split(',')
        vectors = [float(v) for v in cells[2:8]]
        rows.append({'body': body, 'gmKm3S2': gm, 'stateAuDay': vectors,
                     'query': params, 'response': response})
        print('Fetched DE441 body', body, flush=True)
    seed = {'epochJd': EPOCH, 'frame': 'B1950 ecliptic', 'timeScale': 'TDB',
            'planetaryEphemeris': 'JPL DE441', 'retrieved': '2026-10-02',
            'comet': {'source': 'Yeomans & Kiang (1981), Table 4, 1404 BC row',
                      'epochJd': EPOCH, 'tpJd': TP, 'qAu': 0.6203761,
                      'e': 0.9641090, 'wDeg': 71.94040, 'nodeDeg': 11.71491,
                      'inclinationDeg': 162.49446}, 'planets': rows}
    SEED_FILE.parent.mkdir(exist_ok=True)
    SEED_FILE.write_text(json.dumps(seed, indent=2) + '\n')


def make_sim(seed, library, epsilon):
    sim = rebound.Simulation()
    sim.G = G
    sim.add(m=1)
    for row in seed['planets']:
        sim.add(m=row['gmKm3S2']/SUN_GM, **dict(zip(
            ['x','y','z','vx','vy','vz'], row['stateAuDay'])))
    comet = seed['comet']
    a = comet['qAu']/(1-comet['e'])
    sim.add(m=0, a=a, e=comet['e'], inc=math.radians(comet['inclinationDeg']),
            Omega=math.radians(comet['nodeDeg']), omega=math.radians(comet['wDeg']),
            M=(EPOCH-TP)*math.sqrt(G/a**3), primary=sim.particles[0])
    sim.move_to_com()
    sim.integrator = 'ias15'
    sim.integrator.epsilon = epsilon
    sim.force_is_velocity_dependent = 1
    sim._additional_forces = ctypes.cast(library.halley_forces, rebound.simulation.AFF)
    sim.dt = -0.5
    return sim


def radial(sim):
    p, sun = sim.particles[-1], sim.particles[0]
    return ((p.x-sun.x)*(p.vx-sun.vx)+(p.y-sun.y)*(p.vy-sun.vy)
            +(p.z-sun.z)*(p.vz-sun.vz))


def copy_sim(sim, library):
    # REBOUND copies state, not external C callbacks.
    with warnings.catch_warnings():
        warnings.filterwarnings('ignore', message='You have to reset function pointers.*')
        copied = sim.copy()
    copied.force_is_velocity_dependent = 1
    copied._additional_forces = ctypes.cast(library.halley_forces, rebound.simulation.AFF)
    return copied


def root_of_perihelion(before, after_time, library):
    # The sign change is negative -> positive in chronological order.
    start = before.t
    lo, hi = sorted([start, after_time])
    for _ in range(30):
        mid = (lo+hi)/2
        s = copy_sim(before, library)
        s.integrate(mid)
        if radial(s) < 0:
            lo = mid
        else:
            hi = mid
    return EPOCH+(lo+hi)/2


def integrate(seed, library, epsilon, years, direction=-1):
    sim = make_sim(seed, library, epsilon)
    results = []
    # Coarse checkpoints only detect a bracket; IAS15 chooses its own internal steps.
    end = direction*years*365.25
    while direction*(end-sim.t) > 0:
        before = copy_sim(sim, library)
        value = radial(sim)
        sim.integrate(sim.t+direction*min(30,abs(end-sim.t)))
        new_value = radial(sim)
        if (direction < 0 and value > 0 > new_value) or (direction > 0 and value < 0 < new_value):
            results.append(root_of_perihelion(before, sim.t, library))
            if len(results) % 10 == 0:
                print('Located',len(results),'perihelia',flush=True)
    return results


def julian_year(jd):
    z = math.floor(jd+0.5)
    b = z+1524
    c = math.floor((b-122.1)/365.25)
    d = math.floor(365.25*c)
    e = math.floor((b-d)/30.6001)
    month = e-1 if e < 14 else e-13
    year = c-4716 if month > 2 else c-4715
    return year-1 if year <= 0 else year


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch-seed', action='store_true')
    parser.add_argument('--epsilon', type=float, default=1e-11)
    parser.add_argument('--output', type=Path, default=ROOT/'data/halley-ancient.json')
    args = parser.parse_args()
    if args.fetch_seed:
        fetch_seed()
    seed = json.loads(SEED_FILE.read_text())
    headers = [Path(importlib.metadata.distribution('rebound').locate_file(p)).parent
               for p in importlib.metadata.distribution('rebound').files if str(p).endswith('/rebound.h')]
    with tempfile.TemporaryDirectory() as temp:
        shared = Path(temp)/'halley-forces.so'
        subprocess.run(['cc','-O3','-shared','-fPIC','-I'+str(headers[0]),
                        str(ROOT/'scripts/halley-forces.c'),'-lm','-o',str(shared)],check=True)
        library = ctypes.CDLL(str(shared))
        # Integrate far enough to include an anchor before 4000 BCE.
        dates = integrate(seed, library, args.epsilon, 2700)
        rows = [{'h': -17-index, 'historicalYear': julian_year(jd), 'julianDay': round(jd,5)}
                for index,jd in enumerate(dates)]
        rows.reverse()
        # Independent forward check against the next YK81 published return.
        control = integrate(seed, library, args.epsilon, 80, direction=1)
    result = {'model': 'ShowTime YK81/DE441 extension v1', 'generated': '2026-10-02',
              'reboundVersion': rebound.__version__, 'epsilon': args.epsilon,
              'seedEpochJd': EPOCH, 'status': 'model-estimate',
              'control1334BC': {'publishedJd':1234416.00585, 'computedJd':control[-1],
                               'differenceDays':control[-1]-1234416.00585}, 'returns':rows}
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    if args.output.resolve() == (ROOT/'data/halley-ancient.json').resolve():
        write_browser_data(result)
    print(json.dumps({k:v for k,v in result.items() if k!='returns'}),flush=True)
    print(len(rows),'new returns; first',rows[0],flush=True)


if __name__ == '__main__':
    main()
