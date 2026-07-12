/* ======================
   GSAP REGISTER
====================== */
gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover =
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ======================
   GLOBAL STATE
====================== */
let siteInitialized = false;
let lenisInstance = null;
let cursorInitialized = false;

/* ======================
   MASKED HERO HEADLINE
   Wraps each visual line of the hero <h1> in a clipped span so it can
   roll up into view. Runs immediately (before the loader even exits) so
   the hidden "from" state is set while the loader still covers it —
   this must happen before heroIntro below is built.
====================== */
function wrapMaskLines(el) {
  if (!el || el.dataset.masked) return [];
  el.dataset.masked = "true";

  const lines = el.innerHTML.split(/<br\s*\/?>/i);
  el.innerHTML = lines
    .map(
      (line) =>
        `<span class="mask-line"><span class="mask-inner">${line.trim()}</span></span>`
    )
    .join("");

  return Array.from(el.querySelectorAll(".mask-inner"));
}

const heroTitleEl = document.querySelector(".hero h1");
const heroMaskLines = wrapMaskLines(heroTitleEl);

/* ======================
   HERO INTRO TIMELINE (armed immediately, played once the loader exits)
   Built as a paused timeline so its `from()` calls apply their hidden
   starting state the instant this script runs (immediateRender), while
   the loader is still covering the screen. That state then sits ready
   until .play() is called — this avoids the old bug where the hero
   flashed into its final position for a frame right as the loader
   faded, then jump-cut back to its offset start before animating in.
====================== */
const heroIntro = gsap.timeline({ paused: true });

if (heroMaskLines.length) {
  heroIntro.from(heroMaskLines, {
    yPercent: 110,
    duration: 1,
    ease: "expo.out",
    stagger: 0.12
  });
}

heroIntro.from(
  ".hero p",
  {
    y: 24,
    opacity: 0,
    duration: 0.8,
    ease: "power3.out"
  },
  heroMaskLines.length ? "-=0.55" : 0
);

if (prefersReducedMotion) heroIntro.progress(1);

/* ======================
   GLOBAL LOADER (SAFE)
====================== */
(() => {
  const loader = document.getElementById("loader");

  if (!loader) {
    window.addEventListener("load", () => {
      heroIntro.play();
      initSiteOnce();
    });
    return;
  }

  lockScroll();

  let exited = false;

  function exitLoader() {
    if (exited) return;
    exited = true;

    gsap.to(loader, {
      opacity: 0,
      duration: prefersReducedMotion ? 0.15 : 0.6,
      ease: "power2.out",
      onComplete() {
        loader.remove();
        unlockScroll();
        heroIntro.play();
        initSiteOnce();
        ScrollTrigger.refresh(true);
      }
    });
  }

  window.addEventListener("load", () => {
    setTimeout(exitLoader, prefersReducedMotion ? 0 : 300);
  });

  // NOTE: GSAP's default autoRefreshEvents is
  // "visibilitychange,DOMContentLoaded,load,resize" — the previous config
  // here silently dropped "resize", so ScrollTrigger start/end positions
  // went stale on window resize / mobile orientation change. Keep resize.
  ScrollTrigger.config({
    autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize"
  });

  // Hard failsafe
  setTimeout(exitLoader, 3500);

  // Back/forward cache fix
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) {
      unlockScroll();
      loader?.remove();
      heroIntro.progress(1);
      initSiteOnce();
      ScrollTrigger.refresh(true);
    }
  });

  function lockScroll() {
    document.documentElement.classList.add("loading");
    document.body.classList.add("loading");
  }

  function unlockScroll() {
    document.documentElement.classList.remove("loading");
    document.body.classList.remove("loading");
  }
})();

/* ======================
   INIT SITE (ONCE)
   Guarded by siteInitialized so it can never double-run — previously
   index.html had a second, independent loader/init script that raced
   this one and could call initGSAP() twice on a first visit, stacking
   duplicate ScrollTriggers on the same elements. That duplicate script
   has been removed; this is now the single entry point on every page.
====================== */
function initSiteOnce() {
  if (siteInitialized) return;
  siteInitialized = true;

  initLenis();
  initScrollReveals();
  initMagnetic();
  initCursor();
}

/* ======================
   LENIS (SMOOTH SCROLL)
====================== */
function initLenis() {
  if (prefersReducedMotion) return;
  if (!window.Lenis) return;
  if (window.innerWidth < 768) return;
  if (lenisInstance) return;

  lenisInstance = new Lenis({
    lerp: 0.07,
    smoothWheel: true
  });

  gsap.ticker.add((time) => {
    lenisInstance.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);

  lenisInstance.on("scroll", ScrollTrigger.update);

  ScrollTrigger.refresh();
}

/* ======================
   SCROLL REVEALS
   Consolidated into one pass. Two things were fixed vs. the old code:
   1. The whole `.section` wrapper used to animate as a block (y:50)
      at the same time its child `.product-card`s independently animated
      (y:40) with their own triggers — a moving parent plus an
      independently-moving child compounded into jittery motion. Now
      only the heading/intro text of a section reveals as a block; cards
      always own their motion.
   2. `.footer-card` (now `.footer-cta`/`.footer-col`) reveal used to
      live in its own standalone
      `window.addEventListener("load", ...)` outside the init flow — if
      main.js finished parsing after "load" had already fired, that
      listener would silently never run. It's now part of the same
      guarded init path as everything else.
====================== */
function initScrollReveals() {
  const ease = "power3.out";

  gsap.utils.toArray(".section-title, .shop-preview, .section > p").forEach((el) => {
    gsap.from(el, {
      y: 36,
      opacity: 0,
      duration: 0.7,
      ease,
      scrollTrigger: { trigger: el, start: "top 85%", once: true }
    });
  });

  gsap.utils.toArray(".product-card, .card").forEach((card, i) => {
    gsap.from(card, {
      y: 40,
      opacity: 0,
      duration: 0.6,
      delay: (i % 3) * 0.08,
      ease,
      scrollTrigger: { trigger: card, start: "top 88%", once: true }
    });
  });

  gsap.utils.toArray(".footer-cta, .footer-col").forEach((card, i) => {
    gsap.from(card, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      delay: i * 0.08,
      ease,
      scrollTrigger: { trigger: card, start: "top 92%", once: true }
    });
  });
}

/* ======================
   MAGNETIC HOVER (buttons + nav links)
   Desktop-with-precise-pointer only; skipped entirely under
   prefers-reduced-motion.
====================== */
function initMagnetic() {
  if (prefersReducedMotion || !canHover) return;

  document
    .querySelectorAll(".nav a, .view-btn, .footer-request-form button, .social-btn")
    .forEach((el) => {
      const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
      const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

      el.addEventListener("mousemove", (e) => {
        const rect = el.getBoundingClientRect();
        const relX = e.clientX - rect.left - rect.width / 2;
        const relY = e.clientY - rect.top - rect.height / 2;
        xTo(relX * 0.3);
        yTo(relY * 0.3);
      });

      el.addEventListener("mouseleave", () => {
        xTo(0);
        yTo(0);
      });
    });
}

/* ======================
   CURSOR (OPTIMIZED)
====================== */
function initCursor() {
  if (prefersReducedMotion || !canHover) return;
  if (cursorInitialized) return;

  const cursor = document.querySelector(".cursor");
  const follower = document.querySelector(".cursor-follower");
  if (!cursor || !follower) return;

  cursorInitialized = true;

  let mouseX = 0,
    mouseY = 0;
  let posX = 0,
    posY = 0;
  let hovering = false;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    cursor.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  // Previously: `follower.style.transform += " scale(1.5)"` on hover.
  // This ticker runs every frame and unconditionally overwrites
  // follower.style.transform, so the appended scale was wiped out on
  // the very next tick — the hover-grow effect never actually held.
  // Tracking hover state and folding scale into the same transform
  // string the ticker writes each frame fixes it.
  gsap.ticker.add(() => {
    posX += (mouseX - posX) * 0.15;
    posY += (mouseY - posY) * 0.15;

    const scale = hovering ? 1.5 : 1;
    follower.style.transform = `translate(${posX}px, ${posY}px) translate(-50%, -50%) scale(${scale})`;
  });

  document
    .querySelectorAll("a, button, .product-card, .card, .footer-cta, .social-btn")
    .forEach((el) => {
      el.addEventListener("mouseenter", () => {
        hovering = true;
      });
      el.addEventListener("mouseleave", () => {
        hovering = false;
      });
    });
}

/* ======================
   MOBILE FEATURED-GRID SHUFFLE (index.html only)
====================== */
document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("featuredGrid");
  if (!grid) return;

  const cards = Array.from(grid.children);

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  grid.innerHTML = "";
  cards.slice(0, 3).forEach((card) => grid.appendChild(card));
});

/* ======================
   MARQUEE (duration derived from measured width so speed stays
   constant regardless of how much text is in the strip)
====================== */
function initMarquee() {
  const track = document.querySelector(".marquee-track");
  if (!track) return;

  if (prefersReducedMotion) {
    track.style.animation = "none";
    return;
  }

  const distance = track.scrollWidth / 2;
  const pxPerSecond = 60;
  track.style.setProperty("--marquee-duration", `${distance / pxPerSecond}s`);
}

window.addEventListener("load", initMarquee);
