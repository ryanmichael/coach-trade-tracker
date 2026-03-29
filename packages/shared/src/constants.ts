export const MARKET_HOURS = {
  OPEN_ET: "09:30",
  CLOSE_ET: "16:00",
  PRE_MARKET_START_ET: "04:00",
  AFTER_HOURS_END_ET: "20:00",
  USER_TIMEZONE: "America/Chicago", // Dallas, TX (Central Time)
  MARKET_TIMEZONE: "America/New_York",
} as const;

export const POLLING_INTERVALS = {
  MARKET_HOURS_SEC: 15,
  PRE_AFTER_HOURS_SEC: 60,
  CLOSED_SEC: 300,
} as const;

export const PARSER = {
  REGEX_TIMEOUT_MS: 100,
  IMAGE_TIMEOUT_MS: 3000,
  LOW_CONFIDENCE_THRESHOLD: 0.7,
  MAX_IMAGES_PER_POST: 4,
  MAX_IMAGE_SIZE_MB: 10,
} as const;

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 200,
} as const;

export const ALERT = {
  TOAST_DISMISS_SEC: 10,
  TAB_FLASH_INTERVAL_MS: 2000,
} as const;
