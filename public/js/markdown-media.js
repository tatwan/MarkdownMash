(function attachMarkdownMedia(root) {
  const preparedImages = new WeakSet();
  let viewer = null;
  let viewerImage = null;
  let viewerCaption = null;
  let sizeButton = null;
  let sourceImage = null;

  function closeImage() {
    if (viewer?.open) viewer.close();
  }

  function imageUnavailable(image) {
    if (image.hidden) return;
    image.hidden = true;
    const message = document.createElement('span');
    message.className = 'markdown-image-error';
    message.textContent = image.alt ? `Image unavailable: ${image.alt}` : 'Image unavailable';
    image.after(message);
  }

  function createViewer() {
    viewer = document.createElement('dialog');
    viewer.className = 'markdown-image-viewer';
    viewer.setAttribute('aria-label', 'Enlarged image');
    const toolbar = document.createElement('div');
    toolbar.className = 'markdown-image-toolbar';
    sizeButton = document.createElement('button');
    sizeButton.type = 'button';
    sizeButton.className = 'btn btn-secondary';
    sizeButton.addEventListener('click', () => {
      const actualSize = viewer.classList.toggle('markdown-image-actual-size');
      sizeButton.textContent = actualSize ? 'Fit image' : 'Actual size';
      sizeButton.setAttribute('aria-pressed', String(actualSize));
    });
    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'btn btn-secondary';
    closeButton.textContent = 'Close image';
    closeButton.autofocus = true;
    closeButton.addEventListener('click', closeImage);
    toolbar.append(sizeButton, closeButton);
    const canvas = document.createElement('div');
    canvas.className = 'markdown-image-canvas';
    viewerImage = document.createElement('img');
    viewerImage.referrerPolicy = 'no-referrer';
    viewerImage.addEventListener('error', () => {
      viewerCaption.textContent = 'Image unavailable';
    });
    canvas.append(viewerImage);
    viewerCaption = document.createElement('p');
    viewerCaption.className = 'markdown-image-caption';
    viewer.append(toolbar, canvas, viewerCaption);
    viewer.addEventListener('click', event => {
      if (event.target === viewer) closeImage();
    });
    viewer.addEventListener('close', () => {
      const previousImage = sourceImage;
      sourceImage = null;
      viewerImage.removeAttribute('src');
      if (previousImage?.isConnected && previousImage.getClientRects().length) {
        previousImage.focus({ preventScroll: true });
      }
    });
    document.body.append(viewer);
  }

  function openImage(image) {
    if (image.hidden || image.closest('a, button') || !image.currentSrc) return;
    if (!viewer) createViewer();
    sourceImage = image;
    viewer.classList.remove('markdown-image-actual-size');
    sizeButton.textContent = 'Actual size';
    sizeButton.setAttribute('aria-pressed', 'false');
    viewerImage.alt = image.alt;
    viewerImage.src = image.currentSrc;
    viewerCaption.textContent = image.alt || 'Enlarged image';
    viewer.showModal();
  }

  function prepareImage(image) {
    if (preparedImages.has(image)) return;
    preparedImages.add(image);
    if (!image.closest('a, button')) {
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-haspopup', 'dialog');
      image.setAttribute('aria-label', image.alt ? `Enlarge image: ${image.alt}` : 'Enlarge image');
      image.title = 'Click or tap to enlarge';
    }
    image.addEventListener('error', () => imageUnavailable(image));
    if (image.complete && !image.naturalWidth) imageUnavailable(image);
  }

  function prepareImages(container) {
    if (container.nodeType !== 1) return;
    if (container.matches('img.markdown-image')) prepareImage(container);
    container.querySelectorAll('img.markdown-image').forEach(prepareImage);
  }

  function initializeMedia() {
    prepareImages(document.body);
    document.addEventListener('click', event => {
      if (event.target.matches('img.markdown-image')) openImage(event.target);
    });
    document.addEventListener('keydown', event => {
      // The preview also handles Escape; closing an image must keep it open.
      if (viewer?.open && event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeImage();
      } else if ((event.key === 'Enter' || event.key === ' ')
        && event.target.matches('img.markdown-image')
        && !event.target.closest('a, button')) {
        event.preventDefault();
        openImage(event.target);
      }
    }, true);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        record.addedNodes.forEach(prepareImages);
      }
      // A question ending, reconnect, or terminal screen must dismiss its image.
      if (viewer?.open && (!sourceImage?.isConnected || !sourceImage.getClientRects().length)) {
        closeImage();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMedia, { once: true });
  } else {
    initializeMedia();
  }
  root.MarkdownMashMedia = { closeImage };
}(globalThis));
