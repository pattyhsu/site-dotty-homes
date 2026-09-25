/* Dotty Homes — site behaviour: hero slideshow + scroll reveal */
(function () {
  "use strict";

  /* footer year */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ===== HERO SLIDESHOW ===== */
  var slideshow = document.querySelector(".slideshow");
  if (slideshow) {
    var stage = slideshow.querySelector(".ss-stage");
    var slides = Array.prototype.slice.call(slideshow.querySelectorAll(".ss-slide"));
    var titles = slides.map(function (s) {
      var img = s.querySelector("img");
      return img ? img.getAttribute("alt") || "" : "";
    });
    var n = slides.length;
    var i = 0;
    var paused = false;
    var timer = null;
    var INTERVAL = 6000;

    function show(next) {
      i = (next + n) % n;
      slides.forEach(function (s, k) {
        var on = k === i;
        s.classList.toggle("is-in", on);
        s.setAttribute("aria-hidden", on ? "false" : "true");
      });
      if (stage) stage.setAttribute("aria-label", titles[i]);
    }

    function schedule() {
      clearTimeout(timer);
      if (paused) return;
      timer = setTimeout(function () {
        show(i + 1);
        schedule();
      }, INTERVAL);
    }

    slideshow.addEventListener("mouseenter", function () {
      paused = true;
      clearTimeout(timer);
    });
    slideshow.addEventListener("mouseleave", function () {
      paused = false;
      schedule();
    });

    var prevBtn = slideshow.querySelector(".ss-side-l");
    var nextBtn = slideshow.querySelector(".ss-side-r");
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        show(i - 1);
        schedule();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        show(i + 1);
        schedule();
      });
    }

    show(0);
    schedule();
  }

  /* ===== MINI BAR — appears once the masthead has scrolled out of view ===== */
  var masthead = document.querySelector(".masthead");
  var miniBar = document.querySelector(".mini-bar");
  if (masthead && miniBar && "IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      var gone = !entries[0].isIntersecting;
      miniBar.classList.toggle("is-on", gone);
      miniBar.setAttribute("aria-hidden", gone ? "false" : "true");
      if (gone) miniBar.removeAttribute("inert");
      else miniBar.setAttribute("inert", "");
    }).observe(masthead);
  }

  /* ===== SCROLL REVEAL — photo-wall tiles ===== */
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".tile"));
  if (tiles.length) {
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              e.target.classList.add("is-in");
              io.unobserve(e.target);
            }
          });
        },
        { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
      );
      tiles.forEach(function (el) {
        io.observe(el);
      });
    } else {
      tiles.forEach(function (el) {
        el.classList.add("is-in");
      });
    }
  }
})();
