const elapsed = ms => `${Math.floor(ms / 60000).toString().padStart(2, '0')}:${Math.floor(ms / 1000 % 60).toString().padStart(2, '0')}`;
const clean = text => String(text).replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').replace(/\s+/g, ' ');
const fit = (text, width) => { const value = clean(text); return value.length <= width ? value : value.slice(0, Math.max(0, width - 3)) + '...'; };
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit' });

export class ReviewTerminal {
  constructor(options, stream = process.stdout) {
    this.options = options; this.stream = stream; this.started = Date.now(); this.requests = new Map();
    this.events = []; this.lines = 0; this.doneFiles = 0; this.totalFiles = 0;
    this.totalChunks = 0; this.doneChunks = 0; this.cachedChunks = 0; this.failedChunks = 0;
    this.tty = !!stream.isTTY && !options.plain;
    this.color = this.tty && !process.env.NO_COLOR;
  }
  paint(code, text) { return this.color ? `\x1b[${code}m${text}\x1b[0m` : text; }
  start(total, skipped) {
    this.totalFiles = total; this.doneFiles = skipped;
    if (this.tty) { this.stream.write('\x1b[?25l'); this.timer = setInterval(() => this.draw(), 500); this.draw(); }
    else this.log('START', `Model: ${this.options.model} | ${this.options.concurrency} concurrent requests | chunks <= ${this.options['chunk-bytes']} bytes / ${this.options['chunk-lines']} lines`);
  }
  log(level, text) {
    const entry = `${clock.format(new Date())}  ${level.padEnd(7)} ${clean(text)}`;
    this.events.push(entry); this.events = this.events.slice(-4);
    if (this.tty) this.draw();
    else (['FAILED', 'ERROR'].includes(level) ? console.error : console.log)(entry);
  }
  request(id, patch) { this.requests.set(id, { ...this.requests.get(id), ...patch }); }
  endRequest(id) { this.requests.delete(id); }
  addChunks(count) { this.totalChunks += count; }
  chunkDone(cached, failed = false) { this.doneChunks++; if (cached) this.cachedChunks++; if (failed) this.failedChunks++; }
  fileDone() { this.doneFiles++; }
  draw() {
    if (!this.tty) return;
    const width = Math.max(50, Math.min(this.stream.columns || 110, 150)) - 1;
    const percent = this.totalFiles ? this.doneFiles / this.totalFiles : 0;
    const fill = Math.min(24, Math.round(percent * 24));
    const rows = [
      this.paint('1;36', ' DUBBL  /  English to Persian MDX'),
      ` Model: ${this.options.model}  |  API slots: ${this.options.requestPool.active}/${this.options.concurrency}  |  Elapsed: ${elapsed(Date.now() - this.started)}`,
      ` Files  [${'#'.repeat(fill)}${'-'.repeat(24 - fill)}] ${this.doneFiles}/${this.totalFiles}`,
      ` Chunks ${this.doneChunks}/${this.totalChunks}  |  Cached ${this.cachedChunks}  |  Failed ${this.failedChunks}  |  Waiting ${this.options.requestPool.queued}`,
      '-'.repeat(width),
    ];
    const active = [...this.requests.values()].slice(0, this.options.concurrency);
    for (let index = 0; index < this.options.concurrency; index++) {
      const request = active[index];
      rows.push(request ? ` ${index + 1}. ${request.label}  |  ${request.phase || 'starting'}  |  ${Math.floor((Date.now() - request.started) / 1000)}s  |  ${((request.bytes || 0) / 1024).toFixed(1)}KB  |  ${request.outputChars || 0} chars` : ` ${index + 1}. idle`);
    }
    rows.push('-'.repeat(width), ...this.events.map(entry => ` ${entry}`));
    if (this.lines) this.stream.write(`\x1b[${this.lines}A\r\x1b[0J`);
    this.stream.write(rows.map(row => row.includes('\x1b[') ? row : fit(row, width)).join('\n') + '\n');
    this.lines = rows.length;
  }
  close() {
    clearInterval(this.timer);
    if (this.tty) { this.draw(); this.stream.write('\x1b[?25h'); this.tty = false; }
  }
}
