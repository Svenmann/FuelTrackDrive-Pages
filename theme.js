(function () {
  const root = document.documentElement;
  const storageKey = "fueltrack-theme";
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let fallbackTheme = null;

  function storedTheme() {
    if (fallbackTheme === "light" || fallbackTheme === "dark") {
      return fallbackTheme;
    }

    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }

  function effectiveTheme() {
    const theme = storedTheme();
    if (theme === "light" || theme === "dark") {
      return theme;
    }

    return mediaQuery.matches ? "dark" : "light";
  }

  function applyTheme() {
    const theme = storedTheme();
    if (theme === "light" || theme === "dark") {
      root.dataset.theme = theme;
    } else {
      delete root.dataset.theme;
    }

    const effective = effectiveTheme();
    root.dataset.effectiveTheme = effective;

    document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
      button.setAttribute("aria-pressed", effective === "dark" ? "true" : "false");
      button.setAttribute(
        "aria-label",
        effective === "dark" ? "Helles Farbschema aktivieren" : "Dunkles Farbschema aktivieren"
      );
      button.title = effective === "dark" ? "Helles Farbschema" : "Dunkles Farbschema";
    });

    document.querySelectorAll("[data-theme-image]").forEach((image) => {
      const themedSource = effective === "dark" ? image.dataset.darkSrc : image.dataset.lightSrc;
      const fallbackSource = image.dataset.lightSrc || image.getAttribute("src");
      const nextSource = themedSource || fallbackSource;

      if (nextSource && image.getAttribute("src") !== nextSource) {
        image.setAttribute("src", nextSource);
      }
    });
  }

  function toggleTheme() {
    const nextTheme = effectiveTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch {
      fallbackTheme = nextTheme;
    }
    applyTheme();
  }

  applyTheme();
  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", applyTheme);
  } else if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(applyTheme);
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-toggle]");
    if (button) {
      toggleTheme();
    }
  });

  const backToTopButton = document.querySelector("[data-back-to-top]");
  if (backToTopButton) {
    const updateBackToTop = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const scrollHeight = document.documentElement.scrollHeight;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const hasScrollablePage = scrollHeight - viewportHeight > 180;
      const shouldShow = hasScrollablePage && scrollTop > 160;

      backToTopButton.classList.toggle("is-hidden", !shouldShow);
      backToTopButton.setAttribute("aria-hidden", shouldShow ? "false" : "true");
      backToTopButton.tabIndex = shouldShow ? 0 : -1;
    };

    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    window.addEventListener("resize", updateBackToTop);
    window.addEventListener("load", updateBackToTop);
    backToTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();
