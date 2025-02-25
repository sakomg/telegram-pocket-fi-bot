const constants = require("./constants");
const createApi = require("./api");
const createLogger = require("./logger");
const parseApplicationEnvs = require("./environments");
const utils = require("./utils");

const envs = parseApplicationEnvs();

const api = createApi({
  referrerUrl: envs.REFFERER_URL,
  apiRootUrl: envs.API_ROOT_URL,
});

const logger = createLogger(envs.CLI_PALETTE_VARIANT);

/**
 *
 * Log the processing message
 *
 * @param {String} emoji - emoji to show
 * @param {String} message - message to show
 * @param {'info' | 'error'} logLevel - log level
 * @param {Boolean} showMessage  - show the message or not (The message will be masked if false)
 */
function logProcessing(emoji, message, logLevel, showMessage) {
  const logMessage = showMessage ? message : "*****🕵️*****";
  const result = `${emoji}  ${logMessage}`;

  logger[logLevel](result);
}

/**
 * Calculate the mining amount
 *
 * @param {Number} miningAmount
 * @param {Number} dttmLastPayment
 * @param {Number} speed
 * @returns
 */
function calculateMiningAmount(miningAmount, dttmLastPayment, speed) {
  const minutesSinceLastPayment = (Date.now() - dttmLastPayment) / 60_000;
  const miningAmountIncrease = Math.max(
    minutesSinceLastPayment * (speed / 60),
    0
  );

  return miningAmount + miningAmountIncrease;
}

/**
 *
 * Claim the mining amount for the account
 *
 * @param {Object} account
 * @param {String} account.NAME
 * @param {String} account.USER_AGENT
 * @param {String} account.TG_RAW_DATA
 * @returns
 */
async function processAccount(account) {
  const { NAME, USER_AGENT, TG_RAW_DATA } = account;

  const {
    userMining: { miningAmount = 0, dttmLastPayment, speed },
  } = await api.getUserMining({
    rawData: TG_RAW_DATA,
    userAgent: USER_AGENT,
  });

  const mined = calculateMiningAmount(miningAmount, dttmLastPayment, speed);

  logProcessing(
    "⛏️",
    `[${NAME}] Mining amount: ${miningAmount}`,
    "info",
    envs.SHOW_LOGS_MESSAGES
  );

  if (mined < envs.MIN_MINING_AMOUNT) {
    logProcessing(
      "🫠",
      `[${NAME}] Cannot withdraw, mined amount is less than ${envs.MIN_MINING_AMOUNT}`,
      "info",
      envs.SHOW_LOGS_MESSAGES
    );

    return;
  }

  try {
    const {
      userMining: { gotAmount },
    } = await api.claimMining({
      rawData: TG_RAW_DATA,
      userAgent: USER_AGENT,
    });
    logProcessing(
      "✅",
      `[${NAME}] Successfully claimed ${mined}`,
      "info",
      envs.SHOW_LOGS_MESSAGES
    );
    logProcessing(
      "💰",
      `[${NAME}] Total amount: ${gotAmount}`,
      "info",
      envs.SHOW_LOGS_MESSAGES
    );
  } catch (error) {
    logProcessing(
      "❌",
      `[${NAME}] Error while claiming: ${error.message}`,
      "error",
      envs.SHOW_LOGS_MESSAGES
    );
  }
}

async function delayedProcessAccount(account) {
  await utils.randomWait(5000, 9000);
  return processAccount(account);
}

async function main() {
  logger.info(
    `Starting the ${logger.formatters.makeBold(constants.APPLICATION_NAME)} ...`
  );

  const initialAccounts = envs.ACCOUNTS;
  if (!initialAccounts.length) {
    throw new Error(`No valid accounts found. Please check the environment variables.
Example:
ACCOUNT_1_USER_AGENT=Mozilla/5.0 (...)
ACCOUNT_1_TG_RAW_DATA=query_id=1234&user=...

ACCOUNT_2_USER_AGENT=Mozilla/5.0 (...)
ACCOUNT_2_TG_RAW_DATA=query_id=2345&user=...
  `);
  }

  const accounts = utils.shuffleArray(initialAccounts);

  if (envs.CONTINUOUS_RUN_MODE) {
    const timeouts = envs.CONTINUOUS_RUN_MODE_TIMEOUT_MINS;
    const tms = timeouts.join(", ");
    logger.info(
      `⚙️ Continuous mode is enabled. The claimer will run based on the timeouts: ${tms}`
    );
    logger.info(
      "To claim once, disable the continuous mode by setting the CONTINUOUS_RUN_MODE=0."
    );

    while (true) {
      for (const account of accounts) {
        await delayedProcessAccount(account);
      }

      const timeout = utils.randomBetween(...timeouts);
      logProcessing(
        "⏳",
        `Next claim in ${timeout} minute(s)`,
        "info",
        envs.SHOW_LOGS_MESSAGES
      );

      await utils.wait(utils.minuteToMs(timeout));
    }
  } else {
    logger.info("⚙️ Continuous mode is disabled. The claimer will run once.");
    logger.info(
      "To claim repeatedly, enable the continuous mode by setting the CONTINUOUS_RUN_MODE=1."
    );
  }

  for (const account of accounts) {
    await delayedProcessAccount(account);
  }
}

main();
