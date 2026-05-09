/* WellMed — homepage interactions: carousel, counters, gallery */
(function () {
  function initCarousel() {
    const slides = document.querySelectorAll(".hero__slide");
    const dots = document.querySelectorAll(".hero__dot");
    if (!slides.length) return;

    let i = 0;
    const total = slides.length;
    const setActive = (n) => {
      slides.forEach((s, idx) => s.classList.toggle("is-active", idx === n));
      dots.forEach((d, idx) => d.classList.toggle("is-active", idx === n));
      i = n;
    };
    setActive(0);
    dots.forEach((d, idx) => d.addEventListener("click", () => { setActive(idx); restart(); }));

    let timer;
    const tick = () => setActive((i + 1) % total);
    const start = () => { timer = setInterval(tick, 9000); };
    const restart = () => { clearInterval(timer); start(); };
    start();

    // Pause on hover
    const root = document.querySelector(".hero");
    root?.addEventListener("mouseenter", () => clearInterval(timer));
    root?.addEventListener("mouseleave", start);
  }

  function animateCounters() {
    const counters = document.querySelectorAll("[data-count]");
    if (!counters.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const decimals = (el.dataset.count.split(".")[1] || "").length;
        const duration = 1400;
        const start = performance.now();
        const fmt = (n) => decimals ? n.toFixed(decimals) : Math.floor(n).toLocaleString();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = fmt(target * eased) + suffix;
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.4 });
    counters.forEach(c => io.observe(c));
  }

  document.addEventListener("DOMContentLoaded", () => {
    initCarousel();
    animateCounters();
  });
})();
