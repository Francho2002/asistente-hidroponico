const transitionDuration = 190;

/**
 * Router hash minimalista. Solo monta una ruta a la vez y deja que el navegador
 * conserve el historial con #/ruta, sin recargar el documento.
 */
export function createHashRouter({ stage, navigation, routes, renderRoute }) {
  let navigationId = 0;
  const reducedMotion = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const getRoute = () => {
    const candidate = location.hash.replace(/^#\/?/, "").split("/")[0];
    return routes.includes(candidate) ? candidate : routes[0];
  };
  const markActive = (route) =>
    navigation.forEach((button) =>
      button.classList.toggle("active", button.dataset.view === route),
    );
  const delay = () =>
    new Promise((resolve) => setTimeout(resolve, transitionDuration));

  async function mount(route, { animate = true } = {}) {
    const token = ++navigationId;
    markActive(route);
    if (animate && stage.firstElementChild && !reducedMotion()) {
      stage.classList.remove("route-enter");
      stage.classList.add("route-leave");
      await delay();
      if (token !== navigationId) return;
    }
    stage.classList.remove("route-leave", "route-enter");
    await renderRoute(route, token);
    if (token !== navigationId || !animate || reducedMotion()) return;
    requestAnimationFrame(() => {
      if (token === navigationId) stage.classList.add("route-enter");
    });
  }

  function navigate(route) {
    const destination = routes.includes(route) ? route : routes[0];
    const hash = `#/${destination}`;
    if (location.hash === hash) return mount(destination);
    location.hash = hash;
  }

  function start() {
    const hashRoute = location.hash.replace(/^#\/?/, "").split("/")[0];
    if (!location.hash || !routes.includes(hashRoute)) {
      history.replaceState(null, "", `#/${getRoute()}`);
    }
    window.addEventListener("hashchange", () => mount(getRoute()));
    navigation.forEach((button) =>
      button.addEventListener("click", () => navigate(button.dataset.view)),
    );
    return mount(getRoute(), { animate: false });
  }

  return { getRoute, mount, navigate, start };
}
