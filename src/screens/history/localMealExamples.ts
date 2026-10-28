import type { MealRecord } from './MealHistoryScreen';
/** Explicit opt-in examples; these are never supplied as real history. */
export const localMealExamples: MealRecord[] = [false, true].map(dinner => ({
  id: dinner ? 'local-dinner' : 'local-lunch', title: dinner ? '로컬 예시 · 저녁팟' : '로컬 예시 · 팀 점심',
  date: dinner ? '2026-09-25' : '2026-09-27', dateLabel: dinner ? '9월 25일 (금)' : '9월 27일 (일)', time: dinner ? '19:00' : '12:30', place: dinner ? '돼지집 서면점' : '조선칼국수 하단점',
  photo: dinner ? require('../preview/assets/historyDinner.jpg') : require('../preview/assets/historyLunch.jpg'),
  mates: ['모아', '또리', '두두', '웰링'].map(name => ({ name })), amount: 52000, share: 13000,
  items: dinner ? [{ name: '삼겹살 (200g)', quantity: 3, amount: 45000 }, { name: '공기밥', quantity: 4, amount: 4000 }, { name: '된장찌개', quantity: 1, amount: 3000 }]
    : [{ name: '조선칼국수 (보통)', quantity: 3, amount: 27000 }, { name: '조선칼국수 (곱빼기)', quantity: 1, amount: 10000 }, { name: '수육', quantity: 1, amount: 13000 }, { name: '공기밥 추가', quantity: 2, amount: 2000 }],
}));

/** Phone 631:6196: same local receipt layout, distinct place and item data. */
localMealExamples.push({
  ...localMealExamples[1], id: 'local-shabu', title: '로컬 예시 · 저녁팟 · 샤브샤브', place: '채선당 서면점',
  items: [{ name: '샤브샤브 세트', quantity: 4, amount: 48000 }, { name: '칼국수 사리', quantity: 2, amount: 4000 }],
});
