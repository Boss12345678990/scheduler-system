// Clinic operating hours based on operating-hour.png
// Each day defines which shifts are active and their time ranges

const OPERATING_HOURS = {
  0: { // Sunday
    dayoff: true,
    morning: false,
    afternoon: false,
    night: false,
  },
  1: { // Monday — 下午 2:00-5:30; 晚上 6:30-8:00
    dayoff: false,
    morning: false,
    afternoon: true,
    night: true,
    hours: {
      afternoon: { start: '14:00', end: '17:30', duration: 3.5 },
      night: { start: '18:30', end: '20:00', duration: 1.5 },
    },
  },
  2: { // Tuesday — 上午 9:30-12:00; 下午 2:00-5:45
    dayoff: false,
    morning: true,
    afternoon: true,
    night: false,
    hours: {
      morning: { start: '09:30', end: '12:00', duration: 2.5 },
      afternoon: { start: '14:00', end: '17:45', duration: 3.75 },
    },
  },
  3: { // Wednesday — 休診
    dayoff: true,
    morning: false,
    afternoon: false,
    night: false,
  },
  4: { // Thursday — 下午 3:00-5:30; 晚上 6:30-8:00
    dayoff: false,
    morning: false,
    afternoon: true,
    night: true,
    hours: {
      afternoon: { start: '15:00', end: '17:30', duration: 2.5 },
      night: { start: '18:30', end: '20:00', duration: 1.5 },
    },
  },
  5: { // Friday — 上午 9:30-12:00; 下午 2:00-5:45
    dayoff: false,
    morning: true,
    afternoon: true,
    night: false,
    hours: {
      morning: { start: '09:30', end: '12:00', duration: 2.5 },
      afternoon: { start: '14:00', end: '17:45', duration: 3.75 },
    },
  },
  6: { // Saturday — 上午 9:30-12:00; 下午 2:00-4:00
    dayoff: false,
    morning: true,
    afternoon: true,
    night: false,
    hours: {
      morning: { start: '09:30', end: '12:00', duration: 2.5 },
      afternoon: { start: '14:00', end: '16:00', duration: 2 },
    },
  },
};

// Every active shift requires at least 2 牙助 and 1 櫃台
const SHIFT_REQUIREMENTS = {
  牙助: 2,
  櫃台: 1,
};

// Priority lists for filling positions
// 牙助 positions: 牙助 > 牙助+櫃台
const YAZHU_PRIORITY = ['牙助', '牙助+櫃台'];

// 櫃台 positions: 櫃台 > 牙助+櫃台
const GUITAI_PRIORITY = ['櫃台', '牙助+櫃台'];

// Weekday names mapped to JS getDay() values
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export {
  OPERATING_HOURS,
  SHIFT_REQUIREMENTS,
  YAZHU_PRIORITY,
  GUITAI_PRIORITY,
  DAY_NAMES,
};
