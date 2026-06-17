(function () {
  function currentPage() {
    const fileName = window.location.pathname.split("/").pop();
    return fileName || "index.html";
  }

  function markActiveNav(root) {
    const page = currentPage();
    root.querySelectorAll(".nav a").forEach((link) => {
      const linkPage = new URL(link.getAttribute("href"), window.location.href).pathname.split("/").pop();
      const isPhotoPage = linkPage === "photo.html" && page.startsWith("photo_");
      link.classList.toggle("active", linkPage === page || isPhotoPage);
    });
  }

  function loadPartial(target) {
    const file = target.dataset.include;

    return fetch(file)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${file} could not be loaded.`);
        }
        return response.text();
      })
      .then((html) => {
        const template = document.createElement("template");
        template.innerHTML = html.trim();
        const fragment = template.content.cloneNode(true);

        if (file === "header.html") {
          markActiveNav(fragment);
        }

        target.replaceWith(fragment);
      });
  }

  Promise.all(Array.from(document.querySelectorAll("[data-include]"), loadPartial))
    .then(() => {
      document.dispatchEvent(new CustomEvent("partials:loaded"));
    })
    .catch((error) => {
      console.error(error);
    });
})();
