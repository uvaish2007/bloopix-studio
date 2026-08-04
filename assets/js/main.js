/* Site-wide animation: loader, hero intro, scroll reveals, cursor, marquee. */

gsap.registerPlugin(ScrollTrigger);

/* Two checks used all over this file: skip motion if the visitor asked for
   less of it, and skip mouse-only effects on touch screens. */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

/* "resize" must stay in this list or scroll positions go stale when the
   window resizes or a phone is rotated. */
ScrollTrigger.config({
  autoRefreshEvents: "visibilitychange,DOMContentLoaded,load,resize"
});


/* Split the hero headline on <br> and wrap each line in a clipped span, so the
   lines can roll up into view. Returns the spans to animate. */
function splitHeroHeadline() {
  const title = document.querySelector(".hero h1");
  if (!title) return [];

  title.innerHTML = title.innerHTML
    .split(/<br\s*\/?>/i)
    .map((line) => `<span class="mask-line"><span class="mask-inner">${line.trim()}</span></span>`)
    .join("");

  return Array.from(title.querySelectorAll(".mask-inner"));
}

/* Hero intro. Built now but paused, so the hero is already hidden while the
   loader covers it. Building it later makes the hero flash into place. */
const heroLines = splitHeroHeadline();
const heroIntro = gsap.timeline({ paused: true });

if (heroLines.length) {
  heroIntro.from(heroLines, {
    yPercent: 110,
    duration: 1,
    ease: "expo.out",
    stagger: 0.12
  });
}

heroIntro.from(
  ".hero p",
  { y: 24, opacity: 0, duration: 0.8, ease: "power3.out" },
  heroLines.length ? "-=0.55" : 0
);

if (reduceMotion) heroIntro.progress(1);


/* The page can reach the finished state more than one way, so guard this:
   running it twice stacks duplicate animations on the same elements. */
let started = false;

function startSite() {
  if (started) return;
  started = true;

  initSmoothScroll();
  initScrollReveals();
  initMagneticHover();
  initCursor();
}

function setScrollLocked(locked) {
  document.documentElement.classList.toggle("loading", locked);
  document.body.classList.toggle("loading", locked);
}

/* Loader: fade it out once the page has loaded, then start the site. */
function initLoader() {
  const loader = document.getElementById("loader");

  if (!loader) {
    window.addEventListener("load", () => {
      heroIntro.play();
      startSite();
    });
    return;
  }

  setScrollLocked(true);

  let hidden = false;

  function hideLoader() {
    if (hidden) return;
    hidden = true;

    gsap.to(loader, {
      opacity: 0,
      duration: reduceMotion ? 0.15 : 0.6,
      ease: "power2.out",
      onComplete() {
        loader.remove();
        setScrollLocked(false);
        heroIntro.play();
        startSite();
        ScrollTrigger.refresh(true);
      }
    });
  }

  window.addEventListener("load", () => {
    setTimeout(hideLoader, reduceMotion ? 0 : 300);
  });

  /* Failsafe: never leave the loader stuck on screen. */
  setTimeout(hideLoader, 3500);

  /* Arriving via the back button restores the finished page, so skip the
     intro and just clear the loader. */
  window.addEventListener("pageshow", (e) => {
    if (!e.persisted) return;

    setScrollLocked(false);
    loader.remove();
    heroIntro.progress(1);
    startSite();
    ScrollTrigger.refresh(true);
  });
}

/* Smooth scrolling — desktop only, and off for reduced-motion visitors. */
function initSmoothScroll() {
  if (reduceMotion || !window.Lenis || window.innerWidth < 768) return;

  const lenis = new Lenis({ lerp: 0.07, smoothWheel: true });

  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.on("scroll", ScrollTrigger.update);

  ScrollTrigger.refresh();
}

/* Fade a group of elements up into view as they scroll in. `stagger` delays
   each item after the one before it; `perRow` restarts that delay on each
   new row, so a grid comes in row by row instead of one long ripple. */
function revealOnScroll(selector, { y, duration, start, stagger = 0, perRow = 0 }) {
  gsap.utils.toArray(selector).forEach((el, i) => {
    const step = perRow ? i % perRow : i;

    gsap.from(el, {
      y,
      opacity: 0,
      duration,
      delay: step * stagger,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start, once: true }
    });
  });
}

/* Headings, cards and footer reveal separately on purpose — animating a
   section and its cards together compounds the movement and looks jittery. */
function initScrollReveals() {
  revealOnScroll(".section-title, .shop-preview, .section > p", {
    y: 36,
    duration: 0.7,
    start: "top 85%"
  });

  revealOnScroll(".product-card, .card, .request-card", {
    y: 40,
    duration: 0.6,
    start: "top 88%",
    stagger: 0.08,
    perRow: 3
  });

  revealOnScroll(".footer-top, .footer-wordmark-wrap", {
    y: 40,
    duration: 0.8,
    start: "top 92%",
    stagger: 0.1
  });
}

/* Buttons and links drift slightly toward the cursor while hovered. */
function initMagneticHover() {
  if (reduceMotion || !canHover) return;

  const targets = ".nav a, .view-btn, .request-form button, .footer-social-icons a";

  document.querySelectorAll(targets).forEach((el) => {
    const moveX = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3" });
    const moveY = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3" });

    el.addEventListener("mousemove", (e) => {
      const box = el.getBoundingClientRect();

      moveX((e.clientX - box.left - box.width / 2) * 0.3);
      moveY((e.clientY - box.top - box.height / 2) * 0.3);
    });

    el.addEventListener("mouseleave", () => {
      moveX(0);
      moveY(0);
    });
  });
}

/* Custom cursor: the dot tracks the mouse exactly, the ring trails behind it
   and grows over anything clickable. */
function initCursor() {
  if (reduceMotion || !canHover) return;

  const dot = document.querySelector(".cursor");
  const ring = document.querySelector(".cursor-follower");
  if (!dot || !ring) return;

  let mouseX = 0;
  let mouseY = 0;
  let ringX = 0;
  let ringY = 0;
  let hovering = false;

  window.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    dot.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
  });

  /* The scale has to be written here along with the position. Setting it
     separately on hover doesn't work — this runs every frame and would
     immediately overwrite it. */
  gsap.ticker.add(() => {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;

    const scale = hovering ? 1.5 : 1;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%) scale(${scale})`;
  });

  const clickable = "a, button, .product-card, .card, .request-card, .footer-social-icons a";

  document.querySelectorAll(clickable).forEach((el) => {
    el.addEventListener("mouseenter", () => (hovering = true));
    el.addEventListener("mouseleave", () => (hovering = false));
  });
}

/* Homepage featured grid: shuffle the cards and keep 3, so it varies per visit. */
function shuffleFeaturedGrid() {
  const grid = document.getElementById("featuredGrid");
  if (!grid) return;

  const cards = Array.from(grid.children);

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  grid.innerHTML = "";
  cards.slice(0, 3).forEach((card) => grid.appendChild(card));
}

/* Marquee speed is set from its measured width, so adding or removing text
   doesn't change how fast the strip travels. */
function initMarquee() {
  const track = document.querySelector(".marquee-track");
  if (!track) return;

  if (reduceMotion) {
    track.style.animation = "none";
    return;
  }

  const pxPerSecond = 60;
  const distance = track.scrollWidth / 2;

  track.style.setProperty("--marquee-duration", `${distance / pxPerSecond}s`);
}


/* Start */
initLoader();
document.addEventListener("DOMContentLoaded", shuffleFeaturedGrid);
window.addEventListener("load", initMarquee);
