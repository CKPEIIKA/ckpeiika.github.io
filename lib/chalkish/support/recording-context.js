export class RecordingContext2D {
  constructor(width = 320, height = 180) {
    this.canvas = { width, height };
    this.commands = [];
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.strokeStyle = '#000';
    this.fillStyle = '#000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
    this.imageSmoothingEnabled = true;
  }

  #push(name, ...args) {
    this.commands.push([name, ...args]);
  }

  save() { this.#push('save'); }
  restore() { this.#push('restore'); }
  resetTransform() { this.#push('resetTransform'); }
  setTransform(...args) { this.#push('setTransform', ...args); }
  clearRect(...args) { this.#push('clearRect', ...args); }
  fillRect(...args) { this.#push('fillRect', ...args); }
  strokeRect(...args) { this.#push('strokeRect', ...args); }
  beginPath() { this.#push('beginPath'); }
  closePath() { this.#push('closePath'); }
  moveTo(...args) { this.#push('moveTo', ...args); }
  lineTo(...args) { this.#push('lineTo', ...args); }
  arc(...args) { this.#push('arc', ...args); }
  rect(...args) { this.#push('rect', ...args); }
  stroke() { this.#push('stroke'); }
  fill() { this.#push('fill'); }
  fillText(...args) { this.#push('fillText', ...args); }
  strokeText(...args) { this.#push('strokeText', ...args); }
  setLineDash(value) { this.#push('setLineDash', ...value); }
  drawImage(...args) { this.#push('drawImage', ...args); }
  putImageData(...args) { this.#push('putImageData', ...args.slice(1)); }
  translate(...args) { this.#push('translate', ...args); }
  rotate(...args) { this.#push('rotate', ...args); }
  scale(...args) { this.#push('scale', ...args); }

  createImageData(width, height) {
    this.#push('createImageData', width, height);
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }

  measureText(text) {
    return { width: String(text).length * 8 };
  }

  count(name) {
    return this.commands.filter((entry) => entry[0] === name).length;
  }
}
