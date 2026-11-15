import orbitalStationUrl from '../../assets/images/orbital_station_earth_1794659601206.jpg';

export function renderResearch(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <!-- Hero & Transparency Banner -->
      <div class="astro-panel overflow-hidden p-0">
        <div class="grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div class="lg:col-span-7 p-6 flex flex-col justify-between gap-4">
            <div>
              <p class="text-xs text-cyan-300 font-medium">SPACEFLIGHT PHYSIOLOGY &amp; OPEN SCIENCE</p>
              <h1 class="text-2xl font-bold text-slate-50 mt-1" style="text-wrap: balance;">
                NASA Research &amp; Public Reference Sources
              </h1>
              <p class="text-sm text-slate-300 mt-2 leading-relaxed">
                ASTROCARE AI is an educational &amp; Space Apps Challenge prototype. All astronaut vitals shown in this dashboard are <strong class="text-cyan-300">simulated telemetry</strong> for demonstration—they are not live NASA flight hardware streams or real crew medical records.
              </p>
            </div>
            <div class="p-3.5 rounded-lg status-box-moderate text-xs text-amber-100 leading-relaxed">
              Scientific Integrity Statement: No fabricated dataset IDs or invented clinical findings are used in this module. The links below connect directly to official public NASA open science portals.
            </div>
          </div>

          <div class="lg:col-span-5 relative min-h-[220px] bg-slate-900">
            <img
              src="${orbitalStationUrl}"
              alt="Orbital research station above Earth limb"
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover"
              onerror="this.classList.add('hidden'); this.nextElementSibling.classList.remove('hidden');"
            />
            <div class="hidden w-full h-full flex items-center justify-center bg-slate-900 text-slate-400 text-xs p-6 text-center">
              Low Earth Orbit Research Context
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none"></div>
          </div>
        </div>
      </div>

      <!-- Official Public Portals -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <article class="astro-panel flex flex-col justify-between gap-4">
          <div>
            <div class="text-xs text-cyan-300 font-medium">OPEN DATA REPOSITORY</div>
            <h2 class="text-base font-semibold text-slate-100 mt-1">NASA Open Science Data Repository (OSDR)</h2>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed">
              Public repository hosting space-related biological and physiological research datasets, metadata, and experimental studies supporting reproducible space biology.
            </p>
          </div>
          <a
            href="https://osdr.nasa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            class="astro-btn-secondary w-full no-underline"
          >
            <span>Visit osdr.nasa.gov</span>
            <i data-lucide="external-link" class="w-4 h-4"></i>
          </a>
        </article>

        <article class="astro-panel flex flex-col justify-between gap-4">
          <div>
            <div class="text-xs text-cyan-300 font-medium">LIFE SCIENCES PORTAL</div>
            <h2 class="text-base font-semibold text-slate-100 mt-1">NASA Life Sciences Portal (NLSP)</h2>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed">
              NASA's gateway for human spaceflight biomedical archives, crew health research documentation, and life sciences experiment records.
            </p>
          </div>
          <a
            href="https://nlsp.nasa.gov/"
            target="_blank"
            rel="noopener noreferrer"
            class="astro-btn-secondary w-full no-underline"
          >
            <span>Visit nlsp.nasa.gov</span>
            <i data-lucide="external-link" class="w-4 h-4"></i>
          </a>
        </article>

        <article class="astro-panel flex flex-col justify-between gap-4">
          <div>
            <div class="text-xs text-cyan-300 font-medium">HUMAN RESEARCH PROGRAM</div>
            <h2 class="text-base font-semibold text-slate-100 mt-1">5 Hazards of Human Spaceflight</h2>
            <p class="text-xs text-slate-300 mt-2 leading-relaxed">
              NASA Human Research Program overview covering space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile closed environments.
            </p>
          </div>
          <a
            href="https://www.nasa.gov/hrp/hazards/"
            target="_blank"
            rel="noopener noreferrer"
            class="astro-btn-secondary w-full no-underline"
          >
            <span>Visit nasa.gov/hrp/hazards</span>
            <i data-lucide="external-link" class="w-4 h-4"></i>
          </a>
        </article>
      </div>

      <!-- How Spaceflight Affects Human Physiology -->
      <div class="astro-panel">
        <h2 class="text-base font-semibold text-slate-100">How Spaceflight Affects Human Physiology</h2>
        <p class="text-xs text-slate-400 mt-1">
          Background context explaining why ASTROCARE AI tracks cardiovascular, respiratory, thermal, and sleep metrics during missions.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div class="p-4 astro-surface-muted space-y-1.5">
            <h3 class="text-sm font-semibold text-cyan-300">Fluid Shifts &amp; Cardiovascular Adaptation</h3>
            <p class="text-xs text-slate-300 leading-relaxed">
              In microgravity, the absence of Earth's downward hydrostatic gradient causes bodily fluids to shift toward the upper torso and head. Over multi-week missions, plasma volume decreases and cardiovascular deconditioning can alter resting heart rate and orthostatic blood pressure regulation.
            </p>
          </div>

          <div class="p-4 astro-surface-muted space-y-1.5">
            <h3 class="text-sm font-semibold text-cyan-300">Circadian Misalignment &amp; Sleep Duration</h3>
            <p class="text-xs text-slate-300 leading-relaxed">
              Low Earth orbit spacecraft experience roughly 16 sunrises and sunsets every 24 hours. Combined with operational schedule shifts, ambient cabin noise, and CO2 levels, crews frequently experience reduced sleep duration—making sleep trend tracking essential for cognitive readiness.
            </p>
          </div>

          <div class="p-4 astro-surface-muted space-y-1.5">
            <h3 class="text-sm font-semibold text-cyan-300">Closed-Environment Air &amp; Oxygen Monitoring</h3>
            <p class="text-xs text-slate-300 leading-relaxed">
              Spacecraft cabins rely on closed-loop Environmental Control and Life Support Systems (ECLSS). Monitoring blood oxygen saturation (SpO2) alongside cabin atmosphere telemetry supports early awareness of sensor anomalies, exertion strain, or environmental drift.
            </p>
          </div>

          <div class="p-4 astro-surface-muted space-y-1.5">
            <h3 class="text-sm font-semibold text-cyan-300">Thermoregulation &amp; Exercise Countermeasures</h3>
            <p class="text-xs text-slate-300 leading-relaxed">
              Without natural convection in microgravity, heat dissipation relies on cabin airflow and perspiration evaporation. Tracking body temperature alongside activity level (Rest vs. Exercise / EVA Prep) prevents misinterpreting normal workout elevation as a resting anomaly.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}
