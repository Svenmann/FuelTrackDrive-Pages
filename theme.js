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
      backToTopButton.classList.toggle("is-visible", window.scrollY > 420);
    };

    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    backToTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }
})();
