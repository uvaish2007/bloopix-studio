/* Site-wide animation: loader, hero intro, scroll reveals, cursor, marquee. */

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover =
  window.matchMedia("(hover: hover) and (pointer: fine)").matches;

let siteInitialized = false;
let lenisInstance = null;
let cursorInitialized = false;

/* Wrap each line of the hero headline in a clipped span so it can roll into view */
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

/* Hero intro. Built paused so the hero is already hidden behind the loader,
   then played the moment the loader fades — otherwise it flashes into place. */
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

/* Loader: fade it out once the page loads, then start the rest of the site */
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

  // "resize" must stay in this list or scroll positions go stale when the
  // window resizes or a phone is rotated
  ScrollTrigger.config({
    autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize"
  });

  // Failsafe: never leave the loader stuck on screen
  setTimeout(exitLoader, 3500);

  // Coming back via the browser's back button restores the old page as-is,
  // so clear the loader and skip straight to the finished state
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

/* Single entry point for every page. The guard matters: running it twice
   stacks duplicate animations on the same elements. */
function initSiteOnce() {
  if (siteInitialized) return;
  siteInitialized = true;

  initLenis();
  initScrollReveals();
  initMagnetic();
  initCursor();
}

/* Smooth scrolling — desktop only, and off for reduced-motion visitors */
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

/* Fade-and-rise elements in as they scroll into view. Headings, cards and
   footer animate separately — animating a section and its cards at once
   compounds the movement and looks jittery. */
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

  gsap.utils.toArray(".product-card, .card, .request-card").forEach((card, i) => {
    gsap.from(card, {
      y: 40,
      opacity: 0,
      duration: 0.6,
      delay: (i % 3) * 0.08,
      ease,
      scrollTrigger: { trigger: card, start: "top 88%", once: true }
    });
  });

  gsap.utils.toArray(".footer-top, .footer-wordmark-wrap").forEach((el, i) => {
    gsap.from(el, {
      y: 40,
      opacity: 0,
      duration: 0.8,
      delay: i * 0.1,
      ease,
      scrollTrigger: { trigger: el, start: "top 92%", once: true }
    });
  });
}

/* Buttons and links drift slightly toward the cursor when hovered */
function initMagnetic() {
  if (prefersReducedMotion || !canHover) return;

  document
    .querySelectorAll(".nav a, .view-btn, .request-form button, .footer-social-icons a")
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

/* Custom cursor: dot follows the mouse exactly, ring lags behind and grows
   over anything clickable */
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

  // The scale has to be written here with the position. Setting it separately
  // on hover doesn't work — this runs every frame and would overwrite it.
  gsap.ticker.add(() => {
    posX += (mouseX - posX) * 0.15;
    posY += (mouseY - posY) * 0.15;

    const scale = hovering ? 1.5 : 1;
    follower.style.transform = `translate(${posX}px, ${posY}px) translate(-50%, -50%) scale(${scale})`;
  });

  document
    .querySelectorAll("a, button, .product-card, .card, .request-card, .footer-social-icons a")
    .forEach((el) => {
      el.addEventListener("mouseenter", () => {
        hovering = true;
      });
      el.addEventListener("mouseleave", () => {
        hovering = false;
      });
    });
}

/* Homepage featured grid: shuffle the cards and keep 3, so it varies per visit */
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

/* Marquee speed is set from its measured width, so adding or removing text
   doesn't change how fast the strip travels */
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
