(function () {
  const albums = {
    zju: {
      title: "Zhejiang University",
      shortTitle: "ZJU",
      folder: "ZJU",
      count: 27,
    },
    ucla: {
      title: "UCLA",
      shortTitle: "UCLA",
      folder: "UCLA",
      count: 32,
    },
    harvard: {
      title: "Harvard",
      shortTitle: "Harvard",
      folder: "Harvard",
      count: 36,
    },
    umich: {
      title: "UMich",
      shortTitle: "UMich",
      folder: "UMich",
      count: 17,
    },
    malaysia: {
      title: "Malaysia",
      shortTitle: "Malaysia",
      folder: "Malaysia",
      count: 45,
    },
  };

  const albumKey = document.body.dataset.album;
  const album = albums[albumKey];
  const grid = document.querySelector("[data-photo-grid]");
  const title = document.querySelector("[data-album-title]");
  const albumLabels = document.querySelectorAll("[data-album-label]");
  const lightbox = document.querySelector("[data-lightbox]");
  const lightboxImage = document.querySelector("[data-lightbox-image]");
  const lightboxCaption = document.querySelector("[data-lightbox-caption]");
  const lightboxClose = document.querySelector("[data-lightbox-close]");

  if (!album || !grid) {
    return;
  }

  if (title) {
    title.textContent = album.title;
    document.title = `${album.title} Photos | Song, Siliang`;
  }

  albumLabels.forEach((label) => {
    label.textContent = album.shortTitle;
  });

  function photoPath(size, index) {
    return `https://ssl.qs1401.com/img/${album.folder}/${size}/${index}.jpg`;
  }

  function openLightbox(index) {
    if (!lightbox || !lightboxImage) {
      return;
    }

    lightboxImage.src = photoPath("bigsize", index);
    lightboxImage.alt = `${album.title} photo ${index}`;
    if (lightboxCaption) {
      lightboxCaption.textContent = `Image ${index} of ${album.count}`;
    }
    lightbox.classList.add("is-open");
    lightbox.setAttribute("aria-hidden", "false");
    document.body.classList.add("lightbox-open");
  }

  function closeLightbox() {
    if (!lightbox || !lightboxImage) {
      return;
    }

    lightbox.classList.remove("is-open");
    lightbox.setAttribute("aria-hidden", "true");
    document.body.classList.remove("lightbox-open");
    lightboxImage.removeAttribute("src");
    lightboxImage.alt = "";
    if (lightboxCaption) {
      lightboxCaption.textContent = "";
    }
  }

  for (let index = 1; index <= album.count; index += 1) {
    const button = document.createElement("button");
    button.className = "photo-tile";
    button.type = "button";
    button.setAttribute("aria-label", `Open ${album.title} photo ${index}`);

    const image = document.createElement("img");
    image.src = photoPath("thumbnail", index);
    image.alt = `${album.title} photo ${index}`;
    image.loading = "lazy";

    button.append(image);
    button.addEventListener("click", () => openLightbox(index));
    grid.append(button);
  }

  if (lightbox) {
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });
  }

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLightbox();
    }
  });
})();
