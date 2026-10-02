/* Offline generator only: solar 1PN correction and the MSY water-ice law. */
#include <math.h>
#include "rebound.h"

void halley_forces(struct reb_simulation* sim) {
    struct reb_particle* p = sim->particles;
    const double mu = sim->G * p[0].m;
    const double c = 173.144632674240; /* AU/day */
    for (unsigned int j = 1; j < sim->N; j++) {
        const double x = p[j].x-p[0].x, y = p[j].y-p[0].y, z = p[j].z-p[0].z;
        const double vx = p[j].vx-p[0].vx, vy = p[j].vy-p[0].vy, vz = p[j].vz-p[0].vz;
        const double rr = x*x+y*y+z*z, r = sqrt(rr), dot = x*vx+y*vy+z*vz;
        const double k = mu/(c*c*r*rr), v2 = vx*vx+vy*vy+vz*vz;
        p[j].ax += k*((4*mu/r-v2)*x+4*dot*vx);
        p[j].ay += k*((4*mu/r-v2)*y+4*dot*vy);
        p[j].az += k*((4*mu/r-v2)*z+4*dot*vz);
        if (j != sim->N-1) continue;
        const double tx = vx-dot*x/rr, ty = vy-dot*y/rr, tz = vz-dot*z/rr;
        const double tv = sqrt(tx*tx+ty*ty+tz*tz);
        const double u = r/2.808;
        const double g = 0.111262*pow(u,-2.15)*pow(1+pow(u,5.093),-4.6142);
        /* Yeomans & Kiang (1981), Table 3, orbit 3; held constant. */
        const double a1 = 0.2767e-8, a2 = 0.0150e-8;
        p[j].ax += g*(a1*x/r+a2*tx/tv);
        p[j].ay += g*(a1*y/r+a2*ty/tv);
        p[j].az += g*(a1*z/r+a2*tz/tv);
    }
}
