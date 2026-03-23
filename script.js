const body = document.body;
const sidebar = document.getElementById("sidebar");
const menuButton = document.getElementById("menu-button");
const backdrop = document.getElementById("backdrop");
const currentPage = body.dataset.page;
const root = document.documentElement;
const textFormatter = window.siteTextFormatter || {};

const measureScrollbarWidth = () => {
  const probe = document.createElement("div");

  probe.style.position = "absolute";
  probe.style.top = "-9999px";
  probe.style.width = "120px";
  probe.style.height = "120px";
  probe.style.overflow = "scroll";
  probe.style.visibility = "hidden";

  document.body.appendChild(probe);

  const width = probe.offsetWidth - probe.clientWidth;

  probe.remove();

  return Math.max(0, width);
};

const syncScrollbarReserve = () => {
  if (!root) {
    return;
  }

  root.style.setProperty("--scrollbar-reserve", `${measureScrollbarWidth()}px`);
};

syncScrollbarReserve();

if (textFormatter.apply) {
  textFormatter.apply(document.body);
}

document.querySelectorAll("[data-nav-page]").forEach((link) => {
  if (link.dataset.navPage === currentPage) {
    link.classList.add("is-active");
  }
});

const closeSidebar = () => {
  if (!sidebar || !menuButton || !backdrop) {
    return;
  }

  sidebar.classList.remove("is-open");
  backdrop.classList.remove("is-visible");
  menuButton.setAttribute("aria-expanded", "false");
};

const openSidebar = () => {
  if (!sidebar || !menuButton || !backdrop) {
    return;
  }

  sidebar.classList.add("is-open");
  backdrop.classList.add("is-visible");
  menuButton.setAttribute("aria-expanded", "true");
};

if (menuButton) {
  menuButton.addEventListener("click", () => {
    const isExpanded = menuButton.getAttribute("aria-expanded") === "true";

    if (isExpanded) {
      closeSidebar();
      return;
    }

    openSidebar();
  });
}

if (backdrop) {
  backdrop.addEventListener("click", closeSidebar);
}

if (sidebar) {
  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 960) {
        closeSidebar();
      }
    });
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeSidebar();
  }
});

window.addEventListener("resize", () => {
  syncScrollbarReserve();

  if (window.innerWidth > 960) {
    closeSidebar();
  }
});
