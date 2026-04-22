/**
 * uploader.js
 * 處理照片上傳、排序、預覽縮圖
 */

export class Uploader {
  constructor({ zone, input, strip, countLabel, onLoad }) {
    this.zone       = zone;
    this.input      = input;
    this.strip      = strip;
    this.countLabel = countLabel;
    this.onLoad     = onLoad;   // callback(images: {img, blobUrl}[])
    this.images     = [];

    this._bindEvents();
  }

  _bindEvents() {
    this.zone.addEventListener('dragover', e => {
      e.preventDefault();
      this.zone.classList.add('drag-over');
    });
    this.zone.addEventListener('dragleave', () => {
      this.zone.classList.remove('drag-over');
    });
    this.zone.addEventListener('drop', e => {
      e.preventDefault();
      this.zone.classList.remove('drag-over');
      this._handleFiles(e.dataTransfer.files);
    });
    this.input.addEventListener('change', () => {
      this._handleFiles(this.input.files);
    });
  }

  async _handleFiles(fileList) {
    const files = Array.from(fileList)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, 30); // cap at 30

    if (!files.length) return;

    this.countLabel.textContent = `載入中 ${files.length} 張…`;
    this.strip.innerHTML = '';

    const loaded = await Promise.all(
      files.map((file, idx) => new Promise(resolve => {
        const blobUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ img, blobUrl, idx });
        img.src = blobUrl;
      }))
    );

    // sort by original file order
    this.images = loaded.sort((a, b) => a.idx - b.idx);

    this.countLabel.textContent = `已選擇 ${this.images.length} 張照片`;
    this._buildStrip();
    this.onLoad(this.images);
  }

  _buildStrip() {
    this.strip.innerHTML = '';
    const show = this.images.slice(0, 12);

    show.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'thumb';
      div.innerHTML = `<img src="${item.blobUrl}" alt=""><span class="thumb-num">${i + 1}</span>`;
      this.strip.appendChild(div);
    });

    if (this.images.length > 12) {
      const more = document.createElement('div');
      more.className = 'thumb-more';
      more.textContent = `+${this.images.length - 12}`;
      this.strip.appendChild(more);
    }
  }

  reset() {
    this.images.forEach(item => URL.revokeObjectURL(item.blobUrl));
    this.images = [];
    this.strip.innerHTML = '';
    this.countLabel.textContent = '尚未選擇檔案';
    this.input.value = '';
  }

  getImages() {
    return this.images;
  }
}
