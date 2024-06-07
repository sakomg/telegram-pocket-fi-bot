class Spinner {
  #logger;

  constructor(logger) {
    this.#logger = logger;
    this.frames = ["-", "\\", "|", "/"];
    this.interval = 100;
    this.intervalId = null;
    this.currentIndex = 0;
  }

  start() {
    this.intervalId = setInterval(() => {
      const message = `${this.frames[this.currentIndex]} waiting...`;
      process.stdout.write(`\r${this.#logger._formatMessage("info", message)}`);
      this.currentIndex = (this.currentIndex + 1) % this.frames.length;
    }, this.interval);
  }

  stop() {
    clearInterval(this.intervalId);
    process.stdout.write("\r");
    this.#logger.info("");
  }
}

module.exports = { Spinner };
